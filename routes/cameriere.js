const express = require('express');
const router = express.Router();
const db = require('../data/mock');
const marketplace = require('../data/marketplace-service');
const { getPrismaClient } = require('../lib/prisma');
const bankAccountService = require('../data/bank-account-service');

function paymentTermsLabel(days, base) {
  const dayValue = String(days || 'd0').replace('d', '');
  return `${dayValue} giorni ${base === 'end_of_month' ? 'fine mese' : 'data fattura'}`;
}

router.get('/dashboard', (req, res) => {
  const dashboard = marketplace.getWorkerDashboard(req.session.user.id);

  res.render('pages/cameriere/dashboard', {
    title: 'Dashboard',
    layout: 'app',
    ...dashboard,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/cerca', (req, res) => {
  const { zona, tipo, budget } = req.query;
  const user = db.getUser(req.session.user.id);
  const annunci = marketplace.getOpenServiceRequestsForWorker(req.session.user.id, { zona, tipo, budget });

  res.render('pages/cameriere/cerca', {
    title: 'Cerca Annunci',
    layout: 'app',
    annunci,
    user: marketplace.getEnhancedWorker(req.session.user.id),
    filters: { zona, tipo, budget },
    unreadCount: db.getUnreadCount(user.id)
  });
});

router.get('/profilo', (req, res) => {
  const user = marketplace.getEnhancedWorker(req.session.user.id);
  const prefillScenario = req.query.prefill === 'simulator' ? (req.session.prefillWorkerScenario || null) : null;
  res.render('pages/cameriere/profilo', {
    title: 'Il Mio Profilo',
    layout: 'app',
    user,
    prefillScenario,
    unreadCount: db.getUnreadCount(user.id)
  });
});

router.get('/contratti', (req, res) => {
  const user = db.getUser(req.session.user.id);
  const contratti = db.getContrattiForUser(user.id, 'cameriere');
  const { stato } = req.query;
  const filtered = stato ? contratti.filter(c => c.stato === stato) : contratti;
  res.render('pages/cameriere/contratti', {
    title: 'Contratti',
    layout: 'app',
    contratti: filtered,
    filtroStato: stato || 'all',
    getUser: db.getUser,
    unreadCount: db.getUnreadCount(user.id)
  });
});

router.get('/contratti-lunghi', async (req, res) => {
  const prisma = getPrismaClient();
  let longContracts = [];

  if (prisma) {
    const rows = await prisma.serviceContract.findMany({
      where: {
        workerProfileId: req.session.user.id,
        engagementType: 'long_term'
      },
      include: {
        restaurantProfile: true,
        milestones: {
          include: {
            invoices: true,
            paymentOrder: true
          },
          orderBy: {
            sequence: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    longContracts = rows.map(contract => ({
      id: contract.id,
      restaurantName: contract.restaurantProfile.brandName,
      restaurantCity: contract.restaurantProfile.city,
      objectiveSummary: contract.objectiveSummary,
      scopeOfWork: contract.scopeOfWork || [],
      serviceStartDate: contract.serviceStartDate || contract.serviceDate,
      serviceEndDate: contract.serviceEndDate || contract.serviceDate,
      monthlyGrossAmountEur: contract.monthlyGrossAmountEur,
      taxableAmountEur: contract.taxableAmountEur,
      platformFeeEur: contract.platformFeeEur,
      workerNetEur: contract.workerNetEur,
      paymentTermsLabel: paymentTermsLabel(contract.paymentTermsDays, contract.paymentTermsBase),
      pdfUrl: contract.pdfUrl,
      status: contract.status,
      milestones: contract.milestones.map(item => ({
        sequence: item.sequence,
        milestoneLabel: item.milestoneLabel,
        invoiceDate: item.invoiceDate,
        dueDate: item.dueDate,
        taxableAmountEur: item.taxableAmountEur,
        workerNetEur: item.workerNetEur,
        feeAmountEur: item.platformFeeEur,
        status: item.status,
        invoiceStatus: item.invoices[0]?.invoiceStatus || null,
        invoiceNumber: item.invoices[0]?.externalNumber || null
      }))
    }));
  }

  res.render('pages/cameriere/contratti-lunghi', {
    title: 'Contratti Lunghi',
    layout: 'app',
    longContracts,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/contratti/:id', (req, res) => {
  const contractView = marketplace.getContractView(parseInt(req.params.id, 10));
  if (!contractView || contractView.cameriere.id !== req.session.user.id) {
    return res.status(404).render('pages/public/404', { title: 'Non trovato' });
  }
  res.render('pages/cameriere/contratto-dettaglio', {
    title: `Contratto #${contractView.contratto.id}`,
    layout: 'app',
    ...contractView,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/wallet', (req, res) => {
  const wallet = marketplace.getWorkerWallet(req.session.user.id);

  res.render('pages/cameriere/wallet', {
    title: 'Wallet & Pagamenti',
    layout: 'app',
    ...wallet,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/messaggi', async (req, res) => {
  const partners = db.getConversationPartners(req.session.user.id);
  const partnerId = req.query.con ? parseInt(req.query.con) : (partners.length ? partners[0].id : null);
  let conversation = [];
  let partner = null;
  if (partnerId) {
    conversation = db.getConversation(req.session.user.id, partnerId);
    partner = db.getUser(partnerId);
    await db.markConversationRead(req.session.user.id, partnerId);
  }

  res.render('pages/cameriere/messaggi', {
    title: 'Messaggi',
    layout: 'app',
    partners, conversation, partner,
    activePartnerId: partnerId,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/guida-piva', (req, res) => {
  res.render('pages/cameriere/guida-piva', {
    title: 'Guida P.IVA Forfettaria',
    layout: 'app',
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/bank-accounts', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  try {
    const bankAccounts = await bankAccountService.listForOwner('worker', workerProfileId);
    res.render('pages/cameriere/bank-accounts', { bankAccounts, formErrors: req.session.formErrors || null, formInput: req.session.formInput || {} });
    req.session.formErrors = null;
    req.session.formInput = null;
  } catch (err) {
    if (err.message === 'prisma_unavailable') return res.status(503).send('Database non disponibile');
    throw err;
  }
});

router.post('/bank-accounts', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  const result = await bankAccountService.createForOwner('worker', workerProfileId, req.body);
  if (!result.ok) {
    req.session.formErrors = result.errors;
    req.session.formInput = req.body;
  }
  res.redirect('/cameriere/bank-accounts');
});

router.post('/bank-accounts/:id/primary', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  await bankAccountService.setPrimary('worker', workerProfileId, req.params.id);
  res.redirect('/cameriere/bank-accounts');
});

router.post('/bank-accounts/:id/archive', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  const result = await bankAccountService.archive('worker', workerProfileId, req.params.id);
  if (!result.ok) req.session.formErrors = [{ field: 'general', message: result.error }];
  res.redirect('/cameriere/bank-accounts');
});

module.exports = router;
