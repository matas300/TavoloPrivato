const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { evaluatePairCompliance, persistComplianceEvaluation } = require('./compliance-agent');
const {
  buildMonthlyMilestones,
  normalizePaymentTermsBase,
  normalizePaymentTermsDays
} = require('./payment-agent');

const LEGAL_CONTRACT_TITLE = "Contratto di Prestazione d'Opera Autonoma ex art. 2222 C.c.";
const DEFAULT_PLATFORM_FEE_PCT = 13.33;
const FORBIDDEN_TERMS = [
  /assunzion/i,
  /datore di lavoro/i,
  /dipendent/i,
  /stipendi/i,
  /orario di lavoro fisso/i
];

function slugify(value) {
  return String(value || 'contract')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function timestampPart() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function ensureSafeText(value, fieldName) {
  const text = String(value || '').trim();

  for (const pattern of FORBIDDEN_TERMS) {
    if (pattern.test(text)) {
      throw new Error(`Il campo "${fieldName}" contiene terminologia non consentita per un contratto autonomo.`);
    }
  }

  return text;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function computePlatformFeePct(servicePackage, inputPct) {
  if (Number.isFinite(Number(inputPct)) && Number(inputPct) >= 0) {
    return Number(inputPct);
  }

  if (servicePackage?.splitRule?.platformSharePct != null) {
    return Number(servicePackage.splitRule.platformSharePct);
  }

  return DEFAULT_PLATFORM_FEE_PCT;
}

function buildContractSnapshot({ contractInput, workerProfile, restaurantProfile, milestones }) {
  const clauses = [
    {
      heading: 'Oggetto della prestazione',
      body: `Il Committente affida al Prestatore d'Opera il seguente servizio: ${contractInput.objectiveSummary}. La prestazione e definita per risultato di servizio, presidio ospiti e coordinamento operativo della sala.`
    },
    {
      heading: 'Autonomia organizzativa',
      body: "Il Prestatore d'Opera svolge l'incarico con piena autonomia tecnico-organizzativa, senza vincoli di inserimento gerarchico e senza obbligo di disponibilita continuativa oltre il perimetro del servizio concordato."
    },
    {
      heading: 'Corrispettivo',
      body: `Il corrispettivo complessivo pattuito e EUR ${contractInput.grossAmountEur.toFixed(2)}, con fee piattaforma inclusa e ripartizione economica dettagliata nel piano milestone allegato.`
    },
    {
      heading: 'Termini di pagamento',
      body: `I pagamenti maturano su base mensile e seguono termini ${contractInput.paymentTermsDays.replace('d', '')} giorni ${contractInput.paymentTermsBase === 'end_of_month' ? 'data fine mese' : 'data fattura'}.`
    },
    {
      heading: 'Manleva e responsabilita',
      body: "Il Prestatore d'Opera si impegna a tenere indenne il gestore del marketplace e il Committente da pretese di terzi, danni o infortuni riconducibili a condotte imputabili alla propria sfera professionale, fatti salvi i limiti inderogabili di legge."
    },
    {
      heading: 'Ruolo del marketplace',
      body: "Il marketplace opera quale infrastruttura tecnica di matching, documentazione e incasso commissionale, senza ingerirsi nell'esecuzione autonoma della prestazione."
    }
  ];

  return {
    title: LEGAL_CONTRACT_TITLE,
    restaurant: {
      id: restaurantProfile.id,
      brandName: restaurantProfile.brandName,
      legalName: restaurantProfile.organization.legalName,
      vatNumber: restaurantProfile.organization.vatNumber
    },
    worker: {
      id: workerProfile.id,
      displayName: workerProfile.user.displayName,
      vatNumber: workerProfile.vatNumber,
      taxMode: workerProfile.taxMode
    },
    objectiveSummary: contractInput.objectiveSummary,
    scopeOfWork: contractInput.scopeOfWorkJson,
    clauses,
    milestones: milestones.map(item => ({
      sequence: item.sequence,
      label: item.milestoneLabel,
      grossAmountEur: item.grossAmountEur,
      platformFeeEur: item.platformFeeEur,
      workerNetEur: item.workerNetEur,
      invoiceDate: item.invoiceDate,
      dueDate: item.dueDate
    }))
  };
}

function generateContractPdf(payload) {
  const rootDir = path.join(__dirname, '..');
  const tmpDir = path.join(rootDir, 'tmp', 'pdfs');
  const outputDir = path.join(rootDir, 'output', 'pdf', 'contracts');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = `contract-${payload.contract.id}-${slugify(payload.restaurant.brandName)}-${timestampPart()}`;
  const inputPath = path.join(tmpDir, `${baseName}.json`);
  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  const scriptPath = path.join(rootDir, 'scripts', 'generate_contract_pdf.py');

  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2), 'utf8');

  const run = spawnSync('python', [scriptPath, inputPath, outputPath], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  try {
    fs.unlinkSync(inputPath);
  } catch (error) {
    // Best effort cleanup.
  }

  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || 'Errore nella generazione del contratto PDF');
  }

  return {
    outputPath,
    publicUrl: `/output/pdf/contracts/${path.basename(outputPath)}`
  };
}

