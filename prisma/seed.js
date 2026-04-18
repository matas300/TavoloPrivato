const { PrismaClient } = require('@prisma/client');
process.env.TAVOLOLIBERO_DISABLE_RUNTIME_HYDRATION = '1';
const db = require('../data/mock');
const marketplace = require('../data/marketplace-service');
const blueprint = require('../data/marketplace-blueprint');
const { DEFAULT_POLICY, evaluatePairCompliance } = require('../lib/compliance-agent');
const { LEGAL_CONTRACT_TITLE, createLongTermContract } = require('../lib/contract-agent');
const { runMonthlyBillingCycle, captureDuePaymentOrders } = require('../lib/payment-agent');

const prisma = new PrismaClient();

function parseDate(value, fallbackTime = '12:00:00') {
  if (!value) return null;
  if (value.includes('T')) return new Date(value);
  if (value.includes(' ')) return new Date(value.replace(' ', 'T') + ':00');
  return new Date(`${value}T${fallbackTime}`);
}

function packageIdFor(restaurantId, index) {
  return restaurantId * 100 + index + 1;
}

function venueIdFor(restaurantId) {
  return restaurantId * 10;
}

function mapContractStatus(status) {
  if (status === 'confermato') return 'awaiting_signature';
  if (status === 'completato' || status === 'pagato') return 'completed';
  return 'draft';
}

function mapPaymentStatus(status) {
  if (status === 'completato' || status === 'pagato') return 'captured';
  if (status === 'confermato') return 'created';
  return 'failed';
}

function mapPayoutStatus(status) {
  if (status === 'completato' || status === 'pagato') return 'released';
  if (status === 'confermato') return 'pending';
  return 'failed';
}

function mapInvoiceStatus(status) {
  if (status === 'completato' || status === 'pagato') return 'paid';
  if (status === 'confermato') return 'open';
  return 'draft';
}

function mapSeverity(value) {
  if (value === 'alta' || value === 'high') return 'high';
  if (value === 'media' || value === 'medium') return 'medium';
  return 'low';
}

function mapAlertStatus(value) {
  if (value === 'in_lavorazione') return 'in_review';
  if (value === 'monitorato') return 'resolved';
  if (value === 'archiviato') return 'dismissed';
  return 'open';
}

async function resetDatabase() {
  const tables = [
    prisma.outboxEvent,
    prisma.auditLog,
    prisma.earningsScenario,
    prisma.nonRenewal,
    prisma.reviewAggregate,
    prisma.platformSetting,
    prisma.review,
    prisma.reviewEvent,
    prisma.agentDecision,
    prisma.agentJob,
    prisma.manualReview,
    prisma.complianceAlert,
    prisma.complianceSnapshot,
    prisma.policyRule,
    prisma.pairMetric,
    prisma.contractMilestone,
    prisma.invoice,
    prisma.refund,
    prisma.escrowLedger,
    prisma.payout,
    prisma.paymentOrder,
    prisma.contractSignature,
    prisma.serviceContract,
    prisma.contractTemplate,
    prisma.trialService,
    prisma.message,
    prisma.chatThread,
    prisma.interview,
    prisma.matchRanking,
    prisma.match,
    prisma.serviceRequest,
    prisma.splitRule,
    prisma.servicePackage,
    prisma.formerEmployer,
    prisma.taxProfile,
    prisma.workerDocument,
    prisma.workerCertification,
    prisma.workerSkill,
    prisma.workerPreference,
    prisma.workerProfile,
    prisma.venue,
    prisma.restaurantProfile,
    prisma.organization,
    prisma.session,
    prisma.consent,
    prisma.userIdentity,
    prisma.user,
    prisma.counterpartyGroup
  ];

  for (const table of tables) {
    await table.deleteMany();
  }
}

async function seedUsers() {
  for (const user of db.seed.users) {
    await prisma.user.create({
      data: {
        id: user.id,
        role: user.role,
        email: user.email,
        passwordHash: user.password,
        isVerified: Boolean(user.verificato),
        displayName: user.name,
        initials: user.initials,
        status: 'active'
      }
    });

    await prisma.userIdentity.create({
      data: {
        userId: user.id,
        provider: 'email',
        providerSubject: user.email
      }
    });

    await prisma.consent.createMany({
      data: [
        {
          userId: user.id,
          consentKey: 'terms',
          consentVersion: '2026-04',
          granted: true
        },
        {
          userId: user.id,
          consentKey: 'privacy',
          consentVersion: '2026-04',
          granted: true
        }
      ]
    });
  }
}

