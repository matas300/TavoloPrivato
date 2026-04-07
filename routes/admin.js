const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../data/mock');
const blueprint = require('../data/marketplace-blueprint');
const marketplaceDemo = require('../data/marketplace-demo.json');
const marketplace = require('../data/marketplace-service');
const { getPrismaClient } = require('../lib/prisma');

router.get('/dashboard', (req, res) => {
  const dashboard = marketplace.getAdminDashboard();

  res.render('pages/admin/dashboard', {
    title: 'Overview',
    layout: 'app',
    ...dashboard,
    alerts: dashboard.alerts.slice(0, 4),
    unreadCount: 0
  });
});

router.get('/utenti', (req, res) => {
  const { search, role } = req.query;
  let utenti = db.users.filter(u => u.role !== 'admin');
  if (search) utenti = utenti.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  if (role) utenti = utenti.filter(u => u.role === role);

  res.render('pages/admin/utenti', {
    title: 'Gestione Utenti',
    layout: 'app',
    utenti,
    filters: { search, role },
    unreadCount: 0
  });
});

router.get('/alert', (req, res) => {
  res.render('pages/admin/alert', {
    title: 'Alert Comportamentali',
    layout: 'app',
    alerts: marketplace.getAdminAlerts(),
    overview: marketplace.getComplianceOverview(),
    thresholds: blueprint.complianceEngine.thresholds,
    nonRenewal: db.nonRenewal,
    getUser: db.getUser,
    unreadCount: 0
  });
});

router.get('/transazioni', (req, res) => {
  res.render('pages/admin/transazioni', {
    title: 'Transazioni',
    layout: 'app',
    contratti: db.contratti,
    getUser: db.getUser,
    unreadCount: 0
  });
});

router.get('/commissioni', (req, res) => {
  res.render('pages/admin/commissioni', {
    title: 'Commissioni',
    layout: 'app',
    commissioni: db.commissioni,
    unreadCount: 0
  });
});

router.get('/audit', (req, res) => {
  res.render('pages/admin/audit', {
    title: 'Audit Log',
    layout: 'app',
    auditLog: db.auditLog,
    unreadCount: 0
  });
});

router.get('/blueprint', (req, res) => {
  const docsDir = path.join(__dirname, '..', 'docs');
  const docPreview = fs.readFileSync(path.join(docsDir, 'marketplace-blueprint.md'), 'utf8')
    .split('\n')
    .slice(0, 32)
    .join('\n');
  const sqlPreview = fs.readFileSync(path.join(docsDir, 'marketplace-schema.sql'), 'utf8')
    .split('\n')
    .slice(0, 42)
    .join('\n');

  res.render('pages/admin/blueprint', {
    title: 'Architecture & Compliance',
    layout: 'app',
    blueprint,
    marketplaceDemo,
    docPreview,
    sqlPreview,
    stats: {
      domains: blueprint.databaseDomains.length,
      agents: blueprint.agentMesh.length,
      workers: marketplaceDemo.workers.length,
      restaurants: marketplaceDemo.restaurants.length,
      alerts: marketplaceDemo.complianceAlerts.length
    },
    unreadCount: 0
  });
});

router.get('/legal-billing', async (req, res) => {
  const prisma = getPrismaClient();
  const docsDir = path.join(__dirname, '..', 'docs');
  const legalAuditPreview = fs.readFileSync(path.join(docsDir, 'legal-architecture-audit.md'), 'utf8')
    .split('\n')
    .slice(0, 42)
    .join('\n');

  let stats = {
    longContracts: 0,
    plannedMilestones: 0,
    processingMilestones: 0,
    openInvoices: 0,
    paidInvoices: 0
  };
  let longContracts = [];
  let invoices = [];
  let policyVersion = 'runtime_default';

  if (prisma) {
    const [
      policyRule,
      contractRows,
      invoiceRows,
      milestoneCounts
    ] = await Promise.all([
      prisma.policyRule.findUnique({
        where: {
          policyKey: 'marketplace_compliance'
        }
      }),
      prisma.serviceContract.findMany({
        where: {
          engagementType: 'long_term'
        },
        include: {
          workerProfile: {
            include: {
              user: true
            }
          },
          restaurantProfile: true,
          milestones: {
            orderBy: {
              sequence: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 8
      }),
      prisma.invoice.findMany({
        where: {
          contractMilestoneId: {
            not: null
          }
        },
        include: {
          serviceContract: {
            include: {
              workerProfile: {
                include: {
                  user: true
                }
              },
              restaurantProfile: true
            }
          }
        },
        orderBy: {
          issuedAt: 'desc'
        },
        take: 12
      }),
      prisma.contractMilestone.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      })
    ]);

    policyVersion = policyRule?.currentVersion || policyVersion;

    const milestoneMap = Object.fromEntries(
      milestoneCounts.map(item => [item.status, item._count.status])
    );

    stats = {
      longContracts: contractRows.length,
      plannedMilestones: milestoneMap.planned || 0,
      processingMilestones: (milestoneMap.processing || 0) + (milestoneMap.invoiced || 0),
      openInvoices: invoiceRows.filter(item => ['draft', 'open', 'overdue'].includes(item.invoiceStatus)).length,
      paidInvoices: invoiceRows.filter(item => item.invoiceStatus === 'paid').length
    };

    longContracts = contractRows.map(item => ({
      id: item.id,
      workerName: item.workerProfile.user.displayName,
      restaurantName: item.restaurantProfile.brandName,
      objectiveSummary: item.objectiveSummary,
      totalGrossEur: item.grossAmountEur,
      pdfUrl: item.pdfUrl,
      paymentTerms: `${String(item.paymentTermsDays || 'd0').replace('d', '')} giorni ${item.paymentTermsBase === 'end_of_month' ? 'fine mese' : 'data fattura'}`,
      milestoneCount: item.milestones.length,
      status: item.status
    }));

    invoices = invoiceRows.map(item => ({
      id: item.id,
      number: item.externalNumber,
      contractId: item.serviceContractId,
      workerName: item.serviceContract?.workerProfile?.user?.displayName || 'n/d',
      restaurantName: item.serviceContract?.restaurantProfile?.brandName || 'n/d',
      amountEur: item.amountEur,
      invoiceStatus: item.invoiceStatus,
      dueDate: item.dueDate,
      paidAt: item.paidAt
    }));
  }

  res.render('pages/admin/legal-billing', {
    title: 'Legal & Billing Console',
    layout: 'app',
    stats,
    longContracts,
    invoices,
    policyVersion,
    legalAuditPreview,
    workers: db.getCamerieri(),
    restaurants: db.getRistoranti(),
    unreadCount: 0
  });
});

module.exports = router;
