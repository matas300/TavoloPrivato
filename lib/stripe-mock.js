// Mockup Stripe SDK: forma di risposta aderente al vero SDK.
// Scrive StripeEvent su DB per ogni chiamata side-effect.
// Idempotenza: Map<idempotencyKey, response> in-process + fallback DB.

const crypto = require('crypto');
const { getPrismaClient } = require('./prisma');

const idempotencyCache = new Map();

function mockId(prefix) {
  return `${prefix}_mock_${crypto.randomBytes(12).toString('hex')}`;
}

function nowIsoSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function writeEvent(eventType, payload) {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  const providerEventId = `evt_mock_${crypto.randomBytes(12).toString('hex')}`;
  await prisma.stripeEvent.create({
    data: { providerEventId, eventType, payload, status: 'pending' }
  });
  return providerEventId;
}

async function withIdempotency(options, factory) {
  const key = options && options.idempotencyKey;
  if (!key) return factory();
  if (idempotencyCache.has(key)) return idempotencyCache.get(key);
  const result = await factory();
  idempotencyCache.set(key, result);
  return result;
}

const paymentIntents = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('pi');
      const intent = {
        id,
        object: 'payment_intent',
        amount: params.amount,
        currency: params.currency || 'eur',
        status: 'requires_capture',
        application_fee_amount: params.application_fee_amount || 0,
        transfer_data: params.transfer_data || null,
        transfer_group: params.transfer_group || null,
        metadata: params.metadata || {},
        created: nowIsoSeconds()
      };
      await writeEvent('payment_intent.created', intent);
      return intent;
    });
  },
  async capture(id, options) {
    return withIdempotency(options, async () => {
      const intent = {
        id,
        object: 'payment_intent',
        status: 'succeeded',
        captured: true,
        captured_at: nowIsoSeconds()
      };
      await writeEvent('payment_intent.succeeded', intent);
      return intent;
    });
  },
  async retrieve(id) {
    return { id, object: 'payment_intent', status: 'succeeded' };
  }
};

const invoices = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('in');
      const invoice = {
        id,
        object: 'invoice',
        customer: params.customer || null,
        amount_due: params.amount_due || 0,
        currency: params.currency || 'eur',
        status: 'draft',
        due_date: params.due_date || null,
        metadata: params.metadata || {}
      };
      await writeEvent('invoice.created', invoice);
      return invoice;
    });
  },
  async finalizeInvoice(id, options) {
    return withIdempotency(options, async () => {
      const invoice = { id, object: 'invoice', status: 'open' };
      await writeEvent('invoice.finalized', invoice);
      return invoice;
    });
  },
  async pay(id, options) {
    return withIdempotency(options, async () => {
      const invoice = { id, object: 'invoice', status: 'paid', paid_at: nowIsoSeconds() };
      await writeEvent('invoice.paid', invoice);
      return invoice;
    });
  }
};

const transfers = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('tr');
      const transfer = {
        id,
        object: 'transfer',
        amount: params.amount,
        currency: params.currency || 'eur',
        destination: params.destination,
        transfer_group: params.transfer_group || null,
        metadata: params.metadata || {},
        created: nowIsoSeconds()
      };
      await writeEvent('transfer.created', transfer);
      return transfer;
    });
  }
};

const accounts = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('acct');
      const account = { id, object: 'account', type: params.type || 'express', country: params.country || 'IT' };
      await writeEvent('account.created', account);
      return account;
    });
  }
};

const customers = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('cus');
      const customer = { id, object: 'customer', email: params.email || null, name: params.name || null };
      await writeEvent('customer.created', customer);
      return customer;
    });
  }
};

function _resetForTests() {
  idempotencyCache.clear();
}

module.exports = { paymentIntents, invoices, transfers, accounts, customers, _resetForTests };