async function seedOrganizationsAndProfiles() {
  await prisma.counterpartyGroup.create({
    data: {
      id: 1,
      groupKey: 'default-demo-group',
      displayName: 'Default Demo Hospitality Group'
    }
  });

  for (const restaurantUser of db.getRistoranti()) {
    const restaurant = marketplace.getEnhancedRestaurant(restaurantUser.id);

    await prisma.organization.create({
      data: {
        id: restaurantUser.id,
        legalName: restaurant.name,
        vatNumber: `ITDEMO${restaurantUser.id.toString().padStart(7, '0')}`,
        city: restaurant.zona,
        counterpartyGroupId: 1
      }
    });

    await prisma.restaurantProfile.create({
      data: {
        id: restaurantUser.id,
        organizationId: restaurantUser.id,
        ownerUserId: restaurantUser.id,
        brandName: restaurant.name,
        cuisineType: restaurant.tipoCucina,
        vibeTags: restaurant.vibe,
        averageTicketEur: restaurant.avgTicketEur || 0,
        description: restaurant.brandStory,
        ratingAvg: restaurant.rating,
        ratingCount: restaurant.ratingCount
      }
    });

    await prisma.venue.create({
      data: {
        id: venueIdFor(restaurantUser.id),
        organizationId: restaurantUser.id,
        restaurantId: restaurantUser.id,
        venueName: restaurant.name,
        addressLine: restaurant.indirizzo,
        city: restaurant.zona,
        indoorCapacity: restaurant.capienza
      }
    });

    for (const [index, pkg] of restaurant.servicePackages.entries()) {
      const packageId = packageIdFor(restaurantUser.id, index);
      await prisma.servicePackage.create({
        data: {
          id: packageId,
          restaurantProfileId: restaurantUser.id,
          venueId: venueIdFor(restaurantUser.id),
          packageName: pkg.name,
          serviceResultLabel: pkg.resultLabel,
          roleNeeded: pkg.roleNeeded,
          flatFeeEur: pkg.flatFeeEur,
          serviceDurationLabel: 'giornata',
          serviceType: pkg.serviceType || 'cena',
          active: true
        }
      });

      await prisma.splitRule.create({
        data: {
          servicePackageId: packageId,
          workerSharePct: Math.round(((pkg.flatFeeEur - 20) / pkg.flatFeeEur) * 10000) / 100,
          platformSharePct: Math.round((20 / pkg.flatFeeEur) * 10000) / 100,
          notes: 'Demo split rule generated from current package pricing.'
        }
      });
    }
  }

  for (const workerUser of db.getCamerieri()) {
    const worker = marketplace.getEnhancedWorker(workerUser.id);

    await prisma.workerProfile.create({
      data: {
        id: workerUser.id,
        userId: workerUser.id,
        taxMode: worker.taxMode,
        vatNumber: worker.pivaLast4 ? `ITDEMO${worker.pivaLast4}` : worker.vatNumber || null,
        headline: worker.headline,
        bio: worker.bio,
        homeCity: worker.zona,
        yearsExperience: worker.esperienza,
        minimumFeeEur: worker.pagaMin,
        ratingAvg: worker.rating,
        ratingCount: worker.ratingCount,
        availabilityJson: worker.disponibilita,
        profileCompleteness: worker.profileCompleteness,
        safeHarborCandidate: worker.safeHarborCandidate,
        isSeniorExempt: worker.safeHarborCandidate
      }
    });

    await prisma.workerPreference.create({
      data: {
        workerProfileId: workerUser.id,
        preferredZones: worker.preferredZones,
        preferredServiceTypes: worker.preferredFormats,
        preferredShiftLabels: Object.keys(worker.disponibilita).filter(key => worker.disponibilita[key])
      }
    });

    for (const skill of worker.hardSkills) {
      await prisma.workerSkill.create({
        data: {
          workerProfileId: workerUser.id,
          skillCode: skill,
          skillLevel: worker.esperienza >= 8 ? 'expert' : worker.esperienza >= 4 ? 'advanced' : 'basic',
          verified: worker.verificato
        }
      });
    }

    for (const certification of worker.certifications) {
      await prisma.workerCertification.create({
        data: {
          workerProfileId: workerUser.id,
          certificationName: certification,
          verified: worker.verificato
        }
      });
    }

    for (const formerEmployer of worker.exEmployers) {
      await prisma.formerEmployer.create({
        data: {
          workerProfileId: workerUser.id,
          employerName: formerEmployer,
          endedOn: parseDate('2024-09-30')
        }
      });
    }

    await prisma.taxProfile.create({
      data: {
        workerProfileId: workerUser.id,
        annualGrossYtdEur: worker.fiscalGrossYtdEur,
        platformGrossYtdEur: worker.ytdEarnings || worker.fiscalGrossYtdEur,
        largestCounterpartyShare: marketplace.getWorkerDashboard(workerUser.id).topCounterparty.share24m,
        riskBand: worker.thresholdPct >= 90 ? 'high' : worker.thresholdPct >= 75 ? 'warn' : 'ok'
      }
    });
  }
}

