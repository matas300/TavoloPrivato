const db = require('./mock');
const blueprint = require('./marketplace-blueprint');

const textFixups = [
  ['Ã®', 'i'],
  ['Ã ', 'a'],
  ['Ã¨', 'e'],
  ['Ã©', 'e'],
  ['Ã¬', 'i'],
  ['Ã²', 'o'],
  ['Ã¹', 'u'],
  ['â‚¬', 'EUR '],
  ['â€”', '-'],
  ['â€“', '-'],
  ['â€˜', "'"],
  ['â€™', "'"],
  ['Â', '']
];

const workerEnhancements = {
  1: {
    headline: 'Sommelier e floor lead per servizi premium',
    visualTag: 'premium floor',
    preferredZones: ['Milano Centro', 'Brera', 'Porta Romana'],
    preferredFormats: ['cena', 'degustazione', 'evento_privato'],
    hardSkills: ['wine_pairing', 'guest_relations', 'team_lead', 'english_c1'],
    softSkills: ['calma', 'precisione', 'upselling', 'ritmo'],
    certifications: ['AIS livello 2', 'HACCP', 'Hospitality English C1'],
    exEmployers: ['Ristorante Da Vittorio'],
    taxMode: 'autonomo_occasionale',
    fiscalGrossYtdEur: 3780,
    profileCompleteness: 93,
    safeHarborCandidate: false
  },
  2: {
    headline: 'Sala e banco per trattoria e brunch ad alto volume',
    visualTag: 'fast casual',
    preferredZones: ['Roma Centro', 'Prati', 'Monti'],
    preferredFormats: ['pranzo', 'brunch', 'aperitivo'],
    hardSkills: ['barista', 'guest_flow', 'english_b2', 'cash_handling'],
    softSkills: ['rapidita', 'energia', 'precisione'],
    certifications: ['HACCP'],
    exEmployers: [],
    taxMode: 'autonomo_occasionale',
    fiscalGrossYtdEur: 4200,
    profileCompleteness: 81,
    safeHarborCandidate: false
  },
  3: {
    headline: 'Maitre e regia sala per eventi e fine dining',
    visualTag: 'executive service',
    preferredZones: ['Milano Centro', 'CityLife', 'Porta Nuova'],
    preferredFormats: ['evento', 'cena', 'corporate'],
    hardSkills: ['maitre', 'event_design', 'sommelier', 'team_lead'],
    softSkills: ['leadership', 'protocollo', 'problem_solving'],
    certifications: ['WSET 3', 'HACCP'],
    exEmployers: ['Savini Milano'],
    taxMode: 'forfettario',
    fiscalGrossYtdEur: 8900,
    profileCompleteness: 97,
    safeHarborCandidate: true
  },
  4: {
    headline: 'Supporto weekend per pizzeria, brunch e servizio informale',
    visualTag: 'weekend support',
    preferredZones: ['Roma Nord', 'Roma Centro'],
    preferredFormats: ['pranzo', 'cena'],
    hardSkills: ['running', 'table_reset', 'guest_welcome'],
    softSkills: ['flessibilita', 'gentilezza', 'resistenza'],
    certifications: ['HACCP'],
    exEmployers: [],
    taxMode: 'autonomo_occasionale',
    fiscalGrossYtdEur: 800,
    profileCompleteness: 66,
    safeHarborCandidate: false
  },
  5: {
    headline: 'Mixologist per aperitivo, dinner pairing e eventi serali',
    visualTag: 'bar specialist',
    preferredZones: ['Firenze Centro', 'Oltrarno'],
    preferredFormats: ['aperitivo', 'cena', 'evento'],
    hardSkills: ['mixology', 'bar_setup', 'guest_relations'],
    softSkills: ['ritmo', 'showmanship', 'precisione'],
    certifications: ['Bar academy advanced', 'HACCP'],
    exEmployers: [],
    taxMode: 'forfettario',
    fiscalGrossYtdEur: 5200,
    profileCompleteness: 88,
    safeHarborCandidate: false
  },
  6: {
    headline: 'Event service coordinator per catering e banqueting',
    visualTag: 'event service',
    preferredZones: ['Milano', 'Monza'],
    preferredFormats: ['evento', 'catering', 'cena'],
    hardSkills: ['banqueting', 'guest_flow', 'floor_coordination'],
    softSkills: ['organizzazione', 'calma', 'adattabilita'],
    certifications: ['HACCP', 'Safety event basic'],
    exEmployers: [],
    taxMode: 'forfettario',
    fiscalGrossYtdEur: 4100,
    profileCompleteness: 86,
    safeHarborCandidate: false
  }
};

