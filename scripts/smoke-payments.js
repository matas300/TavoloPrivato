#!/usr/bin/env node
// Smoke payments end-to-end sub-2: 4 scenari fiscali + scenario skip.
// Zero framework. Exit 0 se tutto passa, 1 se fallisce, 2 se Prisma non disponibile.
//
// Scenari:
//   S1 forfettario          → withholding=0, totalDue=taxable, net=taxable-fee
//   S2 autonomo_occasionale → withholding=20%, totalDue=taxable-wh, net=totalDue-fee
//   S3 partita_iva_ordinaria→ stessi numeri di S2 (IVA arriva in sub-6), regime diverso
//   S4 unknown              → skip della milestone, nessun PaymentOrder, report.skipped>=1

require('dotenv').config();

const { getPrismaClient } = require('../lib/prisma');
const { getStripe } = require('../lib/stripe');
const bankAccountService = require('../data/bank-account-service');
const {
  runMonthlyBillingCycle,
  captureDuePaymentOrders
} = require('../lib/payment-agent');

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '\u2713' : '\u2717'} ${name}${detail ? ' -- ' + detail : ''}`);
}

// Fixture di test: taxable=1000, platformFee=100 per rendere la matrice attesa deterministica.
const FIXTURE_TAXABLE = 1000;
const FIXTURE_FEE = 100;
const FIXTURE_WORKER_NET = 900; // = taxable - fee, legacy field (non piu usato post-sub-2 per il calcolo finale)

async function setupBaselineFixtures(prisma, stripe) {
  // Trova un contratto long_term esistente — lo useremo per tutti gli scenari cambiando
  // il taxMode del suo workerProfile e creando milestone fresh di sequence >=100.
  const contract = await prisma.serviceContract.findFirst({
    where: { engagementType: 'long_term' },
    include: { workerProfile: true, restaurantProfile: true }
  });
  if (!contract) {
    console.error('Nessun ServiceContract long_term trovato. Eseguire: npm run db:seed');
    process.exit(1);
  }
  record('fixture: trovato contratto long_term', true, `id=${contract.id}`);

  // Assicura stripeAccountId / stripeCustomerId.
  if (!contract.workerProfile.stripeAccountId) {
    const acct = await stripe.accounts.create({ type: 'express', country: 'IT' });
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { stripeAccountId: acct.id } });
    contract.workerProfile.stripeAccountId = acct.id;
  }
  record('worker: stripeAccountId presente', !!contract.workerProfile.stripeAccountId, contract.workerProfile.stripeAccountId);

  if (!contract.restaurantProfile.stripeCustomerId) {
    const cus = await stripe.customers.create({ name: contract.restaurantProfile.displayName || 'Ristorante' });
    await prisma.restaurantProfile.update({ where: { id: contract.restaurantProfile.id }, data: { stripeCustomerId: cus.id } });
    contract.restaurantProfile.stripeCustomerId = cus.id;
  }
  record('restaurant: stripeCustomerId presente', !!contract.restaurantProfile.stripeCustomerId, contract.restaurantProfile.stripeCustomerId);

  // Assicura un primary bank account.
  let primary = await bankAccountService.getPrimary('worker', contract.workerProfile.id);
  if (!primary) {
    const created = await bankAccountService.createForOwner('worker', contract.workerProfile.id, {
      iban: 'IT60X0542811101000000123456',
      holderName: contract.workerProfile.displayName || 'Worker Test',
      holderFiscalCode: 'RSSMRA80A01H501U'
    });
    if (!created.ok) { console.error('createForOwner fallita', created.errors); process.exit(1); }
    primary = created.bankAccount;
  }
  record('worker: primary bank account presente', !!primary, primary && primary.iban);

  return contract;
}

async function createFreshMilestone(prisma, contract, sequence, invoiceDateIso, dueDateIso) {
  return prisma.contractMilestone.create({
    data: {
      serviceContractId: contract.id,
      sequence,
      milestoneLabel: `SMOKE sub-2 seq ${sequence}`,
      periodStart: new Date(invoiceDateIso),
      periodEnd: new Date(invoiceDateIso),
      invoiceDate: new Date(invoiceDateIso),
      dueDate: new Date(dueDateIso),
      taxableAmountEur: FIXTURE_TAXABLE,
      platformFeeEur: FIXTURE_FEE,
      workerNetEur: FIXTURE_WORKER_NET,
      status: 'planned'
    }
  });
}

async function cleanupMilestoneArtifacts(prisma, milestoneId) {
  const orders = await prisma.paymentOrder.findMany({ where: { contractMilestoneId: milestoneId } });
  for (const o of orders) {
    await prisma.escrowLedger.deleteMany({ where: { paymentOrderId: o.id } });
    await prisma.payout.deleteMany({ where: { paymentOrderId: o.id } });
    await prisma.invoice.deleteMany({ where: { paymentOrderId: o.id } });
  }
  await prisma.paymentOrder.deleteMany({ where: { contractMilestoneId: milestoneId } });
  await prisma.contractMilestone.delete({ where: { id: milestoneId } });
}

async function runHappyScenario(prisma, contract, { label, taxMode, sequence, expected }) {
  // Setta taxMode sul workerProfile.
  await prisma.workerProfile.update({
    where: { id: contract.workerProfile.id },
    data: { taxMode }
  });

  // Crea milestone fresh.
  const iso = (d) => d.toISOString();
  const invoiceDate = new Date(2027, 0, sequence - 99); // 2027-01-01, 02, 03...
  const dueDate = new Date(2027, 0, sequence - 99 + 7);
  const milestone = await createFreshMilestone(prisma, contract, sequence, iso(invoiceDate), iso(dueDate));

  // Cycle.
  const asOf = new Date(invoiceDate.getTime() + 24 * 3600 * 1000);
  const cycleReport = await runMonthlyBillingCycle(prisma, { asOfDate: asOf });
  record(`[${label}] cycle skippedCount === 0`, cycleReport.skippedCount === 0, `skipped=${cycleReport.skippedCount}`);

  // Capture.
  const captureAt = new Date(dueDate.getTime() + 24 * 3600 * 1000);
  await captureDuePaymentOrders(prisma, { now: captureAt });

  // Asserzioni su Invoice.
  const invoice = await prisma.invoice.findFirst({ where: { contractMilestoneId: milestone.id } });
  record(`[${label}] Invoice creata`, !!invoice, invoice && `id=${invoice.id}`);
  record(`[${label}] Invoice.taxRegimeSnapshot === ${taxMode}`, invoice && invoice.taxRegimeSnapshot === taxMode, invoice && invoice.taxRegimeSnapshot);
  record(`[${label}] Invoice.withholdingAmountEur === ${expected.withholding}`, invoice && invoice.withholdingAmountEur === expected.withholding, invoice && String(invoice.withholdingAmountEur));
  record(`[${label}] Invoice.totalDueEur === ${expected.totalDue}`, invoice && invoice.totalDueEur === expected.totalDue, invoice && String(invoice.totalDueEur));
  record(`[${label}] Invoice.netToWorkerEur === ${expected.netToWorker}`, invoice && invoice.netToWorkerEur === expected.netToWorker, invoice && String(invoice.netToWorkerEur));

  // Asserzioni su Payout.
  const payout = await prisma.payout.findFirst({ where: { paymentOrder: { contractMilestoneId: milestone.id } } });
  record(`[${label}] Payout.payoutAmountEur === ${expected.netToWorker}`, payout && payout.payoutAmountEur === expected.netToWorker, payout && String(payout.payoutAmountEur));
  record(`[${label}] Payout.withholdingAmountEur === ${expected.withholding}`, payout && payout.withholdingAmountEur === expected.withholding, payout && String(payout.withholdingAmountEur));

  // Asserzioni su EscrowLedger.
  const ledger = await prisma.escrowLedger.findMany({ where: { paymentOrder: { contractMilestoneId: milestone.id } } });
  const expectedEntries = expected.withholding > 0 ? 4 : 3;
  record(`[${label}] EscrowLedger entries === ${expectedEntries}`, ledger.length === expectedEntries, `count=${ledger.length}`);
  if (expected.withholding > 0) {
    const wh = ledger.find(e => e.entryType === 'withholding_reported');
    record(`[${label}] EscrowLedger withholding_reported presente`, !!wh, wh && `amt=${wh.amountEur}`);
  }

  // Asserzione StripeEvent withholding.reported (specifico per questo scenario).
  const whEvent = await prisma.stripeEvent.findFirst({
    where: {
      eventType: 'withholding.reported',
      providerEventId: `evt_mock_milestone-${milestone.id}-withholding`
    }
  });
  if (expected.withholding > 0) {
    record(`[${label}] StripeEvent withholding.reported presente`, !!whEvent, whEvent && whEvent.providerEventId);
  } else {
    record(`[${label}] StripeEvent withholding.reported ASSENTE`, !whEvent, whEvent ? 'TROVATO (non atteso)' : 'nessuno (corretto)');
  }

  // Cleanup artifacts per questo scenario.
  await cleanupMilestoneArtifacts(prisma, milestone.id);
}

async function runUnknownScenario(prisma, contract) {
  const label = 'S4 unknown';
  const sequence = 104;

  // Setta taxMode=unknown.
  await prisma.workerProfile.update({
    where: { id: contract.workerProfile.id },
    data: { taxMode: 'unknown' }
  });

  const iso = (d) => d.toISOString();
  const invoiceDate = new Date(2027, 0, 5);
  const dueDate = new Date(2027, 0, 12);
  const milestone = await createFreshMilestone(prisma, contract, sequence, iso(invoiceDate), iso(dueDate));

  const asOf = new Date(invoiceDate.getTime() + 24 * 3600 * 1000);
  let threw = null;
  let report = null;
  try {
    report = await runMonthlyBillingCycle(prisma, { asOfDate: asOf });
  } catch (e) { threw = e; }

  record(`[${label}] cycle non alza eccezioni`, !threw, threw ? threw.message : 'ok');
  record(`[${label}] report.skippedCount >= 1`, report && report.skippedCount >= 1, report && `skipped=${report.skippedCount}`);
  const skipHit = report && report.skipped.find(s => s.milestoneId === milestone.id);
  record(`[${label}] skip include milestone nostra`, !!skipHit, skipHit && JSON.stringify(skipHit));
  record(`[${label}] skip.reason === TAX_MODE_UNKNOWN`, skipHit && skipHit.reason === 'TAX_MODE_UNKNOWN', skipHit && skipHit.reason);

  // Milestone resta planned.
  const ms = await prisma.contractMilestone.findUnique({ where: { id: milestone.id } });
  record(`[${label}] milestone resta status=planned`, ms && ms.status === 'planned', ms && ms.status);

  // Nessun PaymentOrder creato.
  const po = await prisma.paymentOrder.findFirst({ where: { contractMilestoneId: milestone.id } });
  record(`[${label}] nessun PaymentOrder creato`, !po, po ? `TROVATO id=${po.id}` : 'nessuno (corretto)');

  // Cleanup: la milestone non ha artifacts da rimuovere.
  await prisma.contractMilestone.delete({ where: { id: milestone.id } });
}

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) {
    console.error('prisma_unavailable: configurare DATABASE_URL + npx prisma generate');
    process.exit(2);
  }
  const stripe = getStripe();

  // Salva il taxMode originale del worker per ripristinarlo a fine smoke.
  const contract = await setupBaselineFixtures(prisma, stripe);
  const originalTaxMode = contract.workerProfile.taxMode;

  try {
    // S1 — forfettario
    await runHappyScenario(prisma, contract, {
      label: 'S1 forfettario',
      taxMode: 'forfettario',
      sequence: 100,
      expected: { withholding: 0, totalDue: 1000, netToWorker: 900 }
    });

    // S2 — autonomo_occasionale
    await runHappyScenario(prisma, contract, {
      label: 'S2 auth_occ',
      taxMode: 'autonomo_occasionale',
      sequence: 101,
      expected: { withholding: 200, totalDue: 800, netToWorker: 700 }
    });

    // S3 — partita_iva_ordinaria (stessi numeri di S2 in sub-2, IVA arriva in sub-6)
    await runHappyScenario(prisma, contract, {
      label: 'S3 P.IVA ord',
      taxMode: 'partita_iva_ordinaria',
      sequence: 102,
      expected: { withholding: 200, totalDue: 800, netToWorker: 700 }
    });

    // S4 — unknown skip
    await runUnknownScenario(prisma, contract);

    // StripeEvent aggregate sanity.
    const events = await prisma.stripeEvent.count();
    record('StripeEvent count totale >= 10', events >= 10, `count=${events}`);
  } finally {
    // Ripristina taxMode originale del worker per non "inquinare" il DB per la prossima run.
    await prisma.workerProfile.update({
      where: { id: contract.workerProfile.id },
      data: { taxMode: originalTaxMode }
    });
  }

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passati`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
