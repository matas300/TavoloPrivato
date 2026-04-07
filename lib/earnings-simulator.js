const ROLE_PROFILES = {
  cameriere: {
    key: 'cameriere',
    label: 'Cameriere',
    shortLabel: 'Cameriere',
    ccnlLevel: 'Livello 5',
    marketNetMonthlyRange: [1381, 1550],
    marketRalRange: [16800, 22400],
    marketCompanyCostRange: [23500, 31000],
    suggestedNetMonthlyByBand: {
      junior: 1320,
      mid: 1381,
      senior: 1520
    },
    notes: [
      'Profilo di sala dedicato a servizio tavoli, mise en place e gestione del rango base.',
      'Ancoraggio mercato: netto mensile medio intorno a 1.381 EUR, costo azienda tra 23.500 e 31.000 EUR.'
    ]
  },
  sommelier: {
    key: 'sommelier',
    label: 'Sommelier',
    shortLabel: 'Sommelier',
    ccnlLevel: 'Livello 4 / 3',
    marketNetMonthlyRange: [1800, 2600],
    marketRalRange: [34000, 52000],
    marketCompanyCostRange: [45000, 70000],
    suggestedNetMonthlyByBand: {
      junior: 1700,
      mid: 2050,
      senior: 2450
    },
    notes: [
      'Profilo premium di sala orientato a wine pairing, carta vini e upselling sul servizio.',
      'Benchmark premium: in fine dining e ristorazione stellata il netto mensile puo salire intorno a 1.800-2.600 EUR, con punte superiori nei contesti top.'
    ]
  },
  barman: {
    key: 'barman',
    label: 'Barman',
    shortLabel: 'Barman',
    ccnlLevel: 'Livello 4',
    marketNetMonthlyRange: [1600, 2400],
    marketRalRange: [28000, 42000],
    marketCompanyCostRange: [37000, 56000],
    suggestedNetMonthlyByBand: {
      junior: 1550,
      mid: 1850,
      senior: 2250
    },
    notes: [
      'Profilo bar dedicato a aperitivo, cocktail list, gestione banco e servizio beverage.',
      'Benchmark premium: in hotel 5 stelle, cocktail bar strutturati ed eventi il netto mensile puo muoversi intorno a 1.600-2.400 EUR.'
    ]
  }
};

const EXPERIENCE_BANDS = {
  junior: {
    key: 'junior',
    label: 'Junior',
    min: 0,
    max: 2
  },
  mid: {
    key: 'mid',
    label: 'Mid',
    min: 3,
    max: 5
  },
  senior: {
    key: 'senior',
    label: 'Senior',
    min: 6,
    max: 99
  }
};

const DEFAULT_INPUT = {
  ruolo: 'cameriere',
  anni_esperienza: 3,
  stipendio_netto_mensile_attuale: 1381,
  aliquota_forfettario: 15,
  coefficiente_redditivita: 0.67
};

const ASSUMPTIONS = {
  mensilitaDipendente: 14,
  grossUpDipendente: 0.25,
  contributiInpsAzienda: 0.30,
  inailAzienda: 0.03,
  tfr: 0.074,
  coefficienteRedditivitaDefault: 0.67,
  coefficienteRedditivitaAlternativo: 0.40,
  contributiInpsFreelance: 0.2607,
  sogliaForfettarioRicavi: 85000
};

