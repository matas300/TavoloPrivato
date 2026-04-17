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
  const dashboard = marketplace.getRestaurantDashboard(req.session.user.id);

  res.render('pages/ristorante/dashboard', {
    title: 'Dashboard',
    layout: 'app',
    ...dashboard,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/cerca', (req, res) => {
  const { zona, qualifica, esperienza, budget } = req.query;
  const camerieri = marketplace.getWorkerMatchesForRestaurant(req.session.user.id, { zona, qualifica, esperienza, budget });
  const qualificaOptions = [...new Set(db.getCamerieri().flatMap(c => c.qualifiche))]
    .map(value => value.replaceAll('Ã®', 'i'))
    .sort();

  res.render('pages/ristorante/cerca', {
    title: 'Cerca Camerieri',
    layout: 'app',
    camerieri,
    profile: marketplace.getEnhancedRestaurant(req.session.user.id),
    filters: { zona, qualifica, esperienza, budget },
    qualificaOptions,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/profilo', (req, res) => {
  const user = marketplace.getEnhancedRestaurant(req.session.user.id);
  res.render('pages/ristorante/profilo', {
    title: 'Il Mio Ristorante',
    layout: 'app',
    user,
    requests: marketplace.getRestaurantRequests(req.session.user.id),
    suggestedWorkers: marketplace.getWorkerMatchesForRestaurant(req.session.user.id).slice(0, 3),
    unreadCount: db.getUnreadCount(user.id)
  });
});

router.get('/annunci', (req, res) => {
  const annunci = marketplace.getRestaurantRequests(req.session.user.id);
  const prefillScenario = req.query.prefill === 'simulator' ? (req.session.prefillRestaurantScenario || null) : null;
  res.render('pages/ristorante/annunci', {
    title: 'Annunci Attivi',
    layout: 'app',
    annunci,
    prefillScenario,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/contratti', (req, res) => {
  const contratti = db.getContrattiForUser(req.session.user.id, 'ristorante');
  const { stato } = req.query;
  const filtered = stato ? contratti.filter(c => c.stato === stato) : contratti;
  res.render('pages/ristorante/contratti', {
    title: 'Contratti & Storico',
    layout: 'app',
    contratti: filtered,
    filtroStato: stato || 'all',
    getUser: db.getUser,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/pagamenti', async (req, res) => {
  const payments = marketplace.getRestaurantPayments(req.session.user.id);
  const prisma = getPrismaClient();
  let longInvoices = [];

  if (prisma) {
    const rows = await prisma.invoice.findMany({
      where: {
        serviceContract: {
          restaurantProfileId: req.session.user.id,
          engagementType: 'long_term'
        }
      },
      include: {
        serviceContract: {
          include: {
            workerProfile: {
              include: {
                user: true
              }
            }
          }
        },
        contractMilestone: true
      },
      orderBy: {
        issuedAt: 'desc'
      },
      take: 8
    });

    longInvoices = rows.map(item => ({
      id: item.id,
      number: item.externalNumber || `INV-${item.id}`,
      workerName: item.serviceContract?.workerProfile?.user?.displayName || 'n/d',
      amountEur: item.amountEur,
      issuedAt: item.issuedAt,
      dueDate: item.dueDate,
      invoiceStatus: item.invoiceStatus,
      milestoneLabel: item.contractMilestone?.milestoneLabel || 'Milestone'
    }));
  }

  res.render('pages/ristorante/pagamenti', {
    title: 'Pagamenti',
    layout: 'app',
    ...payments,
    longInvoices,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/contratti-lunghi', async (req, res) => {
  const prisma = getPrismaClient();
  const workerOptions = marketplace.getWorkerMatchesForRestaurant(req.session.user.id)
    .map(worker => ({
      id: worker.id,
      name: worker.name,
      initials: worker.initials,
      zone: worker.zona,
      role: worker.headline || worker.qualifiche.join(', '),
      minFee: worker.pagaMin,
      safeHarborCandidate: Boolean(worker.safeHarborCandidate)
    }));

  let longContracts = [];

  if (prisma) {
    const rows = await prisma.serviceContract.findMany({
      where: {
        restaurantProfileId: req.session.user.id,
        engagementType: 'long_term'
      },
      include: {
        workerProfile: {
          include: {
            user: true
          }
        },
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
      workerName: contract.workerProfile.user.displayName,
      workerInitials: contract.workerProfile.user.initials || contract.workerProfile.user.displayName.slice(0, 2).toUpperCase(),
      objectiveSummary: contract.objectiveSummary,
      serviceStartDate: contract.serviceStartDate || contract.serviceDate,
      serviceEndDate: contract.serviceEndDate || contract.serviceDate,
      monthlyGrossAmountEur: contract.monthlyGrossAmountEur,
      grossAmountEur: contract.grossAmountEur,
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
        grossAmountEur: item.grossAmountEur,
        workerNetEur: item.workerNetEur,
        status: item.status,
        invoiceStatus: item.invoices[0]?.invoiceStatus || null
      }))
    }));
  }

  res.render('pages/ristorante/contratti-lunghi', {
    title: 'Contratti Lunghi',
    layout: 'app',
    workerOptions,
    longContracts,
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

  res.render('pages/ristorante/messaggi', {
    title: 'Messaggi',
    layout: 'app',
    partners, conversation, partner,
    activePartnerId: partnerId,
    unreadCount: db.getUnreadCount(req.session.user.id)
  });
});

router.get('/bank-accounts', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  try {
    const bankAccounts = await bankAccountService.listForOwner('restaurant', restaurantProfileId);
    res.render('pages/ristorante/bank-accounts', { bankAccounts, formErrors: req.session.formErrors || null, formInput: req.session.formInput || {} });
    req.session.formErrors = null;
    req.session.formInput = null;
  } catch (err) {
    if (err.message === 'prisma_unavailable') return res.status(503).send('Database non disponibile');
    throw err;
  }
});

router.post('/bank-accounts', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  const result = await bankAccountService.createForOwner('restaurant', restaurantProfileId, req.body);
  if (!result.ok) {
    req.session.formErrors = result.errors;
    req.session.formInput = req.body;
  }
  res.redirect('/ristorante/bank-accounts');
});

router.post('/bank-accounts/:id/primary', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  await bankAccountService.setPrimary('restaurant', restaurantProfileId, req.params.id);
  res.redirect('/ristorante/bank-accounts');
});

router.post('/bank-accounts/:id/archive', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  const result = await bankAccountService.archive('restaurant', restaurantProfileId, req.params.id);
  if (!result.ok) req.session.formErrors = [{ field: 'general', message: result.error }];
  res.redirect('/ristorante/bank-accounts');
});

module.exports = router;
