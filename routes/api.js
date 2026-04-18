const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../data/mock');
const blueprint = require('../data/marketplace-blueprint');
const marketplaceDemo = require('../data/marketplace-demo.json');
const marketplace = require('../data/marketplace-service');
const { getPrismaClient, isPrismaReady } = require('../lib/prisma');
const {
  getSimulatorMeta,
  calculateEarningsSimulation,
  normalizeSimulatorAudience
} = require('../lib/earnings-simulator');
const {
  createVisitorKey,
  listEarningsScenarios,
  saveEarningsScenario
} = require('../lib/earnings-scenarios');
const { buildWorkerProfileDraft, buildRestaurantRequestDraft } = require('../lib/earnings-prefill');
const { generateEarningsPdf } = require('../lib/earnings-pdf');
const { evaluatePairCompliance } = require('../lib/compliance-agent');
const { createLongTermContract } = require('../lib/contract-agent');
const { runMonthlyBillingCycle, captureDuePaymentOrders } = require('../lib/payment-agent');

function getScenarioSessionStore(req) {
  if (!req.session.savedEarningsScenarios) {
    req.session.savedEarningsScenarios = [];
  }

  return req.session.savedEarningsScenarios;
}

function ensureSimulatorVisitorKey(req) {
  if (!req.session.simulatorVisitorKey) {
    req.session.simulatorVisitorKey = createVisitorKey();
  }

  return req.session.simulatorVisitorKey;
}

function requirePrismaOr503(res) {
  const prisma = getPrismaClient();
  if (!prisma) {
    res.status(503).json({
      error: 'Database Prisma non disponibile'
    });
    return null;
  }

  return prisma;
}

router.get('/blueprint', (req, res) => {
  res.json(blueprint);
});

router.get('/demo-marketplace', (req, res) => {
  res.json(marketplaceDemo);
});

router.get('/workers/:id', (req, res) => {
  const workerId = parseInt(req.params.id, 10);
  const baseWorker = db.getUser(workerId);
  if (!baseWorker || baseWorker.role !== 'cameriere') {
    return res.status(404).json({ error: 'Worker non trovato' });
  }
  res.json(marketplace.getEnhancedWorker(workerId));
});

router.get('/restaurants/:id', (req, res) => {
  const restaurantId = parseInt(req.params.id, 10);
  const baseRestaurant = db.getUser(restaurantId);
  if (!baseRestaurant || baseRestaurant.role !== 'ristorante') {
    return res.status(404).json({ error: 'Ristorante non trovato' });
  }
  res.json(marketplace.getEnhancedRestaurant(restaurantId));
});

router.get('/compliance/overview', (req, res) => {
  res.json(marketplace.getComplianceOverview());
});

router.get('/compliance/pairs/:workerId/:restaurantId', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) {
    return res.json(
      marketplace.buildPairMetrics(
        parseInt(req.params.workerId, 10),
        parseInt(req.params.restaurantId, 10)
      )
    );
  }

  try {
    const projectedGrossAmountEur = req.query.projectedGrossAmountEur
      ? parseFloat(req.query.projectedGrossAmountEur)
      : null;
    const estimatedServiceDays = req.query.estimatedServiceDays
      ? parseInt(req.query.estimatedServiceDays, 10)
      : null;
    const evaluation = await evaluatePairCompliance(prisma, {
      workerProfileId: parseInt(req.params.workerId, 10),
      restaurantProfileId: parseInt(req.params.restaurantId, 10),
      proposal: projectedGrossAmountEur && estimatedServiceDays
        ? {
          taxableAmountEur: projectedGrossAmountEur,
          estimatedServiceDays
        }
        : null
    });

    return res.json(evaluation);
  } catch (error) {
    return res.status(400).json({
      error: 'Impossibile valutare la compliance della coppia',
      details: error.message
    });
  }
});

router.get('/blueprint/doc', (req, res) => {
  res.type('text/markdown').send(
    fs.readFileSync(path.join(__dirname, '..', 'docs', 'marketplace-blueprint.md'), 'utf8')
  );
});

router.get('/blueprint/legal-audit', (req, res) => {
  res.type('text/markdown').send(
    fs.readFileSync(path.join(__dirname, '..', 'docs', 'legal-architecture-audit.md'), 'utf8')
  );
});

router.get('/blueprint/sql', (req, res) => {
  res.type('text/plain').send(
    fs.readFileSync(path.join(__dirname, '..', 'docs', 'marketplace-schema.sql'), 'utf8')
  );
});

