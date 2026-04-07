const marketplaceBlueprint = {
  generatedOn: '2026-04-04',
  product: {
    name: 'TavoloLibero Marketplace Blueprint',
    positioning: 'Marketplace bilaterale per personale di sala freelance e ristoranti in Italia, costruito per vendere prestazioni a giornata o evento invece di ore di lavoro.',
    operatingModes: ['forfettario', 'autonomo_occasionale'],
    legalWarnings: [
      'La compliance non puo basarsi solo sugli indicatori storici della riforma Fornero.',
      'Il modello deve presidiare anche il rischio di etero-organizzazione ex art. 2 D.Lgs. 81/2015.',
      'Per l intermediazione domanda offerta di lavoro serve verifica autorizzativa ex D.Lgs. 276/2003 prima del go-live.'
    ]
  },
  uxPrinciples: [
    {
      audience: 'ristoranti',
      title: 'Vendere prestazioni e risultati',
      detail: 'Il lato ristorante deve configurare un servizio come gestione sala weekend, supporto degustazione, banco aperitivo o evento, mai pacchetti a ore.'
    },
    {
      audience: 'worker',
      title: 'CV mobile-first e leggibile in 30 secondi',
      detail: 'Foto, bio, skill certificate, zone, disponibilita e fee minima devono stare above the fold, con onboarding ridotto e social login.'
    },
    {
      audience: 'all',
      title: 'Chat, prova e firma in un unico flusso',
      detail: 'Il percorso minimo e match, colloquio, turno prova, contratto, pagamento e review, senza salti tra strumenti esterni.'
    },
    {
      audience: 'admin',
      title: 'Compliance prima della crescita',
      detail: 'Ogni pair worker-ristorante deve mostrare giorni, concentrazione fatturato, storico ex-datore, alert e decisioni applicate.'
    }
  ],
  databaseDomains: [
    {
      name: 'Identity and access',
      purpose: 'Account, login, consensi, sessioni e audit security.',
      entities: ['users', 'user_identities', 'consents', 'sessions', 'audit_logs']
    },
    {
      name: 'Organizations and venues',
      purpose: 'Soggetto giuridico, brand ristorante, sedi e caratteristiche operative.',
      entities: ['organizations', 'restaurant_profiles', 'venues', 'counterparty_groups']
    },
    {
      name: 'Worker profiles',
      purpose: 'CV avanzato, skill, certificazioni, documenti, regime fiscale e preferenze.',
      entities: ['worker_profiles', 'worker_preferences', 'worker_skills', 'worker_certifications', 'worker_documents', 'former_employers', 'tax_profiles']
    },
    {
      name: 'Demand and matching',
      purpose: 'Pacchetti servizio, richieste, shortlist e ranking bidirezionale.',
      entities: ['service_packages', 'service_requests', 'matches', 'match_rankings']
    },
    {
      name: 'Communication and workflow',
      purpose: 'Chat, colloqui, turni prova e stato operativo della trattativa.',
      entities: ['interviews', 'chat_threads', 'messages', 'trial_services']
    },
    {
      name: 'Contracts and payments',
      purpose: 'Contratti, firme, split payment, payout e ledger economico.',
      entities: ['service_contracts', 'contract_templates', 'contract_signatures', 'payment_orders', 'split_rules', 'escrow_ledger', 'payouts', 'refunds', 'invoices']
    },
    {
      name: 'Compliance and monitoring',
      purpose: 'Metriche per pair, snapshot, alert, review umane e regole versionate.',
      entities: ['pair_metrics', 'compliance_snapshots', 'compliance_alerts', 'manual_reviews', 'policy_rules', 'agent_jobs', 'agent_decisions']
    },
    {
      name: 'Reputation',
      purpose: 'Recensioni bilaterali e aggregati reputazionali per la fase 2.',
      entities: ['review_events', 'reviews', 'review_aggregates']
    }
  ],
  agentMesh: [
    {
      key: 'auth_profile',
      name: 'Auth & Profilazione Agent',
      owns: ['users', 'worker_profiles', 'restaurant_profiles', 'tax_profiles', 'former_employers'],
      responsibilities: [
        'Gestisce login Google e Apple, email fallback e raccolta consensi.',
        'Costruisce il profilo worker o restaurant con score di completezza.',
        'Raccoglie dati fiscali minimi, ex datori degli ultimi 2 periodi d imposta e documenti.'
      ],
      emits: ['profile.completed', 'profile.updated', 'tax_profile.changed']
    },
    {
      key: 'matching',
      name: 'Matching Agent',
      owns: ['service_requests', 'matches', 'match_rankings'],
      responsibilities: [
        'Applica retrieval su skill, zona, disponibilita, vibe e storico rating.',
        'Ordina i candidati ma delega il semaforo finale al Compliance Agent.',
        'Spinge rotazione quando un pair entra in zona di concentrazione.'
      ],
      emits: ['match.proposed', 'match.rejected', 'rotation.suggested']
    },
    {
      key: 'contracts',
      name: 'Contract Agent',
      owns: ['service_contracts', 'contract_templates', 'contract_signatures'],
      responsibilities: [
        'Seleziona il template corretto per forfettario o autonomo occasionale.',
        'Compila clausole su prestazione, fee flat, data, venue e non-aggancio a orario.',
        'Blocca la firma se manca il via libera compliance o payment hold.'
      ],
      emits: ['contract.generated', 'contract.signed', 'contract.blocked']
    },
    {
      key: 'payments',
      name: 'Payments Agent',
      owns: ['payment_orders', 'split_rules', 'escrow_ledger', 'payouts', 'refunds', 'invoices'],
      responsibilities: [
        'Calcola split payment tra worker e piattaforma.',
        'Mantiene hold e release del payout dopo esito servizio o dispute.',
        'Produce tracciato economico per alert fiscali e marginalita.'
      ],
      emits: ['payment.authorized', 'payment.captured', 'payout.released', 'payout.on_hold']
    },
    {
      key: 'compliance',
      name: 'Admin & Compliance Agent',
      owns: ['pair_metrics', 'compliance_snapshots', 'compliance_alerts', 'manual_reviews', 'policy_rules'],
      responsibilities: [
        'Esegue controlli deterministici su ex datore, concentrazione, continuita e rischio etero-organizzazione.',
        'Genera semafori allow, warn, manual_review, soft_stop e hard_stop.',
        'Tiene traccia di override umano e motivazioni.'
      ],
      emits: ['compliance.allowed', 'compliance.warned', 'compliance.blocked', 'compliance.review_required']
    },
    {
      key: 'notifications',
      name: 'Notifications Agent',
      owns: ['outbox_events'],
      responsibilities: [
        'Invia push, email e in-app alert per match, messaggi, firma, pagamento e soglia fiscale.',
        'Escala i casi ad admin quando un alert passa da warn a block.'
      ],
      emits: ['notification.sent', 'notification.failed']
    },
    {
      key: 'rating',
      name: 'Rating Agent',
      owns: ['review_events', 'reviews', 'review_aggregates'],
      responsibilities: [
        'Gestisce review bilaterali post-servizio e aggiorna gli aggregati reputazionali.',
        'Segnala pattern sospetti come review reciproche anomale o review stuffing.'
      ],
      emits: ['review.requested', 'review.published', 'review.flagged']
    }
  ],
  complianceEngine: {
    decisionStates: ['allow', 'warn', 'manual_review', 'soft_stop', 'hard_stop'],
    thresholds: [
      {
        key: 'pair_days_24m',
        label: 'Continuita pair worker-ristorante',
        legalStatus: 'guardrail interno ispirato agli indicatori storici Fornero, non test unico vigente',
        warnAt: '160 giorni / 24 mesi',
        softStopAt: '180 giorni / 24 mesi',
        hardStopAt: '200 giorni / 24 mesi'
      },
      {
        key: 'pair_revenue_share',
        label: 'Concentrazione di fatturato verso lo stesso committente',
        legalStatus: 'guardrail prudenziale, piu severo del dato storico 80%',
        warnAt: '55%',
        softStopAt: '65%',
        hardStopAt: '70%'
      },
      {
        key: 'former_employer',
        label: 'Ex datore ultimi 2 periodi d imposta',
        legalStatus: 'causa ostativa da trattare come hard block in modalita forfettario',
        warnAt: 'n/a',
        softStopAt: 'n/a',
        hardStopAt: 'match bloccato'
      },
      {
        key: 'occasional_threshold',
        label: 'Lavoro autonomo occasionale',
        legalStatus: 'alert e blocco di prodotto per evitare superamento non gestito',
        warnAt: '4000 EUR YTD',
        softStopAt: '4500 EUR YTD',
        hardStopAt: '5000 EUR YTD'
      },
      {
        key: 'control_score',
        label: 'Rischio di etero-organizzazione',
        legalStatus: 'presidio art. 2 D.Lgs. 81/2015',
        warnAt: 'score >= 45',
        softStopAt: 'score >= 60',
        hardStopAt: 'score >= 75'
      }
    ],
    evaluationFlow: [
      {
        step: 1,
        title: 'Resolve worker tax perimeter',
        detail: 'Normalizza regime fiscale, P.IVA, occasionale YTD, ex datori e soggetti riconducibili.'
      },
      {
        step: 2,
        title: 'Resolve counterparty graph',
        detail: 'Mappa ristorante, societa titolare, venue e gruppo di controllo per evitare split artificiale del rischio.'
      },
      {
        step: 3,
        title: 'Update pair metrics',
        detail: 'Aggiorna giorni su rolling 12 e 24 mesi, valore servizi, share del fatturato worker e frequenza dei turni.'
      },
      {
        step: 4,
        title: 'Score legal and operational risk',
        detail: 'Valuta ex datore, concentrazione, continuita, postazione fissa, prezzo imposto, penalita di accettazione e istruzioni granulari.'
      },
      {
        step: 5,
        title: 'Apply decision ladder',
        detail: 'Restituisce allow, warn, manual_review, soft_stop o hard_stop con motivazioni machine readable.'
      },
      {
        step: 6,
        title: 'Open admin case when needed',
        detail: 'Se il caso supera la soglia review, crea ticket con snapshot, cronologia e suggerimento operativo.'
      }
    ],
    antiAbuseSignals: [
      'Cancellazioni ripetute dopo la chat e prima della firma',
      'Messaggi che tentano di spostare il contatto fuori piattaforma',
      'Ritorni ricorrenti nello stesso venue con worker non ruotati',
      'Fee imposte sempre identiche e accettazione quasi automatica',
      'Richieste che descrivono turni orari rigidi invece di risultati di servizio'
    ],
    safeHarborNote: 'Profili ad alta competenza o con lunga esperienza possono ridurre il rischio storico di falsa P.IVA, ma non annullano il controllo sull etero-organizzazione. Vanno trattati come fattore attenuante, non come esenzione automatica.'
  },
  apiMap: [
    {
      area: 'Auth',
      routes: ['POST /api/auth/oauth/google', 'POST /api/auth/oauth/apple', 'POST /api/auth/logout'],
      note: 'Sessione leggera per MVP, token based per app mobile.'
    },
    {
      area: 'Profiles',
      routes: ['GET /api/workers/:id', 'PATCH /api/workers/:id', 'GET /api/restaurants/:id', 'PATCH /api/restaurants/:id'],
      note: 'Il profilo worker include tax mode, ex datori e verification flags.'
    },
    {
      area: 'Demand and matching',
      routes: ['POST /api/service-requests', 'GET /api/service-requests', 'POST /api/matches/:id/accept', 'POST /api/matches/:id/reject'],
      note: 'Ogni proposta match passa dal Compliance Agent prima di diventare prenotabile.'
    },
    {
      area: 'Workflow',
      routes: ['POST /api/chat-threads', 'POST /api/trial-services', 'POST /api/contracts/:id/sign'],
      note: 'Match, colloquio, prova e firma sono un flusso unico.'
    },
    {
      area: 'Payments',
      routes: ['POST /api/payments/authorize', 'POST /api/payments/capture', 'POST /api/payouts/release'],
      note: 'Serve split payment per fee piattaforma e payout worker.'
    },
    {
      area: 'Compliance',
      routes: ['GET /api/compliance/pairs/:workerId/:restaurantId', 'POST /api/compliance/review/:alertId', 'GET /api/compliance/alerts'],
      note: 'Decisioni sempre tracciate con snapshot e policy version.'
    }
  ]
};

module.exports = marketplaceBlueprint;
