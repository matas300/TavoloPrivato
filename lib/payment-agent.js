const { endOfMonth } = require('./compliance-agent');

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
    : money((Number(input.grossAmountEur) || 0) / spans.length);
  const totalGross = input.grossAmountEur
    ? money(input.grossAmountEur)
    : money(monthlyGross * spans.length);
  const platformFeePct = Number(input.platformFeePct || 0);
  const presetPlatformFee = input.platformFeeEur == null ? null : money(input.platformFeeEur);

  let allocatedGross = 0;
  let allocatedFee = 0;

  return spans.map((span, index) => {
    const isLast = index === spans.length - 1;
    const grossAmountEur = isLast
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
          : grossAmountEur * platformFeePct / 100
      );
    const workerNetEur = money(grossAmountEur - platformFeeEur);
    const invoiceDate = span.end;
    const dueDate = calculateDueDate(invoiceDate, input.paymentTermsDays, input.paymentTermsBase);

    allocatedGross += grossAmountEur;
    allocatedFee += platformFeeEur;

    return {
      sequence: index + 1,
      milestoneLabel: `Corrispettivo ${monthLabel(span.start)}`,
      periodStart: span.start,
      periodEnd: span.end,
      invoiceDate,
      dueDate,
      grossAmountEur,
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
  const existingOrder = await prisma.paymentOrder.findFirst({
    where: {
      contractMilestoneId: milestone.id
    }
  });

  if (existingOrder) {
    return null;
  }

  const contract = await prisma.serviceContract.findUnique({
    where: { id: milestone.serviceContractId },
    include: {
      restaurantProfile: {
        include: {
          organization: true
        }
      },
      workerProfile: true
    }
  });

  const paymentOrder = await prisma.paymentOrder.create({
    data: {
      serviceContractId: contract.id,
      contractMilestoneId: milestone.id,
      provider: 'stripe_connect',
      providerInvoiceId: `in_demo_${contract.id}_${milestone.sequence}`,
      amountTotalEur: milestone.grossAmountEur,
      platformFeeEur: milestone.platformFeeEur,
      payoutAmountEur: milestone.workerNetEur,
      status: 'created',
      scheduledCaptureAt: milestone.dueDate,
      dueDate: milestone.dueDate
    }
  });

  const stripePayload = buildStripeConnectPayload({
    paymentOrder,
    milestone,
    contract,
    restaurantProfile: contract.restaurantProfile,
    workerProfile: contract.workerProfile
  });

  const invoice = await prisma.invoice.create({
    data: {
      paymentOrderId: paymentOrder.id,
      serviceContractId: contract.id,
      contractMilestoneId: milestone.id,
      invoiceType: 'contract_milestone',
      externalNumber: `INV-CONTRACT-${contract.id}-${milestone.sequence}`,
      providerInvoiceId: paymentOrder.providerInvoiceId,
      invoiceStatus: milestone.dueDate <= asOfDate ? 'open' : 'draft',
      amountEur: milestone.grossAmountEur,
      issuedAt: asOfDate,
      dueDate: milestone.dueDate,
      pdfUrl: contract.pdfUrl,
      paymentTermsDays: contract.paymentTermsDays,
      paymentTermsBase: contract.paymentTermsBase
    }
  });

  await prisma.contractMilestone.update({
    where: { id: milestone.id },
    data: {
      status: milestone.dueDate <= asOfDate ? 'processing' : 'invoiced',
      providerInvoiceId: paymentOrder.providerInvoiceId
    }
  });

  await prisma.auditLog.create({
    data: {
      actorEmail: 'payment-agent@system',
      actionKey: 'payment_schedule_generated',
      targetTable: 'ContractMilestone',
      targetId: String(milestone.id),
      contextPayload: {
        contractId: contract.id,
        milestoneId: milestone.id,
        dueDate: milestone.dueDate.toISOString(),
        stripePayload
      }
    }
  });

  return {
    paymentOrder,
    invoice
  };
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

  for (const milestone of milestones) {
    const result = await createBillingArtifactsForMilestone(prisma, milestone, asOfDate);
    if (result) {
      created.push(result);
    }
  }

  return {
    asOfDate,
    createdCount: created.length,
    created
  };
}

async function captureDuePaymentOrders(prisma, options = {}) {
  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
  const paymentOrders = await prisma.paymentOrder.findMany({
    where: {
      status: {
        in: ['created', 'authorized']
      },
      dueDate: {
        lte: asOfDate
      }
    },
    include: {
      contractMilestone: true,
      serviceContract: true,
      payout: true,
      invoices: true
    },
    orderBy: {
      dueDate: 'asc'
    }
  });

  const captured = [];

  for (const paymentOrder of paymentOrders) {
    const contract = paymentOrder.serviceContract;
    const milestone = paymentOrder.contractMilestone;

    await prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: 'captured',
        capturedAt: asOfDate,
        providerPaymentIntentId: paymentOrder.providerPaymentIntentId || `pi_contract_${contract.id}_${milestone.sequence}`
      }
    });

    if (!paymentOrder.payout) {
      await prisma.payout.create({
        data: {
          paymentOrderId: paymentOrder.id,
          workerProfileId: contract.workerProfileId,
          payoutAmountEur: paymentOrder.payoutAmountEur,
          status: 'released',
          releasedAt: asOfDate
        }
      });
    } else {
      await prisma.payout.update({
        where: { paymentOrderId: paymentOrder.id },
        data: {
          status: 'released',
          releasedAt: asOfDate
        }
      });
    }

    const existingLedger = await prisma.escrowLedger.count({
      where: {
        paymentOrderId: paymentOrder.id
      }
    });

    if (!existingLedger) {
      await prisma.escrowLedger.createMany({
        data: [
          {
            paymentOrderId: paymentOrder.id,
            entryType: 'capture',
            amountEur: paymentOrder.amountTotalEur,
            metadata: {
              contractId: contract.id,
              milestoneId: milestone.id
            }
          },
          {
            paymentOrderId: paymentOrder.id,
            entryType: 'platform_fee',
            amountEur: paymentOrder.platformFeeEur,
            metadata: {
              contractId: contract.id,
              milestoneId: milestone.id
            }
          },
          {
            paymentOrderId: paymentOrder.id,
            entryType: 'worker_payout',
            amountEur: paymentOrder.payoutAmountEur,
            metadata: {
              contractId: contract.id,
              milestoneId: milestone.id
            }
          }
        ]
      });
    }

    await prisma.invoice.updateMany({
      where: {
        paymentOrderId: paymentOrder.id
      },
      data: {
        invoiceStatus: 'paid',
        paidAt: asOfDate
      }
    });

    await prisma.contractMilestone.update({
      where: { id: milestone.id },
      data: {
        status: 'paid'
      }
    });

    captured.push(paymentOrder.id);
  }

  return {
    asOfDate,
    capturedCount: captured.length,
    paymentOrderIds: captured
  };
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
