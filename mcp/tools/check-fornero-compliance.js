// Thin-wrapper su lib/compliance-agent.evaluatePairCompliance.
// Richiede Prisma configurato: se non disponibile, ritorna { error: 'prisma_unavailable' }.

const { evaluatePairCompliance } = require('../../lib/compliance-agent');
const { getPrismaClient } = require('../../lib/prisma');

const schema = {
  name: 'check_fornero_compliance',
  description: 'Valuta la Riforma Fornero per una coppia worker/restaurant: giorni/concentrazione 12-24m, ex-datori, decision a 5 livelli.',
  inputSchema: {
    type: 'object',
    required: ['workerProfileId', 'restaurantProfileId'],
    properties: {
      workerProfileId: { type: 'string' },
      restaurantProfileId: { type: 'string' },
      asOf: { type: 'string', description: 'Data ISO, default oggi' },
      proposal: {
        type: 'object',
        properties: {
          grossAmountEur: { type: 'number' },
          estimatedServiceDays: { type: 'number' }
        }
      }
    }
  }
};

async function run(args) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return { error: 'prisma_unavailable', message: 'DATABASE_URL o @prisma/client mancanti' };
  }

  const { workerProfileId, restaurantProfileId, asOf, proposal } = args || {};
  if (!workerProfileId || !restaurantProfileId) {
    return { error: 'invalid_input', field: !workerProfileId ? 'workerProfileId' : 'restaurantProfileId' };
  }

  try {
    const options = { workerProfileId, restaurantProfileId };
    if (asOf) options.now = new Date(asOf);
    if (proposal) options.proposal = proposal;

    const raw = await evaluatePairCompliance(prisma, options);
    return {
      decision: raw.decision,
      controlScore: raw.controlScore,
      seniorExempt: raw.seniorExempt,
      exEmployerMatch: raw.formerEmployerMatch,
      metrics: {
        days24m: raw.current && raw.current.days24m,
        share12m: raw.current && raw.current.share12m,
        share24m: raw.current && raw.current.share24m
      },
      thresholds: {
        maxDays: raw.policy.maxPairDays24m,
        warnDays: raw.policy.warnPairDays24m,
        maxShare: raw.policy.maxPairShare24m,
        warnShare: raw.policy.warnPairShare24m
      },
      reasons: raw.reasons || []
    };
  } catch (err) {
    return { error: 'internal', message: err.message };
  }
}

module.exports = { schema, run };