async function seedRequestsAndMatching() {
  for (const annuncio of db.seed.annunci) {
    const restaurant = marketplace.getEnhancedRestaurant(annuncio.ristoranteId);
    const packageIndex = restaurant.servicePackages.findIndex(pkg => pkg.serviceType === annuncio.tipo);
    const servicePackageId = packageIndex >= 0 ? packageIdFor(annuncio.ristoranteId, packageIndex) : null;

    await prisma.serviceRequest.create({
      data: {
        id: annuncio.id,
        restaurantProfileId: annuncio.ristoranteId,
        venueId: venueIdFor(annuncio.ristoranteId),
        servicePackageId,
        requestedDate: parseDate(annuncio.data),
        requestedSkills: annuncio.qualifiche,
        notes: annuncio.desc,
        status: annuncio.stato === 'aperto' ? 'open' : 'cancelled'
      }
    });

    const rankedWorkers = db.getCamerieri()
      .map(worker => {
        const profile = marketplace.getWorkerMatchesForRestaurant(annuncio.ristoranteId)
          .find(item => item.id === worker.id);
        return profile;
      })
      .filter(Boolean)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    for (const [index, worker] of rankedWorkers.entries()) {
      await prisma.match.create({
        data: {
          serviceRequestId: annuncio.id,
          workerProfileId: worker.id,
          rankingScore: worker.matchScore / 100,
          complianceState: worker.compliance.decision,
          matchStatus: index === 0 ? 'proposed' : 'accepted'
        }
      });

      await prisma.matchRanking.create({
        data: {
          serviceRequestId: annuncio.id,
          workerProfileId: worker.id,
          score: worker.matchScore / 100,
          rationale: {
            zone: worker.zona,
            skills: worker.qualifiche,
            compliance: worker.compliance
          }
        }
      });
    }
  }
}

async function seedChats() {
  const threadMap = new Map();
  let threadId = 1;

  for (const msg of db.seed.messaggi) {
    const workerId = msg.from < 10 ? msg.from : msg.to;
    const restaurantId = msg.from >= 10 && msg.from < 99 ? msg.from : msg.to;
    const key = `${workerId}:${restaurantId}`;

    if (!threadMap.has(key)) {
      const created = await prisma.chatThread.create({
        data: {
          id: threadId,
          workerProfileId: workerId,
          restaurantProfileId: restaurantId
        }
      });
      threadMap.set(key, created.id);
      threadId += 1;
    }

    await prisma.message.create({
      data: {
        id: msg.id,
        chatThreadId: threadMap.get(key),
        senderUserId: msg.from,
        messageBody: msg.text,
        sentAt: parseDate(msg.time),
        readAt: msg.read ? parseDate(msg.time) : null
      }
    });
  }
}

