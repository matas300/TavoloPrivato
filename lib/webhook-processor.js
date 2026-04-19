// lib/webhook-processor.js
// Processor sync in-process per StripeEvent. Registry di handler per
// event type. Retry/DLQ in-tabella: pending -> failed (retryCount++) -> dead.
//
// Idempotenza centralizzata nel wrapper: se status='processed', skip.
// Gli handler devono essere scritti idempotenti (updateMany con filtro
// sullo stato target, upsert, etc.).

async function handleInvoicePaid(prisma, event) {
  const invId = event.payload?.id;
  if (!invId) throw new Error('invoice.paid payload missing id');
  const result = await prisma.invoice.updateMany({
    where: { providerInvoiceId: invId, invoiceStatus: { not: 'paid' } },
    data: { invoiceStatus: 'paid', paidAt: new Date() }
  });
  return { updated: result.count };
}

async function handlePaymentIntentSucceeded(prisma, event) {
  const piId = event.payload?.id;
  if (!piId) throw new Error('payment_intent.succeeded payload missing id');
  const result = await prisma.paymentOrder.updateMany({
    where: { providerPaymentIntentId: piId, status: { not: 'captured' } },
    data: { status: 'captured', capturedAt: new Date() }
  });
  return { updated: result.count };
}

async function handleWithholdingReported(prisma, event) {
  const p = event.payload || {};
  const { invoiceId, workerProfileId, restaurantProfileId, amountEur, taxRegime } = p;

  if (!invoiceId || !workerProfileId || !restaurantProfileId || !taxRegime) {
    throw new Error('withholding.reported payload incomplete');
  }
  if (typeof amountEur !== 'number' || amountEur <= 0) {
    return { skipped: true, reason: 'zero_or_invalid_amount' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { issuedAt: true }
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const issuedAt = invoice.issuedAt;
  const periodYear = issuedAt.getUTCFullYear();
  const periodMonth = issuedAt.getUTCMonth() + 1;

  const key = {
    accrual_unique_key: {
      restaurantProfileId, workerProfileId, periodYear, periodMonth,
      taxRegimeSnapshot: taxRegime,
    }
  };

  const existing = await prisma.withholdingAccrual.findUnique({ where: key });
  if (existing) {
    const nextLast = issuedAt > existing.lastInvoiceAt ? issuedAt : existing.lastInvoiceAt;
    const nextFirst = issuedAt < existing.firstInvoiceAt ? issuedAt : existing.firstInvoiceAt;
    const updated = await prisma.withholdingAccrual.update({
      where: { id: existing.id },
      data: {
        totalAmountEur: { increment: amountEur },
        invoiceCount: { increment: 1 },
        firstInvoiceAt: nextFirst,
        lastInvoiceAt: nextLast,
      }
    });
    return { action: 'aggregated', accrualId: updated.id, totalAmountEur: updated.totalAmountEur };
  }

  const created = await prisma.withholdingAccrual.create({
    data: {
      restaurantProfileId, workerProfileId, periodYear, periodMonth,
      taxRegimeSnapshot: taxRegime,
      totalAmountEur: amountEur, invoiceCount: 1,
      firstInvoiceAt: issuedAt, lastInvoiceAt: issuedAt,
    }
  });
  return { action: 'created', accrualId: created.id, totalAmountEur: created.totalAmountEur };
}

async function noop(prisma, event) {
  return { noop: true, eventType: event.eventType };
}

const handlers = {
  'invoice.paid': handleInvoicePaid,
  'payment_intent.succeeded': handlePaymentIntentSucceeded,
  'withholding.reported': handleWithholdingReported,
  // No-op placeholders: eventi che il payment-agent gia processa sincronamente.
  'payment_intent.created': noop,
  'invoice.created': noop,
  'invoice.finalized': noop,
  'transfer.created': noop,
  'account.created': noop,
  'customer.created': noop,
};

async function processEvent(prisma, stripeEvent, { maxRetries = 3 } = {}) {
  if (stripeEvent.status === 'processed') {
    return { status: 'already_processed', eventId: stripeEvent.id };
  }

  const handler = handlers[stripeEvent.eventType];
  if (!handler) {
    const error = `unhandled event type: ${stripeEvent.eventType}`;
    const newRetryCount = stripeEvent.retryCount + 1;
    const newStatus = newRetryCount >= maxRetries ? 'dead' : 'failed';
    await prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: { status: newStatus, retryCount: newRetryCount, error, lastRetryAt: new Date() }
    });
    return { status: newStatus, eventId: stripeEvent.id, error };
  }

  try {
    const result = await handler(prisma, stripeEvent);
    await prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: { status: 'processed', processedAt: new Date(), error: null }
    });
    return { status: 'processed', eventId: stripeEvent.id, result };
  } catch (err) {
    const newRetryCount = stripeEvent.retryCount + 1;
    const newStatus = newRetryCount >= maxRetries ? 'dead' : 'failed';
    await prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: { status: newStatus, retryCount: newRetryCount, error: err.message, lastRetryAt: new Date() }
    });
    return { status: newStatus, eventId: stripeEvent.id, error: err.message };
  }
}

async function processPending(prisma, { limit = 100, maxRetries = 3 } = {}) {
  const events = await prisma.stripeEvent.findMany({
    where: { status: { in: ['pending', 'failed'] }, retryCount: { lt: maxRetries } },
    orderBy: { receivedAt: 'asc' },
    take: limit,
  });
  const results = [];
  for (const ev of events) {
    results.push(await processEvent(prisma, ev, { maxRetries }));
  }
  return {
    total: events.length,
    processed: results.filter(r => r.status === 'processed').length,
    failed: results.filter(r => r.status === 'failed').length,
    dead: results.filter(r => r.status === 'dead').length,
    already_processed: results.filter(r => r.status === 'already_processed').length,
    results,
  };
}

async function processPendingRetry(prisma, { limit = 100, maxRetries = 3 } = {}) {
  const events = await prisma.stripeEvent.findMany({
    where: { status: 'failed', retryCount: { lt: maxRetries } },
    orderBy: [{ lastRetryAt: 'asc' }, { receivedAt: 'asc' }],
    take: limit,
  });
  const results = [];
  for (const ev of events) {
    results.push(await processEvent(prisma, ev, { maxRetries }));
  }
  return { total: events.length, results };
}

module.exports = {
  processEvent, processPending, processPendingRetry,
  handlers,
};