const restaurantEnhancements = {
  10: {
    brandStory: 'Trattoria di quartiere ad alto ritmo, forte su pranzo business e weekend dinner.',
    vibe: ['tradizione', 'ritmo_alto', 'quartiere'],
    avgTicketEur: 42,
    servicePackages: [
      { id: 'pkg_10_1', name: 'Gestione sala weekend', resultLabel: 'copertura ranghi e chiusura sala', roleNeeded: 'cameriere', flatFeeEur: 150, serviceType: 'cena', requiredSkills: ['Trattoria', 'guest_flow'] },
      { id: 'pkg_10_2', name: 'Pranzo business feriale', resultLabel: 'servizio rapido e regia tavoli', roleNeeded: 'cameriere', flatFeeEur: 120, serviceType: 'pranzo', requiredSkills: ['Trattoria', 'english_b2'] }
    ],
    venueHighlights: ['60 coperti', 'clientela business a pranzo', 'rotazione tavoli alta'],
    legalPositioning: 'Il locale acquista prestazioni di servizio di sala a risultato, non ore uomo.'
  },
  11: {
    brandStory: 'Osteria romana con clientela mista locale e turistica, servizio diretto e volumi consistenti.',
    vibe: ['casual_dining', 'tourist_flow', 'pranzo_forte'],
    avgTicketEur: 38,
    servicePackages: [
      { id: 'pkg_11_1', name: 'Supporto pranzo feriale', resultLabel: 'copertura sala e reset tavoli', roleNeeded: 'cameriere', flatFeeEur: 110, serviceType: 'pranzo', requiredSkills: ['Trattoria', 'rapidita'] },
      { id: 'pkg_11_2', name: 'Cena pairing vini regionali', resultLabel: 'supporto degustazione e racconto etichette', roleNeeded: 'sommelier', flatFeeEur: 170, serviceType: 'cena', requiredSkills: ['Sommelier', 'wine_pairing'] }
    ],
    venueHighlights: ['45 coperti', 'ritmo alto 12:30-14:30', 'forte presenza turistica'],
    legalPositioning: 'Ogni attivazione viene descritta come servizio completato e presidio ospiti.'
  },
  12: {
    brandStory: 'Fine dining toscano per eventi privati, matrimoni e lunch executive.',
    vibe: ['premium', 'wedding', 'private_dining'],
    avgTicketEur: 92,
    servicePackages: [
      { id: 'pkg_12_1', name: 'Coordinamento evento premium', resultLabel: 'regia sala, guest care e timing servizio', roleNeeded: 'maitre', flatFeeEur: 220, serviceType: 'evento', requiredSkills: ['Maître', 'Eventi'] },
      { id: 'pkg_12_2', name: 'Lunch executive internazionale', resultLabel: 'servizio fine dining e accoglienza ospiti esteri', roleNeeded: 'cameriere', flatFeeEur: 145, serviceType: 'pranzo', requiredSkills: ['Fine Dining', 'english_c1'] }
    ],
    venueHighlights: ['35 coperti', 'sale private', 'eventi premium'],
    legalPositioning: 'Pacchetti pensati come prestazione giornaliera di alto livello e non come turnazione oraria.'
  },
  13: {
    brandStory: 'Locale creativo con cocktail dinner, apertura nuova sala e calendario eventi in crescita.',
    vibe: ['creative', 'cocktail_dinner', 'events'],
    avgTicketEur: 56,
    servicePackages: [
      { id: 'pkg_13_1', name: 'Cocktail dinner service', resultLabel: 'integrazione bar e sala durante il servizio serale', roleNeeded: 'mixologist', flatFeeEur: 150, serviceType: 'cena', requiredSkills: ['Mixologist', 'Barista'] },
      { id: 'pkg_13_2', name: 'Inaugurazione sala', resultLabel: 'guest flow e presidio full journey evento', roleNeeded: 'eventi', flatFeeEur: 190, serviceType: 'evento', requiredSkills: ['Eventi', 'Catering'] }
    ],
    venueHighlights: ['80 coperti', 'spinta eventi', 'format ibrido bar+sala'],
    legalPositioning: 'La prestazione viene sempre raccontata come esito di servizio e gestione esperienza ospiti.'
  }
};