async function seedContractsAndPayments() {
  await prisma.contractTemplate.createMany({
    data: [
      {
        id: 1,
        templateKey: 'autonomo_occasionale_v1',
        mode: 'autonomo_occasionale',
        title: 'Prestazione autonoma occasionale',
        bodyMd: 'Template demo per prestazioni occasionali.'
      },
      {
        id: 2,
        templateKey: 'forfettario_v1',
        mode: 'forfettario',
        title: 'Prestazione professionale in regime forfettario',
        bodyMd: 'Template demo per professionisti in forfettario.'
      }
    ]
  });

  for (const contract of db.seed.contratti) {
    const worker = marketplace.getEnhancedWorker(contract.cameriereId);
    const templateId = worker.taxMode === 'forfettario' ? 2 : 1;
    const matchingRequest = db.seed.annunci.find(request =>
      request.ristoranteId === contract.ristoranteId &&
      request.tipo === contract.tipo &&
      request.data === contract.data
    );

    await prisma.serviceContract.create({
      data: {
        id: contract.id,
        serviceRequestId: matchingRequest ? matchingRequest.id : null,
        workerProfileId: contract.cameriereId,
        restaurantProfileId: contract.ristoranteId,
        contractMode: worker.taxMode,
        templateId,
        contractTitle: LEGAL_CONTRACT_TITLE,
        engagementType: 'one_off',
        objectiveSummary: `Prestazione autonoma di ${contract.tipo} per servizio di sala e presidio ospiti.`,
        scopeOfWorkJson: [
          `Gestione del servizio ${contract.tipo}`,
          'Presidio ospiti, flusso tavoli e coordinamento operativo della sala'
        ],
        taxableAmountEur: contract.compensoCam + contract.commissione,
        platformFeeEur: contract.commissione,
        workerNetEur: contract.compensoCam,
        serviceDate: parseDate(contract.data),
        serviceStartDate: parseDate(contract.data),
        serviceEndDate: parseDate(contract.data),
        estimatedServiceDays: 1,
        monthlyGrossAmountEur: contract.compensoCam + contract.commissione,
        paymentTermsDays: 'd0',
        paymentTermsBase: 'invoice_date',
        billingFrequency: 'single',
        serviceType: contract.tipo,
        status: mapContractStatus(contract.stato),
        contractSnapshot: {
          title: LEGAL_CONTRACT_TITLE,
          serviceType: contract.tipo,
          paymentTermsDays: 'd0',
          paymentTermsBase: 'invoice_date'
        }
      }
    });

    if (contract.stato !== 'confermato') {
      await prisma.contractSignature.createMany({
        data: [
          {
            serviceContractId: contract.id,
            signerUserId: contract.cameriereId,
            signedAt: parseDate(contract.data, '09:00:00'),
            signatureProvider: 'demo_checkbox',
            ipAddress: '127.0.0.1'
          },
          {
            serviceContractId: contract.id,
            signerUserId: contract.ristoranteId,
            signedAt: parseDate(contract.data, '09:05:00'),
            signatureProvider: 'demo_checkbox',
            ipAddress: '127.0.0.1'
          }
        ]
      });
    }

    const milestone = await prisma.contractMilestone.create({
      data: {
        serviceContractId: contract.id,
        sequence: 1,
        milestoneLabel: `Corrispettivo ${contract.tipo}`,
        periodStart: parseDate(contract.data),
        periodEnd: parseDate(contract.data),
        invoiceDate: parseDate(contract.data, '18:00:00'),
        dueDate: parseDate(contract.data, '18:00:00'),
        taxableAmountEur: contract.compensoCam + contract.commissione,
        platformFeeEur: contract.commissione,
        workerNetEur: contract.compensoCam,
        status: contract.stato === 'confermato' ? 'processing' : 'paid',
        providerInvoiceId: `in_demo_${contract.id}_1`
      }
    });

    await prisma.paymentOrder.create({
      data: {
        serviceContractId: contract.id,
        contractMilestoneId: milestone.id,
        provider: 'stripe_connect',
        providerPaymentIntentId: `pi_demo_${contract.id}`,
        providerInvoiceId: `in_demo_${contract.id}_1`,
        amountTotalEur: contract.compensoCam + contract.commissione,
        platformFeeEur: contract.commissione,
        payoutAmountEur: contract.compensoCam,
        status: mapPaymentStatus(contract.stato),
        scheduledCaptureAt: parseDate(contract.data, '18:00:00'),
        capturedAt: contract.stato === 'confermato' ? null : parseDate(contract.data, '23:00:00'),
        dueDate: parseDate(contract.data, '18:00:00')
      }
    });

    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: { contractMilestoneId: milestone.id }
    });

    await prisma.escrowLedger.createMany({
      data: [
        {
          paymentOrderId: paymentOrder.id,
          entryType: 'capture',
          amountEur: contract.compensoCam + contract.commissione,
          metadata: { contractId: contract.id }
        },
        {
          paymentOrderId: paymentOrder.id,
          entryType: 'platform_fee',
          amountEur: contract.commissione,
          metadata: { contractId: contract.id }
        }
      ]
    });

    await prisma.payout.create({
      data: {
        paymentOrderId: paymentOrder.id,
        workerProfileId: contract.cameriereId,
        payoutAmountEur: contract.compensoCam,
        status: mapPayoutStatus(contract.stato),
        releasedAt: contract.stato === 'confermato' ? null : parseDate(contract.data, '23:00:00')
      }
    });

    await prisma.invoice.create({
      data: {
        paymentOrderId: paymentOrder.id,
        serviceContractId: contract.id,
        contractMilestoneId: milestone.id,
        invoiceType: 'contract_milestone',
        externalNumber: `INV-DEMO-${contract.id}`,
        providerInvoiceId: `in_demo_${contract.id}_1`,
        invoiceStatus: mapInvoiceStatus(contract.stato),
        amountEur: contract.compensoCam + contract.commissione
        ,
        dueDate: parseDate(contract.data, '18:00:00'),
        paidAt: contract.stato === 'confermato' ? null : parseDate(contract.data, '23:00:00'),
        paymentTermsDays: 'd0',
        paymentTermsBase: 'invoice_date'
      }
    });
  }
}