function normalizeSimulatorAudience(value) {
  return value === 'restaurant' ? 'restaurant' : 'worker';
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function sanitizeNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeForfettarioRate(value) {
  const rawRate = sanitizeNumber(value, DEFAULT_INPUT.aliquota_forfettario);
  if (rawRate === 0.05 || rawRate === 0.15) {
    return rawRate;
  }
  if (rawRate === 5 || rawRate === 15) {
    return rawRate / 100;
  }
  return DEFAULT_INPUT.aliquota_forfettario / 100;
}

function resolveExperienceBand(yearsExperience) {
  if (yearsExperience <= EXPERIENCE_BANDS.junior.max) {
    return EXPERIENCE_BANDS.junior;
  }
  if (yearsExperience <= EXPERIENCE_BANDS.mid.max) {
    return EXPERIENCE_BANDS.mid;
  }
  return EXPERIENCE_BANDS.senior;
}

function getRoleProfile(roleKey) {
  return ROLE_PROFILES[roleKey] || ROLE_PROFILES[DEFAULT_INPUT.ruolo];
}

function getReferenceSnapshot(roleKey, yearsExperience) {
  const roleProfile = getRoleProfile(roleKey);
  const experienceBand = resolveExperienceBand(yearsExperience);
  const suggestedNetMonthly = roleProfile.suggestedNetMonthlyByBand[experienceBand.key];

  return {
    role: roleProfile,
    experienceBand,
    suggestedNetMonthly,
    marketNetMonthlyRange: roleProfile.marketNetMonthlyRange,
    marketRalRange: roleProfile.marketRalRange,
    marketCompanyCostRange: roleProfile.marketCompanyCostRange,
    notes: roleProfile.notes
  };
}

function getSimulatorMeta() {
  return {
    defaultInput: { ...DEFAULT_INPUT },
    assumptions: { ...ASSUMPTIONS },
    roles: Object.values(ROLE_PROFILES).map(profile => ({
      key: profile.key,
      label: profile.label,
      shortLabel: profile.shortLabel,
      ccnlLevel: profile.ccnlLevel,
      marketNetMonthlyRange: profile.marketNetMonthlyRange,
      marketRalRange: profile.marketRalRange,
      marketCompanyCostRange: profile.marketCompanyCostRange,
      suggestedNetMonthlyByBand: profile.suggestedNetMonthlyByBand,
      notes: profile.notes
    })),
    experienceBands: Object.values(EXPERIENCE_BANDS),
    aliquoteForfettario: [
      {
        value: 5,
        label: '5% nuova attivita',
        description: 'Ipotesi di nuova attivita per i primi 5 anni, se spettante.'
      },
      {
        value: 15,
        label: '15% standard',
        description: 'Ipotesi ordinaria del regime forfettario.'
      }
    ]
  };
}

function calculateEarningsSimulation(rawInput = {}) {
  const audience = normalizeSimulatorAudience(rawInput.audience);
  const roleProfile = getRoleProfile(rawInput.ruolo || DEFAULT_INPUT.ruolo);
  const yearsExperience = Math.max(0, sanitizeNumber(rawInput.anni_esperienza, DEFAULT_INPUT.anni_esperienza));
  const referenceSnapshot = getReferenceSnapshot(roleProfile.key, yearsExperience);
  const netMonthlySalary = Math.max(
    0,
    sanitizeNumber(rawInput.stipendio_netto_mensile_attuale, referenceSnapshot.suggestedNetMonthly)
  );
  const forfettarioRate = normalizeForfettarioRate(rawInput.aliquota_forfettario);
  const profitabilityCoefficient = Math.min(
    1,
    Math.max(
      0,
      sanitizeNumber(rawInput.coefficiente_redditivita, ASSUMPTIONS.coefficienteRedditivitaDefault)
    )
  );

  // 1. Dipendente: si parte dal netto mensile e si ricostruisce una RAL semplificata.
  const employeeNetAnnual = netMonthlySalary * ASSUMPTIONS.mensilitaDipendente;
  const estimatedRal = employeeNetAnnual * (1 + ASSUMPTIONS.grossUpDipendente);
  const employerInps = estimatedRal * ASSUMPTIONS.contributiInpsAzienda;
  const employerInail = estimatedRal * ASSUMPTIONS.inailAzienda;
  const tfrAccrual = estimatedRal * ASSUMPTIONS.tfr;
  const totalCompanyCost = estimatedRal + employerInps + employerInail + tfrAccrual;

  // 2. Freelance: il costo azienda viene trasformato nel fatturato lordo del professionista.
  const freelanceAnnualRevenue = totalCompanyCost;
  const taxableGrossIncome = freelanceAnnualRevenue * profitabilityCoefficient;
  const freelanceInps = taxableGrossIncome * ASSUMPTIONS.contributiInpsFreelance;
  const taxableNetIncome = taxableGrossIncome - freelanceInps;
  const substituteTax = taxableNetIncome * forfettarioRate;
  const freelanceAnnualNet = freelanceAnnualRevenue - freelanceInps - substituteTax;
  const freelanceMonthlyNet = freelanceAnnualNet / 12;

  const annualGain = freelanceAnnualNet - employeeNetAnnual;
  const monthlyGain = freelanceMonthlyNet - netMonthlySalary;
  const isForfettarioEligible = freelanceAnnualRevenue <= ASSUMPTIONS.sogliaForfettarioRicavi;

  const warnings = [];
  if (!isForfettarioEligible) {
    warnings.push(
      `Il fatturato stimato supera ${ASSUMPTIONS.sogliaForfettarioRicavi.toLocaleString('it-IT')} EUR: la simulazione esce dal perimetro del regime forfettario.`
    );
  }

  warnings.push(
    'Simulazione semplificata: non include ferie, malattia, NASpI, maternita, scatti, addizionali regionali/comunali o costi di struttura della partita IVA.'
  );

  return {
    audience,
    input: {
      ruolo: roleProfile.key,
      ruoloLabel: roleProfile.label,
      ccnlLevel: roleProfile.ccnlLevel,
      anniEsperienza: yearsExperience,
      seniorityLabel: referenceSnapshot.experienceBand.label,
      stipendioNettoMensileAttuale: roundCurrency(netMonthlySalary),
      aliquotaForfettario: roundCurrency(forfettarioRate * 100),
      coefficienteRedditivita: profitabilityCoefficient
    },
    referenceSnapshot: {
      suggestedNetMonthly: roundCurrency(referenceSnapshot.suggestedNetMonthly),
      marketNetMonthlyRange: referenceSnapshot.marketNetMonthlyRange,
      marketRalRange: referenceSnapshot.marketRalRange,
      marketCompanyCostRange: referenceSnapshot.marketCompanyCostRange,
      notes: referenceSnapshot.notes
    },
    dipendente: {
      nettoMensile: roundCurrency(netMonthlySalary),
      nettoAnnuo: roundCurrency(employeeNetAnnual),
      ralStimata: roundCurrency(estimatedRal)
    },
    azienda: {
      contributiInps: roundCurrency(employerInps),
      premioInail: roundCurrency(employerInail),
      tfr: roundCurrency(tfrAccrual),
      costoTotale: roundCurrency(totalCompanyCost)
    },
    freelance: {
      fatturatoAnnuo: roundCurrency(freelanceAnnualRevenue),
      coefficienteRedditivita: profitabilityCoefficient,
      redditoImponibileLordo: roundCurrency(taxableGrossIncome),
      contributiInps: roundCurrency(freelanceInps),
      redditoImponibileNetto: roundCurrency(taxableNetIncome),
      tasseSostitutive: roundCurrency(substituteTax),
      nettoAnnuo: roundCurrency(freelanceAnnualNet),
      nettoMensile: roundCurrency(freelanceMonthlyNet),
      withinForfettarioLimit: isForfettarioEligible
    },
    delta: {
      guadagnoAnnuo: roundCurrency(annualGain),
      guadagnoMensile: roundCurrency(monthlyGain)
    },
    banner: audience === 'restaurant'
      ? annualGain >= 0
        ? `A parita di spesa aziendale, il professionista trattiene ${roundCurrency(annualGain).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR netti in piu all'anno.`
        : 'Con questi parametri non emerge un differenziale netto annuo favorevole rispetto al lavoro dipendente.'
      : annualGain >= 0
        ? `Guadagni ${roundCurrency(annualGain).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR in piu all'anno con la nostra piattaforma!`
        : `Con questi parametri non emerge un vantaggio economico annuo rispetto al lavoro dipendente.`,
    warnings,
    assumptions: {
      mensilitaDipendente: ASSUMPTIONS.mensilitaDipendente,
      grossUpDipendente: ASSUMPTIONS.grossUpDipendente,
      contributiInpsAzienda: ASSUMPTIONS.contributiInpsAzienda,
      inailAzienda: ASSUMPTIONS.inailAzienda,
      tfr: ASSUMPTIONS.tfr,
      contributiInpsFreelance: ASSUMPTIONS.contributiInpsFreelance,
      sogliaForfettarioRicavi: ASSUMPTIONS.sogliaForfettarioRicavi
    }
  };
}

module.exports = {
  ROLE_PROFILES,
  EXPERIENCE_BANDS,
  ASSUMPTIONS,
  normalizeSimulatorAudience,
  getSimulatorMeta,
  getReferenceSnapshot,
  calculateEarningsSimulation
};
