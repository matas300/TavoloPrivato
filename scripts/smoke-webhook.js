#!/usr/bin/env node
// Smoke webhook end-to-end: usa i fixture smoke-payments per generare
// StripeEvent (inclusi 2 withholding.reported), poi processa e asserisce.

require('dotenv').config();

const { getPrismaClient } = require('../lib/prisma');
const { getStripe } = require('../lib/stripe');
const bankAccountService = require('../data/bank-account-service');
const {
  runMonthlyBillingCycle,
  captureDuePaymentOrders
} = require('../lib/payment-agent');
const {
  processEvent, processPending, processPendingRetry
} = require('../lib/webhook-processor');

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '\u2713' : '\u2717'} ${name}${detail ? ' -- ' + detail : ''}`);
}

async function setupFixture(prisma, stripe) {
  const contract = await prisma.serviceContract.findFirst({
    where: { engagementType: 'long_term' },
    include: { workerProfile: true, restaurantProfile: true }
  });
  if (!contract) { console.error('seed mancante'); process.exit(1); }
  if (!contract.workerProfile.stripeAccountId) {
    const acct = await stripe.accounts.create({ type: 'express', country: 'IT' });
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { stripeAccountId: acct.id } });
    contract.workerProfile.stripeAccountId = acct.id;
  }
  if (!contract.restaurantProfile.stripeCustomerId) {
    const cus = await stripe.customers.create({ name: contract.restaurantProfile.displayName || 'Ristorante' });
    await prisma.restaurantProfile.update({ where: { id: contract.restaurantProfile.id }, data: { stripeCustomerId: cus.id } });
    contract.restaurantProfile.stripeCustomerId = cus.id;
  }
  let primary = await bankAccountService.getPrimary('worker', contract.workerProfile.id);
  if (!primary) {
    const c = await bankAccountService.createForOwner('worker', contract.workerProfile.id, {
      iban: 'IT60X0542811101000000123456',
      holderName: 'Worker Test',
      holderFiscalCode: 'RSSMRA80A01H501U'
    });
    primary = c.bankAccount;
  }
  return contract;
}

async function createMilestone(prisma, contract, sequence, y, m, d) {
  return prisma.contractMilestone.create({
    data: {
      serviceContractId: contract.id,
      sequence,
      milestoneLabel: `WEBHOOK SMOKE seq ${sequence}`,
      periodStart: new Date(y, m - 1, d),
      periodEnd: new Date(y, m - 1, d),
      invoiceDate: new Date(y, m - 1, d),
      dueDate: new Date(y, m - 1, d + 7),
      taxableAmountEur: 1000,
      platformFeeEur: 100,
      workerNetEur: 900,
      status: 'planned'
    }
  });
}

async function cleanup(prisma, milestoneIds) {
  for (const id of milestoneIds) {
    const orders = await prisma.paymentOrder.findMany({ where: { contractMilestoneId: id } });
    for (const o of orders) {
      await prisma.escrowLedger.deleteMany({ where: { paymentOrderId: o.id } });
      await prisma.payout.deleteMany({ where: { paymentOrderId: o.id } });
      await prisma.invoice.deleteMany({ where: { paymentOrderId: o.id } });
    }
    await prisma.paymentOrder.deleteMany({ where: { contractMilestoneId: id } });
    await prisma.contractMilestone.deleteMany({ where: { id } });
  }
}

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) { console.error('prisma_unavailable'); process.exit(2); }
  const stripe = getStripe();

  // Cleanup residui da smoke precedenti: StripeEvent non-processed (pending/failed/dead)
  // possono restare orfani da smoke-payments (invoice cancellata ma event no) e inquinare
  // il replay check. Non tocchiamo status=processed (append-only storico).
  await prisma.stripeEvent.deleteMany({ where: { status: { in: ['pending', 'failed', 'dead'] } } });

  const contract = await setupFixture(prisma, stripe);
  const originalTaxMode = contract.workerProfile.taxMode;
  const milestoneIds = [];

  try {
    // Crea 2 milestone: una auth_occ, una P.IVA ord. Entrambe genereranno 'withholding.reported'.
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { taxMode: 'autonomo_occasionale' } });
    const ms1 = await createMilestone(prisma, contract, 200, 2027, 3, 10);
    milestoneIds.push(ms1.id);
    await runMonthlyBillingCycle(prisma, { asOfDate: new Date(2027, 2, 15) });
    await captureDuePaymentOrders(prisma, { now: new Date(2027, 2, 20) });

    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { taxMode: 'partita_iva_ordinaria' } });
    const ms2 = await createMilestone(prisma, contract, 201, 2027, 3, 11);
    milestoneIds.push(ms2.id);
    await runMonthlyBillingCycle(prisma, { asOfDate: new Date(2027, 2, 15) });
    await captureDuePaymentOrders(prisma, { now: new Date(2027, 2, 20) });

    // 1) Counts prima del processing.
    const preStats = {
      pending: await prisma.stripeEvent.count({ where: { status: 'pending' } }),
      processed: await prisma.stripeEvent.count({ where: { status: 'processed' } }),
    };
    record('fixture: StripeEvent pending > 0', preStats.pending > 0, `pending=${preStats.pending}`);
    const whEventsBefore = await prisma.stripeEvent.count({ where: { eventType: 'withholding.reported', status: 'pending' } });
    record('fixture: withholding.reported pending >= 2', whEventsBefore >= 2, `count=${whEventsBefore}`);

    // 2) Process batch
    const batch = await processPending(prisma, { limit: 1000 });
    record('batch: processed > 0', batch.processed > 0, `processed=${batch.processed}`);
    record('batch: dead === 0', batch.dead === 0, `dead=${batch.dead}`);

    // 3) Tutti i withholding.reported ora processed
    const whProcessed = await prisma.stripeEvent.count({ where: { eventType: 'withholding.reported', status: 'processed' } });
    record('tutti withholding.reported processed', whProcessed >= 2, `count=${whProcessed}`);
    const pendingAfter = await prisma.stripeEvent.count({ where: { status: 'pending' } });
    record('no pending residui post-batch', pendingAfter === 0, `pending=${pendingAfter}`);

    // 4) WithholdingAccrual: 2 record creati (stesso ristorante+worker+anno+mese ma regimi diversi)
    const accruals = await prisma.withholdingAccrual.findMany({
      where: { workerProfileId: contract.workerProfile.id, periodYear: 2027, periodMonth: 3 }
    });
    record('WithholdingAccrual count === 2', accruals.length === 2, `count=${accruals.length}`);

    const authOcc = accruals.find(a => a.taxRegimeSnapshot === 'autonomo_occasionale');
    record('accrual auth_occ: totalAmountEur === 200', !!authOcc && authOcc.totalAmountEur === 200, authOcc && String(authOcc.totalAmountEur));
    record('accrual auth_occ: invoiceCount === 1', !!authOcc && authOcc.invoiceCount === 1, authOcc && String(authOcc.invoiceCount));
    const pIva = accruals.find(a => a.taxRegimeSnapshot === 'partita_iva_ordinaria');
    record('accrual P.IVA: totalAmountEur === 200', !!pIva && pIva.totalAmountEur === 200, pIva && String(pIva.totalAmountEur));

    // 5) Ri-eseguire processPending e' no-op
    const rerun = await processPending(prisma, { limit: 1000 });
    record('replay: total === 0', rerun.total === 0, `total=${rerun.total}`);

    // 6) processEvent diretto su evento gia processed → already_processed
    const oneProcessed = await prisma.stripeEvent.findFirst({ where: { eventType: 'withholding.reported', status: 'processed' } });
    const replayResult = await processEvent(prisma, oneProcessed);
    record('processEvent su processed → already_processed', replayResult.status === 'already_processed', replayResult.status);

    // 7) Test event type unknown + retry/DLQ
    const unknownEvent = await prisma.stripeEvent.create({
      data: {
        providerEventId: `evt_mock_test_unknown_${Date.now()}`,
        eventType: 'test.totally_unknown',
        payload: { foo: 'bar' },
        status: 'pending',
      }
    });
    // Retry 1 → failed
    const r1 = await processEvent(prisma, unknownEvent, { maxRetries: 3 });
    record('unknown event: 1st attempt → failed', r1.status === 'failed', `status=${r1.status} rc=?`);
    const afterR1 = await prisma.stripeEvent.findUnique({ where: { id: unknownEvent.id } });
    record('unknown event: retryCount === 1', afterR1.retryCount === 1, `rc=${afterR1.retryCount}`);
    // Retry 2 → failed
    await processEvent(prisma, afterR1, { maxRetries: 3 });
    const afterR2 = await prisma.stripeEvent.findUnique({ where: { id: unknownEvent.id } });
    record('unknown event: retryCount === 2', afterR2.retryCount === 2 && afterR2.status === 'failed', `rc=${afterR2.retryCount} status=${afterR2.status}`);
    // Retry 3 → dead
    await processEvent(prisma, afterR2, { maxRetries: 3 });
    const afterR3 = await prisma.stripeEvent.findUnique({ where: { id: unknownEvent.id } });
    record('unknown event: 3rd attempt → dead', afterR3.status === 'dead' && afterR3.retryCount === 3, `status=${afterR3.status} rc=${afterR3.retryCount}`);

    // 8) processPendingRetry NON ri-prende i dead
    const retryResult = await processPendingRetry(prisma, { limit: 100 });
    const deadInRetry = retryResult.results.find(r => r.eventId === unknownEvent.id);
    record('processPendingRetry esclude dead', !deadInRetry, deadInRetry ? 'ERRATO' : 'ok');

    // Cleanup unknown event.
    await prisma.stripeEvent.delete({ where: { id: unknownEvent.id } });

    // 9) Cleanup accruals di test (altrimenti inquinano il DB)
    await prisma.withholdingAccrual.deleteMany({
      where: { workerProfileId: contract.workerProfile.id, periodYear: 2027, periodMonth: 3 }
    });
  } finally {
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { taxMode: originalTaxMode } });
    await cleanup(prisma, milestoneIds);
  }

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passati`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Errore fatale:', err); process.exit(1); });
