require('dotenv').config();
const { getPrismaClient } = require('../lib/prisma');
const { runMonthlyBillingCycle, captureDuePaymentOrders } = require('../lib/payment-agent');

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error('DATABASE_URL non configurato.');
  }

  const asOfDate = process.argv[2] || new Date().toISOString();
  const billing = await runMonthlyBillingCycle(prisma, { asOfDate });
  const captures = await captureDuePaymentOrders(prisma, { asOfDate });

  console.log(JSON.stringify({
    ok: true,
    asOfDate,
    billing: {
      createdCount: billing.createdCount
    },
    captures: {
      capturedCount: captures.capturedCount
    }
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error.message);
    process.exit(1);
  });
