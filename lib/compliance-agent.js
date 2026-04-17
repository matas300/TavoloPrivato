// Soglie operative (safety margin sotto i limiti legali 241gg/80%).
// Override via policy injection in evaluatePairCompliance(prisma, { ..., policy }).
const DEFAULT_POLICY = {
  maxPairDays24m: 200,
  maxPairShare24m: 0.70,
  warnPairDays24m: 170,
  warnPairShare24m: 0.60,
  exEmployerLookbackMonths: 24
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addMonths(value, months) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

function endOfMonth(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function countInclusiveDays(startValue, endValue) {
  const start = startOfDay(startValue);
  const end = startOfDay(endValue);
  const diff = Math.round((end - start) / 86400000);
  return Math.max(1, diff + 1);
}

function getContractWindow(contract) {
  const start = contract.serviceStartDate || contract.serviceDate;
  const end = contract.serviceEndDate || contract.serviceDate;
  return {
    start: startOfDay(start),
    end: startOfDay(end)
  };
}

function contractDays(contract) {
  if (contract.estimatedServiceDays) return contract.estimatedServiceDays;

  const window = getContractWindow(contract);
  return countInclusiveDays(window.start, window.end);
}

function overlapsWindow(contract, windowStart, windowEnd) {
  const window = getContractWindow(contract);
  return window.end >= windowStart && window.start <= windowEnd;
}

function isFormerEmployerMatch(workerProfile, restaurantProfile, lookbackStart) {
  const organization = restaurantProfile.organization || {};
  const groupKey = organization.counterpartyGroup?.groupKey || null;
  const legalName = normalizeText(organization.legalName);
  const brandName = normalizeText(restaurantProfile.brandName);
  const vatNumber = normalizeText(organization.vatNumber);

  const formerEmployer = (workerProfile.formerEmployers || []).find(item => {
    if (item.endedOn && new Date(item.endedOn) < lookbackStart) {
      return false;
    }

    if (groupKey && item.relatedGroupKey && item.relatedGroupKey === groupKey) {
      return true;
    }

    if (vatNumber && item.employerVatNumber && normalizeText(item.employerVatNumber) === vatNumber) {
      return true;
    }

    const employerName = normalizeText(item.employerName);
    return employerName && (employerName === legalName || employerName === brandName);
  });

  return formerEmployer || null;
}

function clampShare(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function buildReasons({ seniorExempt, formerEmployerMatch, projectedDays24m, projectedShare24m, policy }) {
  const reasons = [];

  if (seniorExempt) {
    reasons.push({
      code: 'safe_harbor',
      message: 'Profilo marcato come senior exempt: applicata esclusione dai blocchi automatici.'
    });
  }

  if (formerEmployerMatch) {
    reasons.push({
      code: 'ex_employer',
      message: 'Il committente risulta ex datore di lavoro negli ultimi 24 mesi.'
    });
  }

  if (projectedDays24m >= policy.maxPairDays24m) {
    reasons.push({
      code: 'days_limit',
      message: `Il rapporto proiettato raggiunge ${projectedDays24m} giorni negli ultimi 24 mesi.`
    });
  } else if (projectedDays24m >= policy.warnPairDays24m) {
    reasons.push({
      code: 'days_warning',
      message: `Il rapporto proiettato sale a ${projectedDays24m} giorni e richiede presidio.`
    });
  }

  if (projectedShare24m >= policy.maxPairShare24m) {
    reasons.push({
      code: 'share_limit',
      message: `La concentrazione proiettata sul committente sale al ${Math.round(projectedShare24m * 100)}%.`
    });
  } else if (projectedShare24m >= policy.warnPairShare24m) {
    reasons.push({
      code: 'share_warning',
      message: `La concentrazione proiettata sul committente sale al ${Math.round(projectedShare24m * 100)}%.`
    });
  }

  return reasons;
}

function computeDecision({ seniorExempt, formerEmployerMatch, projectedDays24m, projectedShare24m, policy }) {
  if (seniorExempt) {
    return 'allow';
  }

  if (formerEmployerMatch) {
    return 'hard_stop';
  }

  if (projectedDays24m >= policy.maxPairDays24m || projectedShare24m >= policy.maxPairShare24m) {
    return 'hard_stop';
  }

  if (projectedDays24m >= policy.warnPairDays24m || projectedShare24m >= policy.warnPairShare24m) {
    return 'manual_review';
  }

  return 'allow';
}

function computeControlScore(projectedDays24m, projectedShare24m, policy) {
  const daysRatio = Math.min(projectedDays24m / policy.maxPairDays24m, 1);
  const shareRatio = Math.min(projectedShare24m / policy.maxPairShare24m, 1);
  return Math.min(100, Math.round((daysRatio * 45) + (shareRatio * 55)) * 1);
}

async function loadPolicy(prisma) {
  const rule = await prisma.policyRule.findUnique({
    where: {
      policyKey: 'marketplace_compliance'
    }
  });

  return {
    ...DEFAULT_POLICY,
    ...(rule?.thresholdsJson || {})
  };
}

async function loadProfiles(prisma, workerProfileId, restaurantProfileId) {
  const [workerProfile, restaurantProfile] = await Promise.all([
    prisma.workerProfile.findUnique({
      where: { id: workerProfileId },
      include: {
        formerEmployers: true,
        user: true,
        taxProfile: true
      }
    }),
    prisma.restaurantProfile.findUnique({
      where: { id: restaurantProfileId },
      include: {
        organization: {
          include: {
            counterpartyGroup: true
          }
        },
        owner: true
      }
    })
  ]);

  if (!workerProfile) {
    throw new Error(`WorkerProfile ${workerProfileId} non trovato`);
  }

  if (!restaurantProfile) {
    throw new Error(`RestaurantProfile ${restaurantProfileId} non trovato`);
  }

  return { workerProfile, restaurantProfile };
}

function buildProjectedTotals(contracts, workerProfileId, restaurantProfileId, lookbackStart, proposal = null) {
  const windowEnd = new Date();

  const activeContracts = contracts.filter(contract => (
    contract.status !== 'voided'
    && overlapsWindow(contract, lookbackStart, windowEnd)
  ));

  const pairContracts = activeContracts.filter(contract => (
    contract.workerProfileId === workerProfileId
    && contract.restaurantProfileId === restaurantProfileId
  ));

  const workerContracts = activeContracts.filter(contract => contract.workerProfileId === workerProfileId);

  const pairGross24m = pairContracts.reduce((sum, contract) => sum + contract.grossAmountEur, 0);
  const workerGross24m = workerContracts.reduce((sum, contract) => sum + contract.grossAmountEur, 0);
  const pairDays24m = pairContracts.reduce((sum, contract) => sum + contractDays(contract), 0);

  const proposalGross = proposal?.grossAmountEur || 0;
  const proposalDays = proposal?.estimatedServiceDays || 0;

  const projectedPairGross24m = pairGross24m + proposalGross;
  const projectedWorkerGross24m = workerGross24m + proposalGross;
  const projectedDays24m = pairDays24m + proposalDays;
  const projectedShare24m = projectedWorkerGross24m
    ? clampShare(projectedPairGross24m / projectedWorkerGross24m)
    : 0;

  return {
    pairGross24m,
    workerGross24m,
    pairDays24m,
    projectedPairGross24m,
    projectedWorkerGross24m,
    projectedDays24m,
    projectedShare24m
  };
}

async function evaluatePairCompliance(prisma, options) {
  const now = options.now ? new Date(options.now) : new Date();
  const { workerProfileId, restaurantProfileId } = options;
  const policy = await loadPolicy(prisma);
  const lookbackStart = addMonths(now, -policy.exEmployerLookbackMonths);
  const { workerProfile, restaurantProfile } = await loadProfiles(prisma, workerProfileId, restaurantProfileId);

  const contracts = await prisma.serviceContract.findMany({
    where: {
      workerProfileId
    },
    select: {
      id: true,
      workerProfileId: true,
      restaurantProfileId: true,
      grossAmountEur: true,
      serviceDate: true,
      serviceStartDate: true,
      serviceEndDate: true,
      estimatedServiceDays: true,
      status: true
    }
  });

  const formerEmployerMatch = isFormerEmployerMatch(workerProfile, restaurantProfile, lookbackStart);
  const seniorExempt = Boolean(workerProfile.isSeniorExempt || workerProfile.safeHarborCandidate);
  const proposal = options.proposal || null;
  const totals = buildProjectedTotals(
    contracts,
    workerProfileId,
    restaurantProfileId,
    lookbackStart,
    proposal
  );

  const decision = computeDecision({
    seniorExempt,
    formerEmployerMatch,
    projectedDays24m: totals.projectedDays24m,
    projectedShare24m: totals.projectedShare24m,
    policy
  });

  const reasons = buildReasons({
    seniorExempt,
    formerEmployerMatch,
    projectedDays24m: totals.projectedDays24m,
    projectedShare24m: totals.projectedShare24m,
    policy
  });

  return {
    policy,
    workerProfileId,
    restaurantProfileId,
    seniorExempt,
    formerEmployerMatch: formerEmployerMatch
      ? {
        employerName: formerEmployerMatch.employerName,
        employerVatNumber: formerEmployerMatch.employerVatNumber,
        endedOn: formerEmployerMatch.endedOn
      }
      : null,
    decision,
    controlScore: computeControlScore(totals.projectedDays24m, totals.projectedShare24m, policy),
    current: {
      days24m: totals.pairDays24m,
      gross24mEur: Number(totals.pairGross24m.toFixed(2)),
      workerGross24mEur: Number(totals.workerGross24m.toFixed(2)),
      share24m: Number((totals.workerGross24m ? (totals.pairGross24m / totals.workerGross24m) : 0).toFixed(4))
    },
    projected: {
      days24m: totals.projectedDays24m,
      gross24mEur: Number(totals.projectedPairGross24m.toFixed(2)),
      workerGross24mEur: Number(totals.projectedWorkerGross24m.toFixed(2)),
      share24m: Number(totals.projectedShare24m.toFixed(4))
    },
    proposal: proposal
      ? {
        grossAmountEur: Number((proposal.grossAmountEur || 0).toFixed(2)),
        estimatedServiceDays: proposal.estimatedServiceDays || 0
      }
      : null,
    reasons
  };
}

async function persistComplianceEvaluation(prisma, evaluation, options = {}) {
  const pairMetric = await prisma.pairMetric.upsert({
    where: {
      workerProfileId_restaurantProfileId: {
        workerProfileId: evaluation.workerProfileId,
        restaurantProfileId: evaluation.restaurantProfileId
      }
    },
    create: {
      workerProfileId: evaluation.workerProfileId,
      restaurantProfileId: evaluation.restaurantProfileId,
      days12m: Math.min(evaluation.projected.days24m, 120),
      days24m: evaluation.projected.days24m,
      gross12mEur: evaluation.projected.gross24mEur,
      gross24mEur: evaluation.projected.gross24mEur,
      workerRevenueShare12m: evaluation.projected.share24m,
      workerRevenueShare24m: evaluation.projected.share24m,
      controlScore: evaluation.controlScore
    },
    update: {
      days12m: Math.min(evaluation.projected.days24m, 120),
      days24m: evaluation.projected.days24m,
      gross12mEur: evaluation.projected.gross24mEur,
      gross24mEur: evaluation.projected.gross24mEur,
      workerRevenueShare12m: evaluation.projected.share24m,
      workerRevenueShare24m: evaluation.projected.share24m,
      controlScore: evaluation.controlScore,
      lastRecomputedAt: new Date()
    }
  });

  const policyRule = await prisma.policyRule.findUnique({
    where: {
      policyKey: 'marketplace_compliance'
    }
  });

  const snapshot = await prisma.complianceSnapshot.create({
    data: {
      pairMetricId: pairMetric.id,
      serviceRequestId: options.serviceRequestId || null,
      policyRuleId: policyRule ? policyRule.id : null,
      policyVersion: policyRule?.currentVersion || 'runtime_default',
      decisionState: evaluation.decision,
      snapshotPayload: evaluation
    }
  });

  if (evaluation.decision !== 'allow') {
    await prisma.complianceAlert.create({
      data: {
        workerProfileId: evaluation.workerProfileId,
        restaurantProfileId: evaluation.restaurantProfileId,
        snapshotId: snapshot.id,
        alertType: evaluation.decision === 'hard_stop' ? 'fornero_hard_stop' : 'fornero_manual_review',
        severity: evaluation.decision === 'hard_stop' ? 'high' : 'medium',
        alertMessage: evaluation.reasons.map(reason => reason.message).join(' '),
        status: 'open'
      }
    });
  }

  return {
    pairMetric,
    snapshot
  };
}

module.exports = {
  DEFAULT_POLICY,
  endOfMonth,
  contractDays,
  evaluatePairCompliance,
  persistComplianceEvaluation
};