router.get('/blueprint/prisma', (req, res) => {
  res.type('text/plain').send(
    fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8')
  );
});

router.get('/storage-mode', (req, res) => {
  res.json({
    ...db.getStorageInfo(),
    prismaConfigured: isPrismaReady()
  });
});

router.get('/db-health', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) {
    return res.status(503).json({
      ok: false,
      reason: 'Prisma non configurato'
    });
  }

  const [users, workers, restaurants, requests, contracts, alerts] = await Promise.all([
    prisma.user.count(),
    prisma.workerProfile.count(),
    prisma.restaurantProfile.count(),
    prisma.serviceRequest.count(),
    prisma.serviceContract.count(),
    prisma.complianceAlert.count()
  ]);

  res.json({
    ok: true,
    provider: (process.env.DATABASE_URL || '').startsWith('file:') ? 'sqlite' : 'unknown',
    counts: {
      users,
      workers,
      restaurants,
      requests,
      contracts,
      alerts
    }
  });
});

router.get('/simulatore-guadagno/meta', (req, res) => {
  res.json(getSimulatorMeta());
});

router.post('/simulatore-guadagno', (req, res) => {
  try {
    const payload = req.body || {};
    const result = calculateEarningsSimulation(payload);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: 'Parametri non validi per il simulatore',
      details: error.message
    });
  }
});

router.get('/simulatore-guadagno/export', (req, res) => {
  try {
    const payload = {
      audience: req.query.audience,
      ruolo: req.query.ruolo,
      anni_esperienza: req.query.anni_esperienza,
      stipendio_netto_mensile_attuale: req.query.stipendio_netto_mensile_attuale,
      aliquota_forfettario: req.query.aliquota_forfettario
    };
    const audience = normalizeSimulatorAudience(payload.audience);
    const result = calculateEarningsSimulation(payload);
    const page = audience === 'restaurant'
      ? {
        heroSubtitle: 'Sintesi per ristoratori: confronto tra spesa complessiva del dipendente e compenso netto generato a parita di budget.',
        employeeKicker: 'Netto dipendente annuo',
        companyKicker: 'Costo aziendale annuo',
        freelanceKicker: 'Netto professionista annuo'
      }
      : {
        heroSubtitle: 'Sintesi per professionisti: confronto tra netto dipendente e netto potenziale in forfettario a parita di spesa del locale.',
        employeeKicker: 'Netto dipendente annuo',
        companyKicker: 'Costo aziendale annuo',
        freelanceKicker: 'Netto freelance annuo'
      };

    const pdfPath = generateEarningsPdf({ result, page });
    res.download(pdfPath);
  } catch (error) {
    res.status(500).json({
      error: 'Impossibile generare il PDF',
      details: error.message
    });
  }
});

router.get('/simulatore-guadagno/scenari', async (req, res) => {
  const audience = normalizeSimulatorAudience(req.query.audience);
  const prisma = getPrismaClient();

  if (prisma) {
    const scenarios = await listEarningsScenarios({
      prisma,
      userId: req.session.user ? req.session.user.id : null,
      visitorKey: req.session.user ? null : req.session.simulatorVisitorKey || null,
      audience,
      limit: 4
    });

    return res.json({ scenarios });
  }

  const scenarios = getScenarioSessionStore(req)
    .filter(item => item.audience === audience)
    .slice(0, 4);

  res.json({ scenarios });
});

router.post('/simulatore-guadagno/save', async (req, res) => {
  try {
    const payload = req.body || {};
    const audience = normalizeSimulatorAudience(payload.audience);
    const result = calculateEarningsSimulation(payload);
    const prisma = getPrismaClient();

    if (prisma) {
      const visitorKey = req.session.user ? null : ensureSimulatorVisitorKey(req);
      const scenario = await saveEarningsScenario({
        prisma,
        userId: req.session.user ? req.session.user.id : null,
        visitorKey,
        audience,
        input: payload,
        result
      });

      return res.json({ ok: true, scenario });
    }

    const scenario = {
      id: Date.now(),
      audience,
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
      snapshot: {
        input: result.input,
        referenceSnapshot: result.referenceSnapshot,
        delta: result.delta,
        banner: result.banner,
        warnings: result.warnings
      },
      createdAt: new Date().toISOString()
    };

    const scenarios = getScenarioSessionStore(req);
    scenarios.unshift(scenario);
    req.session.savedEarningsScenarios = scenarios.slice(0, 8);

    res.json({ ok: true, scenario });
  } catch (error) {
    res.status(400).json({
      error: 'Impossibile salvare lo scenario',
      details: error.message
    });
  }
});

