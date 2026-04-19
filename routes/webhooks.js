// routes/webhooks.js
// Endpoint pubblico per webhook Stripe. Bypass auth (Stripe chiama
// senza sessione utente). Signature verification via lib/stripe-signature:
// mock accetta tutto, live verifica HMAC.

const express = require('express');
const { getPrismaClient } = require('../lib/prisma');
const { processEvent } = require('../lib/webhook-processor');
const { verifySignature } = require('../lib/stripe-signature');

const router = express.Router();

router.post('/stripe', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'prisma_unavailable' });

  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET || 'mock-secret';

  try {
    if (!verifySignature(rawBody, sig, secret)) {
      return res.status(400).json({ error: 'invalid_signature' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const providerEventId = req.body?.providerEventId || req.body?.id;
  if (!providerEventId) return res.status(400).json({ error: 'missing_providerEventId' });

  const event = await prisma.stripeEvent.findUnique({ where: { providerEventId } });
  if (!event) return res.status(404).json({ error: 'event_not_found' });

  try {
    const result = await processEvent(prisma, event);
    res.json(result);
  } catch (err) {
    console.error('[webhooks/stripe] unexpected error:', err);
    res.status(500).json({ error: 'processor_internal_error' });
  }
});

module.exports = router;