const pairOverrides = {
  '1:10': { days24m: 34, share24m: 0.28, controlScore: 24, decision: 'allow', notes: ['Storico sano e rotazione naturale.'] },
  '1:12': { days24m: 21, share24m: 0.18, controlScore: 22, decision: 'allow', notes: ['Match premium senza segnali di continuita anomala.'] },
  '2:11': { days24m: 58, share24m: 0.68, controlScore: 53, decision: 'warn', notes: ['Concentrazione elevata per regime occasionale, va favorita la rotazione.'] },
  '3:10': { days24m: 188, share24m: 0.74, controlScore: 69, decision: 'soft_stop', notes: ['Pair troppo frequente e gia attenzionato per possibile bypass.'] },
  '4:11': { days24m: 14, share24m: 0.33, controlScore: 41, decision: 'warn', notes: ['Nessun blocco fiscale, ma storico cancellazioni da monitorare.'] },
  '5:12': { days24m: 47, share24m: 0.62, controlScore: 49, decision: 'warn', notes: ['Serve diluire l esposizione su altri locali.'] },
  '6:13': { days24m: 19, share24m: 0.31, controlScore: 26, decision: 'allow', notes: ['Pair compatibile e orientato ad eventi.'] }
};

const textFixupsMap = Object.fromEntries(textFixups);
const textFixupsRegex = new RegExp(
  Object.keys(textFixupsMap).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

function cleanText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(textFixupsRegex, match => textFixupsMap[match]);
}

function cleanList(values = []) {
  return values.map(cleanText);
}

function computeCommission(serviceType) {
  if (serviceType === 'evento') return db.commissioni.evento;
  if (serviceType === 'full-day') return db.commissioni.giornata;
  return db.commissioni.servizio;
}

function getWorkerBase(userId) {
  return db.getUser(userId);
}

function getRestaurantBase(userId) {
  return db.getUser(userId);
}

function getEnhancedWorker(userId) {
  const user = getWorkerBase(userId);
  const meta = workerEnhancements[userId] || {};
  const grossYtd = meta.fiscalGrossYtdEur || user.ytdEarnings || 0;
  const thresholdPct = Math.min(100, Math.round((grossYtd / 5000) * 100));
  const qualifications = cleanList(user.qualifiche || []);
  const languages = cleanList(user.lingue || []);

  return {
    ...user,
    bio: cleanText(user.bio),
    qualifiche: qualifications,
    lingue: languages,
    headline: meta.headline || cleanText(user.bio),
    visualTag: meta.visualTag || 'service profile',
    preferredZones: meta.preferredZones || [user.zona],
    preferredFormats: meta.preferredFormats || [],
    hardSkills: cleanList(meta.hardSkills || qualifications),
    softSkills: meta.softSkills || [],
    certifications: cleanList(meta.certifications || []),
    exEmployers: cleanList(meta.exEmployers || []),
    taxMode: meta.taxMode || (user.pivaLast4 ? 'forfettario' : 'autonomo_occasionale'),
    fiscalGrossYtdEur: grossYtd,
    thresholdPct,
    profileCompleteness: meta.profileCompleteness || 70,
    safeHarborCandidate: Boolean(meta.safeHarborCandidate),
    dayRateLabel: `EUR ${user.pagaMin}+ per prestazione`,
    workIdentity: `${user.esperienza} anni | ${qualifications.join(', ')}`
  };
}