router.post('/simulatore-guadagno/prefill', (req, res) => {
  try {
    const payload = req.body || {};
    const audience = normalizeSimulatorAudience(payload.audience);
    const result = calculateEarningsSimulation(payload);

    if (audience === 'restaurant') {
      const draft = buildRestaurantRequestDraft(result);
      if (req.session.user && req.session.user.role === 'ristorante') {
        req.session.prefillRestaurantScenario = draft;
        return res.json({ ok: true, nextUrl: '/ristorante/annunci?prefill=simulator' });
      }

      req.session.prefillRegistrationScenario = draft;
      return res.json({ ok: true, nextUrl: '/register?role=ristorante&source=simulator' });
    }

    const draft = buildWorkerProfileDraft(result);
    if (req.session.user && req.session.user.role === 'cameriere') {
      req.session.prefillWorkerScenario = draft;
      return res.json({ ok: true, nextUrl: '/cameriere/profilo?prefill=simulator' });
    }

    req.session.prefillRegistrationScenario = draft;
    res.json({ ok: true, nextUrl: '/register?role=cameriere&source=simulator' });
  } catch (error) {
    res.status(400).json({
      error: 'Impossibile precompilare il prossimo step',
      details: error.message
    });
  }
});

router.post('/calcola-stipendio', (req, res) => {
  const { stipendio = 1500, aliquota = 15 } = req.body;
  const giorniMese = 22;
  const pagaGiorno = 140;
  const lordoMese = pagaGiorno * giorniMese;
  const imponibile = lordoMese * 0.67;
  const inps = imponibile * 0.2607;
  const imposta = imponibile * (aliquota / 100);
  const netto = Math.round(lordoMese - inps - imposta);
  const diff = netto - stipendio;
  res.json({
    netto,
    diff,
    lordoMese: Math.round(lordoMese),
    imponibile: Math.round(imponibile),
    inps: Math.round(inps),
    imposta: Math.round(imposta)
  });
});

router.post('/messaggi/send', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'Parametri mancanti' });
  const msg = await db.addMessage(req.session.user.id, parseInt(to, 10), text);
  res.json(msg);
});

router.post('/messaggi/read', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });
  const { partnerId } = req.body;
  const updated = await db.markConversationRead(req.session.user.id, parseInt(partnerId, 10));
  res.json({ ok: true, updated });
});

router.get('/messaggi/:partnerId', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });
  const partnerId = parseInt(req.params.partnerId, 10);
  const messages = db.getConversation(req.session.user.id, partnerId);
  const partner = db.getUser(partnerId);
  res.json({ messages, partner });
});

router.post('/annunci', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'ristorante') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const ann = await db.addAnnuncio({
    ristoranteId: req.session.user.id,
    ...req.body
  });
  res.json(ann);
});

router.post('/candidatura', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });
  res.json({ ok: true, message: 'Candidatura inviata con successo' });
});

router.post('/contratti/:id/firma', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });

  const contractId = parseInt(req.params.id, 10);
  const contratto = db.contratti.find(c => c.id === contractId);
  if (!contratto) return res.status(404).json({ error: 'Contratto non trovato' });
  if (![contratto.cameriereId, contratto.ristoranteId].includes(req.session.user.id)) {
    return res.status(403).json({ error: 'Contratto non associato al tuo account' });
  }

  const result = await db.signContract(contractId, req.session.user.id, req.ip);
  res.json({
    ok: true,
    message: 'Contratto firmato digitalmente',
    timestamp: new Date().toISOString(),
    ip: req.ip,
    signedCount: result ? result.signedCount : 0,
    status: result ? result.status : contratto.stato
  });
});

router.post('/contratti/:id/valuta', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });

  const contractId = parseInt(req.params.id, 10);
  const contratto = db.contratti.find(c => c.id === contractId);
  if (!contratto) return res.status(404).json({ error: 'Contratto non trovato' });
  if (![contratto.cameriereId, contratto.ristoranteId].includes(req.session.user.id)) {
    return res.status(403).json({ error: 'Contratto non associato al tuo account' });
  }

  const { rating, commento } = req.body;
  await db.rateContract(contractId, req.session.user.id, req.session.user.role, rating, commento);
  res.json({ ok: true });
});