async function seedPairMetricsAndCompliance() {
  await prisma.platformSetting.create({
    data: {
      settingKey: 'commissioni',
      valueJson: db.seed.commissioni
    }
  });

  await prisma.policyRule.create({
    data: {
      id: 1,
      policyKey: 'marketplace_compliance',
      currentVersion: 'v2_2026_04_05',
      thresholdsJson: {
        ...DEFAULT_POLICY,
        blueprintReference: blueprint.complianceEngine.thresholds
      }
    }
  });

  const uniquePairs = new Set(
    db.seed.contratti.map(item => `${item.cameriereId}:${item.ristoranteId}`)
  );

  for (const key of uniquePairs) {
    const [workerId, restaurantId] = key.split(':').map(Number);
    const contracts = db.seed.contratti.filter(item => item.cameriereId === workerId && item.ristoranteId === restaurantId);
    const gross = contracts.reduce((sum, item) => sum + item.compensoCam + item.commissione, 0);
    const metrics = await evaluatePairCompliance(prisma, {
      workerProfileId: workerId,
      restaurantProfileId: restaurantId
    });

    const pairMetric = await prisma.pairMetric.create({
      data: {
        workerProfileId: workerId,
        restaurantProfileId: restaurantId,
        days12m: Math.min(metrics.current.days24m, contracts.length),
        days24m: metrics.current.days24m,
        gross12mEur: gross,
        gross24mEur: gross,
        workerRevenueShare12m: metrics.current.share24m,
        workerRevenueShare24m: metrics.current.share24m,
        controlScore: metrics.controlScore
      }
    });

    await prisma.complianceSnapshot.create({
      data: {
        pairMetricId: pairMetric.id,
        policyRuleId: 1,
        policyVersion: 'v2_2026_04_05',
        decisionState: metrics.decision,
        snapshotPayload: metrics
      }
    });
  }

  const snapshots = await prisma.complianceSnapshot.findMany();
  const adminAlerts = marketplace.getAdminAlerts();

  for (const [index, alert] of adminAlerts.entries()) {
    const pairFromTitle = alert.title && alert.title.includes(' x ') ? alert.title.split(' x ') : null;
    let workerProfileId = null;
    let restaurantProfileId = null;

    if (pairFromTitle) {
      const worker = db.getCamerieri().find(item => item.name === pairFromTitle[0]);
      const restaurant = db.getRistoranti().find(item => item.name === pairFromTitle[1]);
      workerProfileId = worker ? worker.id : null;
      restaurantProfileId = restaurant ? restaurant.id : null;
    } else {
      const matchedWorker = db.getCamerieri().find(item => item.name === alert.title);
      workerProfileId = matchedWorker ? matchedWorker.id : null;
    }

    const snapshot = snapshots.find(item => {
      if (!workerProfileId || !restaurantProfileId || !item.pairMetricId) return false;
      return true;
    }) || null;

    await prisma.complianceAlert.create({
      data: {
        id: index + 1,
        workerProfileId,
        restaurantProfileId,
        snapshotId: snapshot ? snapshot.id : null,
        alertType: alert.tipo,
        severity: mapSeverity(alert.severity),
        alertMessage: `${alert.desc} ${alert.recommendation}`,
        status: mapAlertStatus(alert.stato)
      }
    });
  }
}

