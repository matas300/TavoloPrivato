const crypto = require('crypto');
const { normalizeSimulatorAudience } = require('./earnings-simulator');

function createVisitorKey() {
  return `sim_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

function normalizeSavedScenario(record) {
  if (!record) return null;

  return {
    id: record.id,
    audience: normalizeSimulatorAudience(record.audience),
    roleKey: record.roleKey,
    yearsExperience: record.yearsExperience,
    currentNetMonthly: record.currentNetMonthly,
    forfettarioRate: record.forfettarioRate,
    profitabilityCoefficient: record.profitabilityCoefficient,
    employeeNetAnnual: record.employeeNetAnnual,
    companyCostAnnual: record.companyCostAnnual,
    freelanceNetAnnual: record.freelanceNetAnnual,
    annualGain: record.annualGain,
    monthlyGain: record.monthlyGain,
    snapshot: record.snapshot,
    createdAt: record.createdAt
  };
}

async function listEarningsScenarios({ prisma, userId, visitorKey, audience, limit = 4 }) {
  if (!prisma) return [];

  const normalizedAudience = normalizeSimulatorAudience(audience);
  const where = userId
    ? { userId, audience: normalizedAudience }
    : visitorKey
      ? { visitorKey, audience: normalizedAudience }
      : null;

  if (!where) return [];

  const scenarios = await prisma.earningsScenario.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return scenarios.map(normalizeSavedScenario);
}

async function saveEarningsScenario({
  prisma,
  userId,
  visitorKey,
  audience,
  input,
  result
}) {
  if (!prisma) return null;

  const normalizedAudience = normalizeSimulatorAudience(audience);
  const snapshot = {
    input: result.input,
    referenceSnapshot: result.referenceSnapshot,
    delta: result.delta,
    banner: result.banner,
    warnings: result.warnings
  };

  const scenario = await prisma.earningsScenario.create({
    data: {
      userId: userId || null,
      visitorKey: userId ? null : visitorKey,
      audience: normalizedAudience,
      roleKey: result.input.ruolo,
      yearsExperience: result.input.anniEsperienza,
      currentNetMonthly: result.input.stipendioNettoMensileAttuale,
      forfettarioRate: result.input.aliquotaForfettario / 100,
      profitabilityCoefficient: result.input.coefficienteRedditivita,
      employeeNetAnnual: result.dipendente.nettoAnnuo,
      companyCostAnnual: result.azienda.costoTotale,
      freelanceNetAnnual: result.freelance.nettoAnnuo,
      annualGain: result.delta.guadagnoAnnuo,
      monthlyGain: result.delta.guadagnoMensile,
      snapshot
    }
  });

  return normalizeSavedScenario(scenario);
}

module.exports = {
  createVisitorKey,
  normalizeSavedScenario,
  listEarningsScenarios,
  saveEarningsScenario
};