router.post('/contracts/long-term', async (req, res) => {
  if (!req.session.user || !['ristorante', 'admin'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const prisma = requirePrismaOr503(res);
  if (!prisma) return;

  try {
    const payload = {
      ...req.body,
      restaurantProfileId: req.session.user.role === 'ristorante'
        ? req.session.user.id
        : parseInt(req.body.restaurantProfileId, 10)
    };

    const result = await createLongTermContract(prisma, payload);
    return res.status(201).json({
      ok: true,
      contractId: result.contractId,
      pdfUrl: result.pdfUrl,
      milestones: result.milestones,
      compliance: result.compliance
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Impossibile generare il contratto lungo',
      details: error.message
    });
  }
});

router.post('/contracts/compliance-check', async (req, res) => {
  const prisma = requirePrismaOr503(res);
  if (!prisma) return;

  try {
    const evaluation = await evaluatePairCompliance(prisma, {
      workerProfileId: parseInt(req.body.workerProfileId, 10),
      restaurantProfileId: parseInt(req.body.restaurantProfileId, 10),
      proposal: req.body.taxableAmountEur && req.body.estimatedServiceDays
        ? {
          taxableAmountEur: parseFloat(req.body.taxableAmountEur),
          estimatedServiceDays: parseInt(req.body.estimatedServiceDays, 10)
        }
        : null
    });
    return res.json(evaluation);
  } catch (error) {
    return res.status(400).json({
      error: 'Controllo compliance non riuscito',
      details: error.message
    });
  }
});

router.post('/wallet/preleva', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });
  await db.addAuditLog(
    req.session.user.email,
    `Richiesta prelievo wallet da ${req.session.user.role} #${req.session.user.id}`,
    'wallet_withdrawal'
  );
  res.json({ ok: true, message: 'Richiesta di prelievo inviata. Accredito entro 2-3 giorni lavorativi.' });
});

router.post('/admin/commissioni', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const { servizio, giornata, evento } = req.body;
  const updated = await db.updateCommissioni({ servizio, giornata, evento });
  await db.addAuditLog(
    req.session.user.email,
    `Commissioni aggiornate: servizio EUR ${updated.servizio}, giornata EUR ${updated.giornata}, evento EUR ${updated.evento}`,
    'config'
  );
  res.json({ ok: true, commissioni: updated });
});

router.post('/admin/utenti/:id/verifica', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const user = db.getUser(parseInt(req.params.id, 10));
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  await db.setUserVerification(user.id, true);
  await db.addAuditLog(
    req.session.user.email,
    `Verifica profilo ${user.role} #${user.id} (${user.name}) - profilo verificato`,
    'verifica'
  );
  res.json({ ok: true });
});

router.post('/admin/utenti/:id/warning', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const user = db.getUser(parseInt(req.params.id, 10));
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  await db.addAuditLog(
    req.session.user.email,
    `Warning inviato a ${user.role} #${user.id} (${user.name})`,
    'moderazione'
  );
  res.json({ ok: true, message: `Warning inviato a ${user.name}` });
});

router.post('/admin/utenti/:id/ban', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const user = db.getUser(parseInt(req.params.id, 10));
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  await db.suspendUser(user.id);
  await db.addAuditLog(
    req.session.user.email,
    `Utente ${user.role} #${user.id} (${user.name}) bannato`,
    'moderazione'
  );
  res.json({ ok: true, message: `${user.name} bannato` });
});

router.post('/pagamento/simula', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Non autenticato' });
  await db.addAuditLog(
    req.session.user.email,
    `Pagamento simulato richiesto da ${req.session.user.role} #${req.session.user.id}`,
    'payment_simulated'
  );
  res.json({ ok: true, message: 'Pagamento simulato con successo', transactionId: 'sim_' + Date.now() });
});

router.post('/payments/billing/run', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non autorizzato' });
  }

  const prisma = requirePrismaOr503(res);
  if (!prisma) return;

  try {
    const asOfDate = req.body.asOfDate || new Date().toISOString();
    const billing = await runMonthlyBillingCycle(prisma, { asOfDate });
    const captures = await captureDuePaymentOrders(prisma, { asOfDate });

    return res.json({
      ok: true,
      billing,
      captures
    });
  } catch (error) {
    return res.status(500).json({
      error: 'PaymentAgent non riuscito',
      details: error.message
    });
  }
});

module.exports = router;