async function seedLongTermContracts() {
  const contractDefinitions = [
    {
      workerProfileId: 3,
      restaurantProfileId: 10,
      startDate: '2025-12-01',
      endDate: '2026-04-30',
      estimatedServiceDays: 40,
      monthlyGrossAmountEur: 900,
      paymentTermsDays: 'd45',
      paymentTermsBase: 'end_of_month',
      serviceType: 'gestione_sala_stagionale',
      objectiveSummary: 'Gestione sala per stagione invernale e servizi di primavera con presidio ospiti, coordinamento ranghi e continuita dello standard premium.',
      scopeOfWorkJson: [
        'Presidio del servizio cena e supervisione del flusso di sala',
        'Coordinamento operativo dei ranghi nei weekend e negli eventi privati',
        'Accoglienza ospiti premium e supporto al pairing vini'
      ],
      targetStatus: 'signed',
      signatureDate: '2025-11-28'
    },
    {
      workerProfileId: 1,
      restaurantProfileId: 11,
      startDate: '2025-11-01',
      endDate: '2026-01-31',
      estimatedServiceDays: 24,
      monthlyGrossAmountEur: 600,
      paymentTermsDays: 'd15',
      paymentTermsBase: 'end_of_month',
      serviceType: 'servizio_sala_weekend',
      objectiveSummary: 'Presidio sala weekend, accoglienza ospiti e continuita del servizio per la stagione autunno-inverno.',
      scopeOfWorkJson: [
        'Coordinamento del servizio serale nei weekend ad alta intensita',
        'Gestione accoglienza ospiti e riallineamento mise en place',
        'Supporto al team di sala su flusso tavoli e chiusura operativa'
      ],
      targetStatus: 'completed',
      signatureDate: '2025-10-29'
    },
    {
      workerProfileId: 1,
      restaurantProfileId: 12,
      startDate: '2026-02-01',
      endDate: '2026-05-31',
      estimatedServiceDays: 32,
      monthlyGrossAmountEur: 600,
      paymentTermsDays: 'd30',
      paymentTermsBase: 'invoice_date',
      serviceType: 'guest_relations_premium',
      objectiveSummary: 'Servizio premium di sala e storytelling vini per tasting menu, ospiti business e cene degustazione.',
      scopeOfWorkJson: [
        'Presidio del servizio premium serale e coordinamento passaggi di sala',
        'Narrazione carta vini e supporto agli abbinamenti durante il tasting menu',
        'Gestione ospiti business e continuita dello standard fine dining'
      ],
      targetStatus: 'signed',
      signatureDate: '2026-01-29'
    }
  ];

  const createdContracts = [];

  for (const item of contractDefinitions) {
    const result = await createLongTermContract(prisma, item);
    createdContracts.push({
      ...item,
      contractId: result.contractId
    });

    await prisma.contractSignature.createMany({
      data: [
        {
          serviceContractId: result.contractId,
          signerUserId: item.workerProfileId,
          signedAt: parseDate(item.signatureDate, '10:00:00'),
          signatureProvider: 'demo_checkbox',
          ipAddress: '127.0.0.1'
        },
        {
          serviceContractId: result.contractId,
          signerUserId: item.restaurantProfileId,
          signedAt: parseDate(item.signatureDate, '10:05:00'),
          signatureProvider: 'demo_checkbox',
          ipAddress: '127.0.0.1'
        }
      ]
    });
  }

  const billingAsOfDate = '2026-04-05T12:00:00';
  await runMonthlyBillingCycle(prisma, { asOfDate: billingAsOfDate });
  await captureDuePaymentOrders(prisma, { asOfDate: billingAsOfDate });

  for (const item of createdContracts) {
    await prisma.serviceContract.update({
      where: { id: item.contractId },
      data: {
        status: item.targetStatus
      }
    });

    await prisma.auditLog.create({
      data: {
        actorEmail: 'seed@system',
        actionKey: 'long_contract_demo_seeded',
        targetTable: 'ServiceContract',
        targetId: String(item.contractId),
        contextPayload: {
          workerProfileId: item.workerProfileId,
          restaurantProfileId: item.restaurantProfileId,
          targetStatus: item.targetStatus
        }
      }
    });
  }
}

