const { endOfMonth } = require('./compliance-agent');
const { getStripe } = require('./stripe');
const { computeInvoiceTaxes, TaxModeUnknownError } = require('./tax-calculator');

const PAYMENT_TERMS_DAYS = {
  d0: 0,
  d15: 15,
  d30: 30,
  d45: 45
};

function normalizePaymentTermsDays(value) {
  if (value === 'd15' || value === 15 || value === '15') return 'd15';
  if (value === 'd30' || value === 30 || value === '30') return 'd30';
  if (value === 'd45' || value === 45 || value === '45') return 'd45';
  return 'd0';
}

function normalizePaymentTermsBase(value) {
  return value === 'end_of_month' ? 'end_of_month' : 'invoice_date';
}

function paymentTermsDaysToNumber(value) {
  return PAYMENT_TERMS_DAYS[normalizePaymentTermsDays(value)] || 0;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function asLocalMidday(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('it-IT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome'
  }).format(date);
}

function countMonthSpans(startDate, endDate) {
  const spans = [];
  let cursor = asLocalMidday(startDate);

  while (cursor <= endDate) {
    const spanStart = asLocalMidday(cursor);
    const rawEnd = new Date(Math.min(endOfMonth(cursor).getTime(), endDate.getTime()));
    const spanEnd = asLocalMidday(rawEnd);
    spans.push({ start: spanStart, end: spanEnd });
    cursor = asLocalMidday(addDays(spanEnd, 1));
  }

  return spans;
}

function calculateDueDate(invoiceDate, paymentTermsDays, paymentTermsBase) {
  const normalizedBase = normalizePaymentTermsBase(paymentTermsBase);
  const days = paymentTermsDaysToNumber(paymentTermsDays);
  const anchor = normalizedBase === 'end_of_month' ? endOfMonth(invoiceDate) : new Date(invoiceDate);
  return asLocalMidday(addDays(anchor, days));
}

function buildMonthlyMilestones(input) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Intervallo del contratto non valido per la generazione milestone.');
  }

  const spans = countMonthSpans(startDate, endDate);
  const monthlyGross = input.monthlyGrossAmountEur
    ? money(input.monthlyGrossAmountEur)
    : money((Number(input.taxableAmountEur) || 0) / spans.length);
  const totalGross = input.taxableAmountEur
    ? money(input.taxableAmountEur)
    : money(monthlyGross * spans.length);
  const platformFeePct = Number(input.platformFeePct || 0);
  const presetPlatformFee = input.platformFeeEur == null ? null : money(input.platformFeeEur);

  let allocatedGross = 0;
  let allocatedFee = 0;

  return spans.map((span, index) => {
    const isLast = index === spans.length - 1;
    const taxableAmountEur = isLast
      ? money(totalGross - allocatedGross)
      : money(monthlyGross);
    const platformFeeEur = isLast
      ? money(
        presetPlatformFee != null
          ? presetPlatformFee - allocatedFee
          : (money(totalGross * platformFeePct / 100) - allocatedFee)
      )
      : money(
        presetPlatformFee != null
          ? presetPlatformFee / spans.length
          : taxableAmountEur * platformFeePct / 100
      );
    const workerNetEur = money(taxableAmountEur - platformFeeEur);
    const invoiceDate = span.end;
    const dueDate = calculateDueDate(invoiceDate, input.paymentTermsDays, input.paymentTermsBase);

    allocatedGross += taxableAmountEur;
    allocatedFee += platformFeeEur;

    return {
      sequence: index + 1,
      milestoneLabel: `Corrispettivo ${monthLabel(span.start)}`,
      periodStart: span.start,
      periodEnd: span.end,
      invoiceDate,
      dueDate,
      taxableAmountEur,
      platformFeeEur,
      workerNetEur,
      status: 'planned'
    };
  });
}

function buildStripeConnectPayload({ paymentOrder, milestone, contract, restaurantProfile, workerProfile }) {
  return {
    strategy: 'destination_charge_after_invoice_payment',
    invoice: {
      collection_method: 'send_invoice',
      due_date: milestone.dueDate.toISOString(),
      metadata: {
        contractId: String(contract.id),
        milestoneId: String(milestone.id || milestone.sequence),
        workerProfileId: String(workerProfile.id),
        restaurantProfileId: String(restaurantProfile.id)
      }
    },
    paymentIntent: {
      amount_cents: Math.round(paymentOrder.amountTotalEur * 100),
      currency: 'eur',
      application_fee_amount: Math.round(paymentOrder.platformFeeEur * 100),
      transfer_group: `contract_${contract.id}`,
      metadata: {
        contractId: String(contract.id),
        milestoneId: String(milestone.id || milestone.sequence)
      }
    }
  };
}