async function nextContractId(prisma) {
  const row = await prisma.serviceContract.findFirst({
    orderBy: {
      id: 'desc'
    },
    select: {
      id: true
    }
  });

  return (row?.id || 0) + 1;
}

async function createLongTermContract(prisma, rawInput) {
  const startDate = new Date(rawInput.startDate);
  const endDate = new Date(rawInput.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Date del contratto non valide.');
  }

  const estimatedServiceDays = parseInt(rawInput.estimatedServiceDays, 10);
  if (!Number.isFinite(estimatedServiceDays) || estimatedServiceDays <= 0) {
    throw new Error('estimatedServiceDays deve essere un numero positivo.');
  }

  const serviceRequest = rawInput.serviceRequestId
    ? await prisma.serviceRequest.findUnique({
      where: { id: parseInt(rawInput.serviceRequestId, 10) },
      include: {
        servicePackage: {
          include: {
            splitRule: true
          }
        }
      }
    })
    : null;

  const [workerProfile, restaurantProfile] = await Promise.all([
    prisma.workerProfile.findUnique({
      where: { id: parseInt(rawInput.workerProfileId, 10) },
      include: {
        user: true
      }
    }),
    prisma.restaurantProfile.findUnique({
      where: { id: parseInt(rawInput.restaurantProfileId, 10) },
      include: {
        organization: true,
        owner: true
      }
    })
  ]);

  if (!workerProfile || !restaurantProfile) {
    throw new Error('Profilo worker o ristorante non trovato.');
  }

  const template = await prisma.contractTemplate.findFirst({
    where: {
      active: true,
      mode: workerProfile.taxMode
    },
    orderBy: {
      id: 'asc'
    }
  });

  const objectiveSummary = ensureSafeText(rawInput.objectiveSummary, 'objectiveSummary');
  const scopeOfWorkJson = Array.isArray(rawInput.scopeOfWorkJson)
    ? rawInput.scopeOfWorkJson.map((item, index) => ensureSafeText(item, `scopeOfWorkJson[${index}]`))
    : [
      objectiveSummary,
      ensureSafeText(rawInput.serviceResultLabel || 'Presidio del servizio di sala e coordinamento ospiti.', 'serviceResultLabel')
    ];

  const paymentTermsDays = normalizePaymentTermsDays(rawInput.paymentTermsDays || serviceRequest?.paymentTermsDays);
  const paymentTermsBase = normalizePaymentTermsBase(rawInput.paymentTermsBase || serviceRequest?.paymentTermsBase);
  const grossAmountEur = money(rawInput.grossAmountEur || 0);
  const monthlyGrossAmountEur = rawInput.monthlyGrossAmountEur == null ? null : money(rawInput.monthlyGrossAmountEur);
  const platformFeePct = computePlatformFeePct(serviceRequest?.servicePackage, rawInput.platformFeePct);

  if (!grossAmountEur && !monthlyGrossAmountEur) {
    throw new Error('Serve grossAmountEur o monthlyGrossAmountEur per generare il contratto lungo.');
  }

  const milestones = buildMonthlyMilestones({
    startDate,
    endDate,
    grossAmountEur: grossAmountEur || null,
    monthlyGrossAmountEur,
    paymentTermsDays,
    paymentTermsBase,
    platformFeePct
  });

  const totalGrossAmountEur = milestones.reduce((sum, item) => sum + item.grossAmountEur, 0);
  const totalPlatformFeeEur = milestones.reduce((sum, item) => sum + item.platformFeeEur, 0);
  const totalWorkerNetEur = milestones.reduce((sum, item) => sum + item.workerNetEur, 0);

  const compliance = await evaluatePairCompliance(prisma, {
    workerProfileId: workerProfile.id,
    restaurantProfileId: restaurantProfile.id,
    proposal: {
      grossAmountEur: totalGrossAmountEur,
      estimatedServiceDays
    }
  });

  await persistComplianceEvaluation(prisma, compliance, {
    serviceRequestId: serviceRequest?.id || null
  });

  if (compliance.decision === 'hard_stop') {
    throw new Error(`Contratto bloccato dal ComplianceAgent: ${compliance.reasons.map(reason => reason.message).join(' ')}`);
  }

  const contractId = await nextContractId(prisma);
  const contractInput = {
    id: contractId,
    serviceRequestId: serviceRequest?.id || null,
    workerProfileId: workerProfile.id,
    restaurantProfileId: restaurantProfile.id,
    contractMode: workerProfile.taxMode,
    templateId: template?.id || null,
    contractTitle: LEGAL_CONTRACT_TITLE,
    engagementType: 'long_term',
    objectiveSummary,
    scopeOfWorkJson,
    grossAmountEur: totalGrossAmountEur,
    platformFeeEur: totalPlatformFeeEur,
    workerNetEur: totalWorkerNetEur,
    serviceDate: startDate,
    serviceStartDate: startDate,
    serviceEndDate: endDate,
    estimatedServiceDays,
    monthlyGrossAmountEur: money(totalGrossAmountEur / milestones.length),
    paymentTermsDays,
    paymentTermsBase,
    billingFrequency: 'monthly',
    serviceType: rawInput.serviceType || serviceRequest?.servicePackage?.serviceType || 'long_service',
    status: 'awaiting_signature'
  };

  const snapshot = buildContractSnapshot({
    contractInput,
    workerProfile,
    restaurantProfile,
    milestones
  });

  const contract = await prisma.serviceContract.create({
    data: {
      ...contractInput,
      contractSnapshot: snapshot
    }
  });

  const createdMilestones = [];
  for (const milestone of milestones) {
    const created = await prisma.contractMilestone.create({
      data: {
        serviceContractId: contract.id,
        sequence: milestone.sequence,
        milestoneLabel: milestone.milestoneLabel,
        periodStart: milestone.periodStart,
        periodEnd: milestone.periodEnd,
        invoiceDate: milestone.invoiceDate,
        dueDate: milestone.dueDate,
        grossAmountEur: milestone.grossAmountEur,
        platformFeeEur: milestone.platformFeeEur,
        workerNetEur: milestone.workerNetEur,
        status: milestone.status
      }
    });
    createdMilestones.push(created);
  }

  const pdf = generateContractPdf({
    contract: {
      ...contractInput,
      id: contract.id
    },
    restaurant: snapshot.restaurant,
    worker: snapshot.worker,
    clauses: snapshot.clauses,
    scopeOfWork: snapshot.scopeOfWork,
    milestones: createdMilestones
  });

  await prisma.serviceContract.update({
    where: { id: contract.id },
    data: {
      pdfUrl: pdf.publicUrl
    }
  });

  await prisma.auditLog.create({
    data: {
      actorEmail: 'contract-agent@system',
      actionKey: 'contract_generated',
      targetTable: 'ServiceContract',
      targetId: String(contract.id),
      contextPayload: {
        title: LEGAL_CONTRACT_TITLE,
        workerProfileId: workerProfile.id,
        restaurantProfileId: restaurantProfile.id,
        pdfUrl: pdf.publicUrl,
        complianceDecision: compliance.decision
      }
    }
  });

  return {
    contractId: contract.id,
    pdfUrl: pdf.publicUrl,
    milestones: createdMilestones,
    compliance
  };
}

module.exports = {
  LEGAL_CONTRACT_TITLE,
  FORBIDDEN_TERMS,
  createLongTermContract,
  generateContractPdf
};