async function seedReviewsAuditAndAdmin() {
  for (const contract of db.seed.contratti) {
    if (contract.valRist) {
      await prisma.review.create({
        data: {
          serviceContractId: contract.id,
          reviewerUserId: contract.ristoranteId,
          revieweeUserId: contract.cameriereId,
          reliability: contract.valRist,
          punctuality: contract.valRist,
          professionalism: contract.valRist,
          commentText: contract.commentoRist
        }
      });
    }

    if (contract.valCam) {
      await prisma.review.create({
        data: {
          serviceContractId: contract.id,
          reviewerUserId: contract.cameriereId,
          revieweeUserId: contract.ristoranteId,
          reliability: contract.valCam,
          punctuality: contract.valCam,
          professionalism: contract.valCam,
          commentText: null
        }
      });
    }
  }

  const reviewees = [...new Set((await prisma.review.findMany()).map(item => item.revieweeUserId))];
  for (const userId of reviewees) {
    const reviews = await prisma.review.findMany({ where: { revieweeUserId: userId } });
    const reliabilityAvg = reviews.reduce((sum, item) => sum + item.reliability, 0) / reviews.length;
    const punctualityAvg = reviews.reduce((sum, item) => sum + item.punctuality, 0) / reviews.length;
    const professionalismAvg = reviews.reduce((sum, item) => sum + item.professionalism, 0) / reviews.length;

    await prisma.reviewAggregate.create({
      data: {
        userId,
        reliabilityAvg,
        punctualityAvg,
        professionalismAvg,
        overallAvg: (reliabilityAvg + punctualityAvg + professionalismAvg) / 3,
        reviewCount: reviews.length
      }
    });
  }

  for (const item of db.seed.nonRenewal) {
    await prisma.nonRenewal.create({
      data: {
        restaurantProfileId: item.ristoranteId,
        workerProfileId: item.cameriereId,
        reason: item.motivo,
        effectiveDate: parseDate(item.data)
      }
    });
  }

  for (const [index, item] of db.seed.auditLog.entries()) {
    const actor = db.seed.users.find(user => user.email === item.user);
    await prisma.auditLog.create({
      data: {
        id: index + 1,
        actorUserId: actor ? actor.id : null,
        actorEmail: item.user,
        actionKey: item.tipo,
        targetTable: 'marketplace',
        targetId: null,
        contextPayload: { action: item.action, time: item.time }
      }
    });
  }
}

async function main() {
  await resetDatabase();
  await seedUsers();
  await seedOrganizationsAndProfiles();
  await seedRequestsAndMatching();
  await seedChats();
  await seedContractsAndPayments();
  await seedPairMetricsAndCompliance();
  await seedLongTermContracts();
  await seedReviewsAuditAndAdmin();

  console.log('Prisma seed completed');
  console.log(`Users: ${db.seed.users.length}`);
  console.log(`Service requests: ${db.seed.annunci.length}`);
  console.log(`Contracts: ${db.seed.contratti.length} + 3 long-term demo`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