async function createBillingArtifactsForMilestone(prisma, milestone, asOfDate) {
  const stripe = getStripe();

  const existing = await prisma.paymentOrder.findFirst({ where: { contractMilestoneId: milestone.id } });
  if (existing) return existing;

  // PRECHECK FUORI TRANSAZIONE: carica contract + worker + taxProfile.
  // Se taxMode=unknown: skip (no exception, no transaction), torna oggetto skip.
  const contract = await prisma.serviceContract.findUnique({
    where: { id: milestone.serviceContractId },
    include: { workerProfile: { include: { taxProfile: true } } }
  });
  const worker = contract && contract.workerProfile;
  const taxMode = worker && worker.taxMode;

  if (!taxMode || taxMode === 'unknown') {
    console.log(`[payment-agent] SKIP milestone ${milestone.id}: worker ${(worker && worker.id) || '?'} taxMode=${taxMode || 'missing'}`);
    return {
      skipped: true,
      reason: 'TAX_MODE_UNKNOWN',
      milestoneId: milestone.id,
      workerProfileId: (worker && worker.id) || null,
    };
  }

  // Calcolo fiscale puro (pre-transaction). Eventuali TypeError/RangeError
  // propagano (hard-fail del singolo task, non skip).
  const taxes = computeInvoiceTaxes({
    taxableEur: milestone.taxableAmountEur,
    platformFeeEur: milestone.platformFeeEur,
    taxMode,
    workerProfileId: worker.id,
  });

  const pi = await stripe.paymentIntents.create(
    {
      amount: Math.round(taxes.totalDueEur * 100),
      currency: 'eur',
      application_fee_amount: Math.round(taxes.platformFeeEur * 100),
      transfer_group: `contract-${milestone.serviceContractId}`,
      metadata: {
        milestoneId: milestone.id,
        contractId: milestone.serviceContractId,
        taxRegime: taxes.taxRegimeSnapshot,
      }
    },
    { idempotencyKey: `milestone-${milestone.id}-create` }
  );

  const inv = await stripe.invoices.create(
    {
      amount_due: Math.round(taxes.totalDueEur * 100),
      currency: 'eur',
      due_date: milestone.dueDate ? Math.floor(new Date(milestone.dueDate).getTime() / 1000) : null,
      metadata: { milestoneId: milestone.id, taxRegime: taxes.taxRegimeSnapshot }
    },
    { idempotencyKey: `milestone-${milestone.id}-invoice` }
  );

  const txResult = await prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.create({
      data: {
        serviceContractId: milestone.serviceContractId,
        contractMilestoneId: milestone.id,
        provider: 'stripe_connect',
        providerPaymentIntentId: pi.id,
        providerInvoiceId: inv.id,
        currency: 'EUR',
        amountTotalEur: taxes.taxableAmountEur,       // imponibile (semantica invariata)
        platformFeeEur: taxes.platformFeeEur,
        payoutAmountEur: taxes.netToWorkerEur,         // netto post-ritenuta-post-fee
        totalDueEur: taxes.totalDueEur,                // quanto il ristorante paga
        status: 'created',
        scheduledCaptureAt: milestone.dueDate || asOfDate,
        dueDate: milestone.dueDate
      }
    });

    const createdInvoice = await tx.invoice.create({
      data: {
        paymentOrderId: order.id,
        serviceContractId: milestone.serviceContractId,
        contractMilestoneId: milestone.id,
        invoiceType: 'platform',
        providerInvoiceId: inv.id,
        invoiceStatus: 'open',
        amountEur: taxes.taxableAmountEur,              // back-compat (= imponibile)
        taxableAmountEur: taxes.taxableAmountEur,
        withholdingRate: taxes.withholdingRate,
        withholdingAmountEur: taxes.withholdingAmountEur,
        totalDueEur: taxes.totalDueEur,
        netToWorkerEur: taxes.netToWorkerEur,
        taxRegimeSnapshot: taxes.taxRegimeSnapshot,
        issuedAt: asOfDate,
        dueDate: milestone.dueDate
      }
    });

    await tx.contractMilestone.update({
      where: { id: milestone.id },
      data: { status: 'invoiced', providerInvoiceId: inv.id }
    });

    return { order, invoice: createdInvoice };
  }, { timeout: 30000, maxWait: 10000 });

  // DOPO la transazione: evento withholding.reported se ritenuta > 0.
  // Idempotent via idempotencyKey = milestone-<id>-withholding.
  if (taxes.withholdingAmountEur > 0) {
    await stripe.withholding.report(
      {
        invoiceId: txResult.invoice.id,
        workerProfileId: worker.id,
        restaurantProfileId: contract.restaurantProfileId,
        amountEur: taxes.withholdingAmountEur,
        rate: taxes.withholdingRate,
        taxRegime: taxes.taxRegimeSnapshot,
      },
      { idempotencyKey: `milestone-${milestone.id}-withholding` }
    );
  }

  return txResult.order;
}