function getEnhancedRestaurant(userId) {
  const user = getRestaurantBase(userId);
  const meta = restaurantEnhancements[userId] || {};

  return {
    ...user,
    tipoCucina: cleanText(user.tipoCucina),
    indirizzo: cleanText(user.indirizzo),
    brandStory: meta.brandStory || `${cleanText(user.tipoCucina)} in ${user.zona}.`,
    vibe: meta.vibe || [],
    avgTicketEur: meta.avgTicketEur || 0,
    servicePackages: (meta.servicePackages || []).map(pkg => ({
      ...pkg,
      name: cleanText(pkg.name),
      resultLabel: cleanText(pkg.resultLabel),
      roleNeeded: cleanText(pkg.roleNeeded),
      requiredSkills: cleanList(pkg.requiredSkills || [])
    })),
    venueHighlights: cleanList(meta.venueHighlights || []),
    legalPositioning: cleanText(meta.legalPositioning || 'Il servizio viene descritto come prestazione a risultato.')
  };
}

function normalizeAnnuncio(annuncio) {
  return {
    ...annuncio,
    tipo: cleanText(annuncio.tipo),
    qualifiche: cleanList(annuncio.qualifiche || []),
    desc: cleanText(annuncio.desc)
  };
}

function buildPairMetrics(workerId, restaurantId) {
  const key = `${workerId}:${restaurantId}`;
  const override = pairOverrides[key];
  const contracts = db.contratti.filter(c => c.cameriereId === workerId && c.ristoranteId === restaurantId);
  const worker = getEnhancedWorker(workerId);
  const pairGross = contracts.reduce((sum, c) => sum + c.compensoCam, 0);
  const derivedShare = worker.fiscalGrossYtdEur ? pairGross / worker.fiscalGrossYtdEur : 0;

  const days24m = override ? override.days24m : contracts.length;
  const share24m = override ? override.share24m : Number(derivedShare.toFixed(2));
  const controlScore = override ? override.controlScore : Math.min(100, Math.round((share24m * 55) + (days24m * 0.5)));
  let decision = override ? override.decision : 'allow';
  const notes = override ? override.notes.slice() : [];

  if (!override) {
    if (share24m >= 0.7 || days24m >= 200 || controlScore >= 75) {
      decision = 'hard_stop';
    } else if (share24m >= 0.65 || days24m >= 180 || controlScore >= 60) {
      decision = 'soft_stop';
    } else if (share24m >= 0.55 || days24m >= 160 || controlScore >= 45) {
      decision = 'warn';
    }
  }

  if (worker.safeHarborCandidate && decision === 'warn' && controlScore < 55) {
    decision = 'allow';
    notes.push('Safe harbor candidato: rischio storico attenuato ma monitorato.');
  }

  if (!notes.length) {
    notes.push(decision === 'allow' ? 'Pair in area verde.' : 'Pair da monitorare con attenzione.');
  }

  return {
    workerId,
    restaurantId,
    days24m,
    share24m,
    controlScore,
    decision,
    notes
  };
}

function decisionUi(decision) {
  if (decision === 'allow') return { label: 'verde', badge: 'badge-olive' };
  if (decision === 'warn') return { label: 'monitorare', badge: 'badge-yellow' };
  if (decision === 'soft_stop') return { label: 'rotazione obbligatoria', badge: 'badge-red' };
  if (decision === 'hard_stop') return { label: 'bloccato', badge: 'badge-red' };
  return { label: decision, badge: 'badge-neutral' };
}

function packageForRestaurantAndRequest(restaurantId, annuncio) {
  const restaurant = getEnhancedRestaurant(restaurantId);
  return restaurant.servicePackages.find(pkg => pkg.serviceType === annuncio.tipo)
    || restaurant.servicePackages.find(pkg => pkg.requiredSkills.some(skill => annuncio.qualifiche.includes(skill)))
    || restaurant.servicePackages[0]
    || null;
}

function scoreWorkerToRequest(worker, annuncio, pkg) {
  let score = 40;
  if (worker.zona === db.getUser(annuncio.ristoranteId).zona) score += 18;
  if (annuncio.qualifiche.some(q => worker.qualifiche.includes(q))) score += 18;
  if (pkg && pkg.requiredSkills.some(skill => worker.hardSkills.includes(skill) || worker.qualifiche.includes(skill))) score += 12;
  if (annuncio.budget >= worker.pagaMin) score += 8;
  if (worker.esperienza >= 5) score += 6;
  return Math.min(98, score);
}

