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

function providerEventIdFor(idempotencyKey) {
  if (idempotencyKey) return `evt_mock_${idempotencyKey}`;
  return `evt_mock_${crypto.randomBytes(12).toString('hex')}`;
}

async function writeEvent(eventType, payload, idempotencyKey) {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  const providerEventId = providerEventIdFor(idempotencyKey);
  try {
    await prisma.stripeEvent.create({
      data: { providerEventId, eventType, payload, status: 'pending' }
    });
  } catch (err) {
    // Unique constraint collision on providerEventId means a prior run
    // already persisted this event: safe to ignore for idempotency.
    if (!(err && err.code === 'P2002')) throw err;
  }
  return providerEventId;
}

async function withIdempotency(options, factory) {
  const key = options && options.idempotencyKey;
  if (!key) return factory();
  if (idempotencyCache.has(key)) return idempotencyCache.get(key);

  // DB fallback: survive server restarts by looking up prior StripeEvent
  // keyed by the deterministic providerEventId derived from idempotencyKey.
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const prior = await prisma.stripeEvent.findFirst({
        where: { providerEventId: providerEventIdFor(key) }
      });
      if (prior && prior.payload) {
        idempotencyCache.set(key, prior.payload);
        return prior.payload;
      }
    } catch (_err) {
      // If DB lookup fails, fall through and execute factory.
    }
  }

  const result = await factory(key);
  idempotencyCache.set(key, result);
  return result;
}

const paymentIntents = {
  async create(params, options) {
    return withIdempotency(options, async (idemKey) => {
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
      await writeEvent('payment_intent.created', intent, idemKey);
      return intent;
    });
  },
  async capture(id, options) {
    return withIdempotency(options, async (idemKey) => {
      const intent = {
        id,
        object: 'payment_intent',
        status: 'succeeded',
        captured: true,
        captured_at: nowIsoSeconds()
      };
      await writeEvent('payment_intent.succeeded', intent, idemKey);
      return intent;
    });
  },
  async retrieve(id) {
    return { id, object: 'payment_intent', status: 'succeeded' };
  }
};

const invoices = {
  async create(params, options) {
    return withIdempotency(options, async (idemKey) => {
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
      await writeEvent('invoice.created', invoice, idemKey);
      return invoice;
    });
  },
  async finalizeInvoice(id, options) {
    return withIdempotency(options, async (idemKey) => {
      const invoice = { id, object: 'invoice', status: 'open' };
      await writeEvent('invoice.finalized', invoice, idemKey);
      return invoice;
    });
  },
  async pay(id, options) {
    return withIdempotency(options, async (idemKey) => {
      const invoice = { id, object: 'invoice', status: 'paid', paid_at: nowIsoSeconds() };
      await writeEvent('invoice.paid', invoice, idemKey);
      return invoice;
    });
  }
};

const transfers = {
  async create(params, options) {
    return withIdempotency(options, async (idemKey) => {
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
      await writeEvent('transfer.created', transfer, idemKey);
      return transfer;
    });
  }
};

const accounts = {
  async create(params, options) {
    return withIdempotency(options, async (idemKey) => {
      const id = mockId('acct');
      const account = { id, object: 'account', type: params.type || 'express', country: params.country || 'IT' };
      await writeEvent('account.created', account, idemKey);
      return account;
    });
  }
};

const customers = {
  async create(params, options) {
    return withIdempotency(options, async (idemKey) => {
      const id = mockId('cus');
      const customer = { id, object: 'customer', email: params.email || null, name: params.name || null };
      await writeEvent('customer.created', customer, idemKey);
      return customer;
    });
  }
};

function _resetForTests() {
  idempotencyCache.clear();
}

module.exports = { paymentIntents, invoices, transfers, accounts, customers, _resetForTests };