async function runMonthlyBillingCycle(prisma, options = {}) {
  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
  const milestones = await prisma.contractMilestone.findMany({
    where: {
      status: 'planned',
      invoiceDate: {
        lte: asOfDate
      }
    },
    orderBy: [
      { invoiceDate: 'asc' },
      { sequence: 'asc' }
    ]
  });

  const created = [];
  const skipped = [];

  for (const milestone of milestones) {
    const result = await createBillingArtifactsForMilestone(prisma, milestone, asOfDate);
    if (result && result.skipped) {
      skipped.push({
        milestoneId: result.milestoneId,
        reason: result.reason,
        workerProfileId: result.workerProfileId,
      });
    } else if (result) {
      created.push(result);
    }
  }

  return {
    asOfDate,
    createdCount: created.length,
    created,
    skippedCount: skipped.length,
    skipped,
  };
}

async function captureDuePaymentOrders(prisma, options) {
  const stripe = getStripe();
  const now = (options && options.now) ? new Date(options.now) : (options && options.asOfDate ? new Date(options.asOfDate) : new Date());

  const orders = await prisma.paymentOrder.findMany({
    where: { status: 'created', scheduledCaptureAt: { lte: now } },
    include: { contractMilestone: true }
  });

  const results = [];
  for (const order of orders) {
    await stripe.paymentIntents.capture(order.providerPaymentIntentId, { idempotencyKey: `milestone-${order.contractMilestoneId}-capture` });

    const worker = await prisma.workerProfile.findFirst({
      where: { serviceContracts: { some: { id: order.serviceContractId } } }
    });

    if (worker && worker.stripeAccountId) {
      await stripe.transfers.create(
        {
          amount: Math.round(order.payoutAmountEur * 100),
          currency: 'eur',
          destination: worker.stripeAccountId,
          transfer_group: `contract-${order.serviceContractId}`,
          metadata: { milestoneId: order.contractMilestoneId }
        },
        { idempotencyKey: `milestone-${order.contractMilestoneId}-transfer` }
      );
    }

    if (order.providerInvoiceId) {
      await stripe.invoices.pay(order.providerInvoiceId, { idempotencyKey: `milestone-${order.contractMilestoneId}-pay` });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'captured', capturedAt: now } });

      // Leggi invoice PRIMA dell'upsert del payout, per avere withholdingAmountEur.
      const invoice = await tx.invoice.findFirst({
        where: { paymentOrderId: order.id },
        orderBy: { issuedAt: 'desc' }
      });

      if (worker) {
        await tx.payout.upsert({
          where: { paymentOrderId: order.id },
          create: {
            paymentOrderId: order.id,
            workerProfileId: worker.id,
            payoutAmountEur: order.payoutAmountEur,
            withholdingAmountEur: (invoice && invoice.withholdingAmountEur) || 0,
            status: 'released',
            releasedAt: now
          },
          update: {
            withholdingAmountEur: (invoice && invoice.withholdingAmountEur) || 0,
            status: 'released',
            releasedAt: now
          }
        });
      }

      await tx.invoice.updateMany({ where: { paymentOrderId: order.id }, data: { invoiceStatus: 'paid', paidAt: now } });
      await tx.contractMilestone.update({ where: { id: order.contractMilestoneId }, data: { status: 'paid' } });

      // EscrowLedger: 'capture' usa totalDueEur (quello che e entrato dal ristorante),
      // fallback a amountTotalEur per ordini legacy pre-sub-2.
      const entries = [
        { paymentOrderId: order.id, entryType: 'capture',       amountEur: order.totalDueEur != null ? order.totalDueEur : order.amountTotalEur, metadata: {} },
        { paymentOrderId: order.id, entryType: 'platform_fee',  amountEur: order.platformFeeEur, metadata: {} },
        { paymentOrderId: order.id, entryType: 'worker_payout', amountEur: order.payoutAmountEur, metadata: {} }
      ];
      if (invoice && invoice.withholdingAmountEur > 0) {
        entries.push({
          paymentOrderId: order.id,
          entryType: 'withholding_reported',
          amountEur: invoice.withholdingAmountEur,
          metadata: { regime: invoice.taxRegimeSnapshot, sostituto: 'restaurant' }
        });
      }
      await tx.escrowLedger.createMany({ data: entries });

      return order.id;
    }, { timeout: 30000, maxWait: 10000 });
    results.push(result);
  }
  return results;
}

function startPaymentAgentScheduler(prisma, options = {}) {
  const intervalMs = Math.max(60000, Number(options.intervalMs || 3600000));

  const timer = setInterval(async () => {
    try {
      await runMonthlyBillingCycle(prisma);
      await captureDuePaymentOrders(prisma);
    } catch (error) {
      console.error('[payment-agent] scheduler error:', error.message);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

module.exports = {
  buildMonthlyMilestones,
  calculateDueDate,
  normalizePaymentTermsDays,
  normalizePaymentTermsBase,
  paymentTermsDaysToNumber,
  buildStripeConnectPayload,
  runMonthlyBillingCycle,
  captureDuePaymentOrders,
  startPaymentAgentScheduler
};