function scoreWorkerToRestaurant(worker, restaurant) {
  let score = 42;
  if (worker.zona === restaurant.zona) score += 16;
  if (restaurant.servicePackages.some(pkg => pkg.requiredSkills.some(skill => worker.qualifiche.includes(skill) || worker.hardSkills.includes(skill)))) score += 18;
  if (worker.esperienza >= 5) score += 8;
  if (worker.verificato) score += 6;
  return Math.min(98, score);
}

function getOpenServiceRequestsForWorker(workerId, filters = {}) {
  const worker = getEnhancedWorker(workerId);
  const items = [];

  for (const annuncio of db.annunci) {
    if (annuncio.stato !== 'aperto') continue;

    // Normalize early to filter on properties
    const normalizedAnnuncio = normalizeAnnuncio(annuncio);

    // Apply filters before expensive operations
    if (filters.tipo && normalizedAnnuncio.tipo !== filters.tipo) continue;
    if (filters.budget && normalizedAnnuncio.budget < parseInt(filters.budget, 10)) continue;

    const restaurant = getEnhancedRestaurant(annuncio.ristoranteId);
    if (filters.zona && restaurant.zona !== filters.zona) continue;

    // Expensive operations only on filtered items
    const pkg = packageForRestaurantAndRequest(annuncio.ristoranteId, normalizedAnnuncio);
    const compliance = buildPairMetrics(workerId, annuncio.ristoranteId);
    const score = scoreWorkerToRequest(worker, normalizedAnnuncio, pkg);
    const commission = computeCommission(normalizedAnnuncio.tipo);

    items.push({
      ...normalizedAnnuncio,
      restaurant,
      package: pkg,
      compliance,
      complianceUi: decisionUi(compliance.decision),
      matchScore: score,
      platformFee: commission,
      workerNet: annuncio.budget - commission,
      legalNote: compliance.decision === 'allow'
        ? 'Match proponibile come prestazione a giornata.'
        : 'Match visibile ma soggetto a controllo di concentrazione.'
    });
  }

  return items.sort((a, b) => b.matchScore - a.matchScore);
}

function getWorkerMatchesForRestaurant(restaurantId, filters = {}) {
  const restaurant = getEnhancedRestaurant(restaurantId);
  const workers = [];

  for (const workerBase of db.getCamerieri()) {
    // Basic filter on base properties before full enhancement
    if (filters.zona && workerBase.zona !== filters.zona) continue;
    if (filters.esperienza && workerBase.esperienza < parseInt(filters.esperienza, 10)) continue;
    if (filters.budget && workerBase.pagaMin > parseInt(filters.budget, 10)) continue;

    const profile = getEnhancedWorker(workerBase.id);

    // Apply filters that require the enhanced profile
    if (filters.qualifica && !profile.qualifiche.includes(filters.qualifica) && !profile.hardSkills.includes(filters.qualifica)) continue;

    // Expensive operations only on filtered items
    const compliance = buildPairMetrics(workerBase.id, restaurantId);

    workers.push({
      ...profile,
      compliance,
      complianceUi: decisionUi(compliance.decision),
      matchScore: scoreWorkerToRestaurant(profile, restaurant),
      bestPackage: restaurant.servicePackages.find(pkg => pkg.requiredSkills.some(skill => profile.qualifiche.includes(skill) || profile.hardSkills.includes(skill))) || restaurant.servicePackages[0]
    });
  }

  return workers.sort((a, b) => b.matchScore - a.matchScore);
}

function getRestaurantRequests(restaurantId) {
  return db.getAnnunciByRistorante(restaurantId).map(annuncio => {
    const normalizedAnnuncio = normalizeAnnuncio(annuncio);
    const pkg = packageForRestaurantAndRequest(restaurantId, normalizedAnnuncio);
    const platformFee = computeCommission(normalizedAnnuncio.tipo);
    return {
      ...normalizedAnnuncio,
      package: pkg,
      platformFee,
      workerNet: normalizedAnnuncio.budget - platformFee,
      legalSummary: pkg ? `Prestazione venduta come "${pkg.resultLabel}".` : 'Prestazione descritta a risultato.'
    };
  });
}

