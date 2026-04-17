const mode = (process.env.STRIPE_MODE || 'mock').toLowerCase();

function loadStripe() {
  if (mode === 'live') {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_MODE=live ma STRIPE_SECRET_KEY mancante');
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return require('./stripe-mock');
}

let instance = null;
function getStripe() {
  if (!instance) instance = loadStripe();
  return instance;
}

module.exports = { getStripe, mode };
