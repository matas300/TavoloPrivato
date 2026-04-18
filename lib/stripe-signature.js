// lib/stripe-signature.js
// Mock: accetta qualsiasi firma (compresa vuota/null).
// Live: verifica HMAC Stripe-standard. Implementazione rimandata a quando
// STRIPE_MODE=live sara effettivamente attivato.

function verifySignature(rawBody, signatureHeader, secret) {
  const mode = (process.env.STRIPE_MODE || 'mock').toLowerCase();
  if (mode !== 'live') return true;

  // TODO: implementare verifica HMAC SHA-256 alla Stripe quando si va live.
  // Reference: https://stripe.com/docs/webhooks/signatures
  // const elements = (signatureHeader || '').split(',');
  // const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
  // const signatures = elements.filter(e => e.startsWith('v1=')).map(e => e.slice(3));
  // if (!timestamp || !signatures.length) return false;
  // const payload = `${timestamp}.${rawBody}`;
  // const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // return signatures.some(s => crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));

  throw new Error('stripe signature verification not yet implemented for live mode');
}

module.exports = { verifySignature };