function getWorkerDashboard(workerId) {
  const profile = getEnhancedWorker(workerId);
  const contratti = db.getContrattiForUser(workerId, 'cameriere');
  const upcoming = contratti.filter(c => c.stato === 'confermato').map(c => {
    const contractView = getContractView(c.id);
    return {
      ...contractView.contratto,
      restaurant: contractView.ristorante,
      package: contractView.package,
      compliance: contractView.compliance
    };
  });
  const completed = contratti.filter(c => ['pagato', 'completato'].includes(c.stato));
  const monthEarnings = completed.reduce((sum, c) => sum + c.compensoCam, 0);
  const opportunities = getOpenServiceRequestsForWorker(workerId).slice(0, 4);
  const topCounterparty = opportunities
    .map(item => item.compliance)
    .sort((a, b) => b.share24m - a.share24m)[0] || buildPairMetrics(workerId, 10);

  return {
    profile,
    upcoming,
    completed,
    monthEarnings,
    opportunities,
    fiscalBanner: {
      mode: profile.taxMode,
      grossYtdEur: profile.fiscalGrossYtdEur,
      thresholdPct: profile.thresholdPct,
      label: profile.taxMode === 'forfettario' ? 'Profilo forfettario attivo' : 'Prestazione occasionale sotto controllo'
    },
    topCounterparty
  };
}

function getRestaurantDashboard(restaurantId) {
  const profile = getEnhancedRestaurant(restaurantId);
  const contratti = db.getContrattiForUser(restaurantId, 'ristorante');
  const upcoming = contratti.filter(c => c.stato === 'confermato').map(c => ({
    ...c,
    worker: getEnhancedWorker(c.cameriereId),
    compliance: buildPairMetrics(c.cameriereId, restaurantId)
  }));
  const completed = contratti.filter(c => ['pagato', 'completato'].includes(c.stato));
  const monthSpend = completed.reduce((sum, c) => sum + c.compensoCam + c.commissione, 0);
  const roster = [...new Set(contratti.map(c => c.cameriereId))].map(workerId => {
    const worker = getEnhancedWorker(workerId);
    const metrics = buildPairMetrics(workerId, restaurantId);
    return {
      ...worker,
      turniCount: contratti.filter(c => c.cameriereId === workerId).length,
      compliance: metrics,
      complianceUi: decisionUi(metrics.decision),
      nonRenewal: db.nonRenewal.find(n => n.ristoranteId === restaurantId && n.cameriereId === workerId)
    };
  });

  return {
    profile,
    upcoming,
    monthSpend,
    roster,
    activePackages: profile.servicePackages,
    complianceWatchlist: roster.filter(worker => worker.compliance.decision !== 'allow')
  };
}

function getContractView(contractId) {
  const contratto = db.contratti.find(c => c.id === contractId);
  if (!contratto) return null;
  const ristorante = getEnhancedRestaurant(contratto.ristoranteId);
  const cameriere = getEnhancedWorker(contratto.cameriereId);
  const normalizedContract = { ...contratto, tipo: cleanText(contratto.tipo) };
  const pkg = packageForRestaurantAndRequest(contratto.ristoranteId, { tipo: normalizedContract.tipo, qualifiche: cameriere.qualifiche });
  const compliance = buildPairMetrics(contratto.cameriereId, contratto.ristoranteId);

  return {
    contratto: normalizedContract,
    ristorante,
    cameriere,
    package: pkg,
    compliance,
    complianceUi: decisionUi(compliance.decision),
    workerNet: contratto.compensoCam,
    totalCost: contratto.compensoCam + contratto.commissione,
    splitPercent: {
      worker: Math.round((contratto.compensoCam / (contratto.compensoCam + contratto.commissione)) * 100),
      platform: Math.round((contratto.commissione / (contratto.compensoCam + contratto.commissione)) * 100)
    }
  };
}

function getWorkerWallet(workerId) {
  const profile = getEnhancedWorker(workerId);
  const payments = db.getContrattiForUser(workerId, 'cameriere')
    .filter(c => ['pagato', 'completato'].includes(c.stato))
    .map(c => {
      const contract = getContractView(c.id);
      return {
        ...contract,
        payoutLabel: c.stato === 'pagato' ? 'Pagato' : 'Completato'
      };
    });

  return {
    profile,
    payments,
    walletBalance: profile.walletBalance,
    totalEarned: payments.reduce((sum, item) => sum + item.workerNet, 0),
    totalPlatformFees: payments.reduce((sum, item) => sum + item.contratto.commissione, 0),
    pct5k: profile.thresholdPct,
    projectedYearly: Math.round((profile.fiscalGrossYtdEur / 3) * 12)
  };
}

