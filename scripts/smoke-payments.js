#!/usr/bin/env node
// Smoke payments end-to-end: seed fixture → billing cycle → capture → asserzioni.
// Zero framework. Exit 0 se tutto passa, 1 se fallisce, 2 se Prisma non disponibile.

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

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) {
    console.error('prisma_unavailable: configurare DATABASE_URL + npx prisma generate');
    process.exit(2);
  }

  // 1) Trovare un contratto long_term esistente, altrimenti fallire con messaggio chiaro.
  const contract = await prisma.serviceContract.findFirst({
    where: { engagementType: 'long_term' },
    include: { workerProfile: true, restaurantProfile: true, milestones: true }
  });
  if (!contract) {
    console.error('Nessun ServiceContract long_term trovato. Eseguire: npm run db:seed');
    process.exit(1);
  }
  record('fixture: trovato contratto long_term', true, `id=${contract.id}`);

  const stripe = getStripe();

  // 2) Assicurare stripeAccountId su worker e stripeCustomerId su restaurant.
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

  // 3) Assicurare un BankAccount primary per il worker.
  let primary = await bankAccountService.getPrimary('worker', contract.workerProfile.id);
  if (!primary) {
    const created = await bankAccountService.createForOwner('worker', contract.workerProfile.id, {
      iban: 'IT60X0542811101000000123456',
      holderName: contract.workerProfile.displayName || 'Worker Test',
      holderFiscalCode: 'RSSMRA80A01H501U'
    });
    if (!created.ok) {
      console.error('createForOwner fallita', created.errors);
      process.exit(1);
    }
    primary = created.bankAccount;
  }
  record('worker: primary bank account presente', !!primary, primary && primary.iban);

  // 4) Run billing cycle in modo che almeno la prima milestone sia dovuta.
  const firstMilestone = contract.milestones.sort((a, b) => a.sequence - b.sequence)[0];
  if (!firstMilestone) {
    console.error('Contratto senza milestone: eseguire seed completo');
    process.exit(1);
  }
  const asOf = new Date(firstMilestone.invoiceDate);
  await runMonthlyBillingCycle(prisma, { asOfDate: asOf });
  record('billing cycle eseguito', true, `asOf=${asOf.toISOString().slice(0, 10)}`);

  const order = await prisma.paymentOrder.findFirst({ where: { contractMilestoneId: firstMilestone.id } });
  record('PaymentOrder creato', !!order, order && `status=${order.status} pi=${order.providerPaymentIntentId}`);
  record('PaymentOrder ha ID Stripe mock', !!(order && order.providerPaymentIntentId && order.providerPaymentIntentId.startsWith('pi_mock_')), order && order.providerPaymentIntentId);

  // 5) Capture.
  const captureAt = new Date(firstMilestone.dueDate || firstMilestone.invoiceDate);
  captureAt.setDate(captureAt.getDate() + 1);
  await captureDuePaymentOrders(prisma, { now: captureAt });
  record('capture eseguito', true, `now=${captureAt.toISOString().slice(0, 10)}`);

  const orderAfter = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
  record('PaymentOrder.status === captured', orderAfter && orderAfter.status === 'captured', orderAfter && orderAfter.status);

  const invoice = await prisma.invoice.findFirst({ where: { paymentOrderId: order.id } });
  record('Invoice.invoiceStatus === paid', invoice && invoice.invoiceStatus === 'paid', invoice && invoice.invoiceStatus);

  const payout = await prisma.payout.findFirst({ where: { paymentOrderId: order.id } });
  record('Payout.status === released', payout && payout.status === 'released', payout && payout.status);

  const milestoneAfter = await prisma.contractMilestone.findUnique({ where: { id: firstMilestone.id } });
  record('ContractMilestone.status === paid', milestoneAfter && milestoneAfter.status === 'paid', milestoneAfter && milestoneAfter.status);

  const ledger = await prisma.escrowLedger.count({ where: { paymentOrderId: order.id } });
  record('EscrowLedger ha 3 voci', ledger === 3, `count=${ledger}`);

  const events = await prisma.stripeEvent.count();
  record('StripeEvent count >= 5', events >= 5, `count=${events}`);

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passati`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