function getRestaurantPayments(restaurantId) {
  const profile = getEnhancedRestaurant(restaurantId);
  const payments = db.getContrattiForUser(restaurantId, 'ristorante')
    .filter(c => ['pagato', 'completato'].includes(c.stato))
    .map(c => getContractView(c.id));
  const totalSpend = payments.reduce((sum, item) => sum + item.totalCost, 0);
  const totalComm = payments.reduce((sum, item) => sum + item.contratto.commissione, 0);
  const avgSpend = payments.length ? Math.round(totalSpend / payments.length) : 0;

  return {
    profile,
    payments,
    totalSpend,
    totalComm,
    avgSpend
  };
}

function getAdminAlerts() {
  const generated = Object.keys(pairOverrides).map(key => {
    const [workerId, restaurantId] = key.split(':').map(Number);
    const metrics = buildPairMetrics(workerId, restaurantId);
    const worker = getEnhancedWorker(workerId);
    const restaurant = getEnhancedRestaurant(restaurantId);
    return {
      id: `cmp_${workerId}_${restaurantId}`,
      tipo: 'compliance_pair',
      severity: metrics.decision === 'soft_stop' || metrics.decision === 'hard_stop' ? 'alta' : 'media',
      data: '2026-04-04',
      stato: metrics.decision === 'allow' ? 'monitorato' : 'aperto',
      title: `${worker.name} x ${restaurant.name}`,
      desc: `${metrics.notes.join(' ')} Giorni 24m: ${metrics.days24m}. Share: ${Math.round(metrics.share24m * 100)}%.`,
      recommendation: metrics.decision === 'allow'
        ? 'Continuare con monitoraggio standard.'
        : 'Forzare rotazione o aprire review umana prima di nuovi match.'
    };
  });

  const occasional = db.getCamerieri().map(worker => getEnhancedWorker(worker.id))
    .filter(worker => worker.taxMode === 'autonomo_occasionale' && worker.fiscalGrossYtdEur >= 4000)
    .map(worker => ({
      id: `tax_${worker.id}`,
      tipo: 'occasional_threshold',
      severity: 'media',
      data: '2026-04-04',
      stato: 'aperto',
      title: worker.name,
      desc: `Profilo in lavoro autonomo occasionale a EUR ${worker.fiscalGrossYtdEur} YTD.`,
      recommendation: 'Inviare alert onboarding verso forfettario e limitare nuovi match concentrati.'
    }));

  return generated.concat(occasional);
}

function getComplianceOverview() {
  const alerts = getAdminAlerts();
  return {
    totalAlerts: alerts.length,
    openHigh: alerts.filter(alert => alert.severity === 'alta').length,
    openMedium: alerts.filter(alert => alert.severity === 'media').length
  };
}

function getAdminDashboard() {
  const closedContracts = db.contratti.filter(c => ['pagato', 'completato'].includes(c.stato));
  const totalTransactions = closedContracts.reduce((sum, c) => sum + c.compensoCam + c.commissione, 0);
  const totalCommissions = closedContracts.reduce((sum, c) => sum + c.commissione, 0);

  return {
    totalTransactions,
    totalCommissions,
    camerieriCount: db.getCamerieri().length,
    ristorantiCount: db.getRistoranti().length,
    alerts: getAdminAlerts(),
    complianceOverview: getComplianceOverview()
  };
}

module.exports = {
  getAdminDashboard,
  getAdminAlerts,
  getComplianceOverview,
  getContractView,
  getEnhancedWorker,
  getEnhancedRestaurant,
  getRestaurantPayments,
  getOpenServiceRequestsForWorker,
  getWorkerMatchesForRestaurant,
  getRestaurantRequests,
  getWorkerDashboard,
  getWorkerWallet,
  getRestaurantDashboard,
  buildPairMetrics,
  decisionUi,
  blueprint
};
