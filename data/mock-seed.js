const users = [
  {
    id: 1, email: 'marco@demo.it', password: 'demo', role: 'cameriere',
    name: 'Marco Rossi', initials: 'MR',
    bio: '8 anni di esperienza nella ristorazione fine dining. Ex Ristorante Da Vittorio. Specializzato in servizio fine dining e abbinamento vini.',
    qualifiche: ['Sommelier', 'Fine Dining'],
    lingue: ['Italiano', 'Inglese', 'Francese'],
    esperienza: 8,
    disponibilita: { lun: true, mar: true, mer: true, gio: true, ven: true, sab: true, dom: false },
    zona: 'Milano',
    rating: 4.8, ratingCount: 47,
    verificato: true,
    pagaMin: 130,
    cfLast4: '3X5A',
    pivaLast4: null,
    ytdEarnings: 3780,
    walletBalance: 520
  },
  {
    id: 2, email: 'lucia@demo.it', password: 'demo', role: 'cameriere',
    name: 'Lucia Bianchi', initials: 'LB',
    bio: '3 anni di esperienza in trattorie e bistrot. Veloce, precisa, ottima con i clienti internazionali.',
    qualifiche: ['Barista', 'Trattoria'],
    lingue: ['Italiano', 'Inglese'],
    esperienza: 3,
    disponibilita: { lun: false, mar: true, mer: true, gio: true, ven: true, sab: true, dom: true },
    zona: 'Roma',
    rating: 4.3, ratingCount: 22,
    verificato: false,
    pagaMin: 100,
    cfLast4: '9K2B',
    pivaLast4: null,
    ytdEarnings: 1200,
    walletBalance: 200
  },
  {
    id: 3, email: 'giuseppe@demo.it', password: 'demo', role: 'cameriere',
    name: 'Giuseppe Verdi', initials: 'GV',
    bio: '15 anni di esperienza. Ex Maître al Savini Milano. Gestione sala, eventi corporate, matrimoni.',
    qualifiche: ['Maître', 'Sommelier', 'Eventi'],
    lingue: ['Italiano', 'Inglese', 'Tedesco'],
    esperienza: 15,
    disponibilita: { lun: true, mar: true, mer: false, gio: true, ven: true, sab: true, dom: true },
    zona: 'Milano',
    rating: 4.9, ratingCount: 68,
    verificato: true,
    pagaMin: 160,
    cfLast4: '7H1C',
    pivaLast4: '4D8F',
    ytdEarnings: 8900,
    walletBalance: 1200
  },
  {
    id: 4, email: 'anna@demo.it', password: 'demo', role: 'cameriere',
    name: 'Anna Colombo', initials: 'AC',
    bio: 'Studentessa universitaria, lavoro nel weekend e durante le vacanze. Allegra e affidabile.',
    qualifiche: ['Trattoria', 'Pizzeria'],
    lingue: ['Italiano', 'Inglese'],
    esperienza: 1,
    disponibilita: { lun: false, mar: false, mer: false, gio: false, ven: true, sab: true, dom: true },
    zona: 'Roma',
    rating: 4.1, ratingCount: 8,
    verificato: false,
    pagaMin: 90,
    cfLast4: '2M6D',
    pivaLast4: null,
    ytdEarnings: 800,
    walletBalance: 90
  },
  {
    id: 5, email: 'paolo@demo.it', password: 'demo', role: 'cameriere',
    name: 'Paolo Ferrari', initials: 'PF',
    bio: '5 anni in cocktail bar e ristoranti di livello. Specializzato in mixology e servizio al bancone.',
    qualifiche: ['Barista', 'Mixologist', 'Fine Dining'],
    lingue: ['Italiano', 'Inglese', 'Spagnolo'],
    esperienza: 5,
    disponibilita: { lun: true, mar: true, mer: true, gio: true, ven: true, sab: true, dom: false },
    zona: 'Firenze',
    rating: 4.6, ratingCount: 31,
    verificato: true,
    pagaMin: 120,
    cfLast4: '5N3E',
    pivaLast4: '8G2H',
    ytdEarnings: 5200,
    walletBalance: 680
  },
  {
    id: 6, email: 'chiara@demo.it', password: 'demo', role: 'cameriere',
    name: 'Chiara Moretti', initials: 'CM',
    bio: '6 anni di esperienza, specializzata in eventi e catering. Ottima organizzazione e gestione gruppi.',
    qualifiche: ['Eventi', 'Catering', 'Fine Dining'],
    lingue: ['Italiano', 'Inglese', 'Francese'],
    esperienza: 6,
    disponibilita: { lun: true, mar: false, mer: true, gio: true, ven: true, sab: true, dom: true },
    zona: 'Milano',
    rating: 4.5, ratingCount: 29,
    verificato: true,
    pagaMin: 125,
    cfLast4: '8R4F',
    pivaLast4: '1K7L',
    ytdEarnings: 4100,
    walletBalance: 350
  },
  {
    id: 10, email: 'mario@demo.it', password: 'demo', role: 'ristorante',
    name: 'Trattoria Da Mario', initials: 'DM',
    indirizzo: 'Via Garibaldi 45, Milano',
    tipoCucina: 'Tradizionale Lombarda',
    capienza: 60,
    rating: 4.5, ratingCount: 23,
    zona: 'Milano'
  },
  {
    id: 11, email: 'sole@demo.it', password: 'demo', role: 'ristorante',
    name: 'Osteria del Sole', initials: 'OS',
    indirizzo: 'Piazza San Marco 12, Roma',
    tipoCucina: 'Cucina Romana',
    capienza: 45,
    rating: 4.7, ratingCount: 34,
    zona: 'Roma'
  },
  {
    id: 12, email: 'bella@demo.it', password: 'demo', role: 'ristorante',
    name: 'Ristorante Bella Vista', initials: 'BV',
    indirizzo: 'Lungarno Corsini 8, Firenze',
    tipoCucina: 'Fine Dining Toscano',
    capienza: 35,
    rating: 4.8, ratingCount: 45,
    zona: 'Firenze'
  },
  {
    id: 13, email: 'giardino@demo.it', password: 'demo', role: 'ristorante',
    name: 'Il Giardino', initials: 'IG',
    indirizzo: 'Via Tornabuoni 22, Firenze',
    tipoCucina: 'Cucina Creativa',
    capienza: 80,
    rating: 4.3, ratingCount: 18,
    zona: 'Firenze'
  },
  {
    id: 99, email: 'admin@demo.it', password: 'demo', role: 'admin',
    name: 'Admin TavoloLibero', initials: 'TL'
  }
];

const annunci = [
  { id: 1, ristoranteId: 10, data: '2026-04-07', tipo: 'cena', qualifiche: ['Fine Dining'], budget: 140, desc: 'Cercasi cameriere esperto per servizio cena. 40 coperti previsti, clientela esigente.', stato: 'aperto' },
  { id: 2, ristoranteId: 10, data: '2026-04-10', tipo: 'full-day', qualifiche: ['Trattoria'], budget: 160, desc: 'Giornata piena per pranzo e cena. Evento aziendale con 50 coperti.', stato: 'aperto' },
  { id: 3, ristoranteId: 11, data: '2026-04-08', tipo: 'pranzo', qualifiche: ['Trattoria'], budget: 100, desc: 'Pranzo feriale, 30 coperti. Ambiente informale, servizio veloce.', stato: 'aperto' },
  { id: 4, ristoranteId: 11, data: '2026-04-12', tipo: 'cena', qualifiche: ['Sommelier'], budget: 150, desc: 'Cena con degustazione vini del Lazio. Serve sommelier con esperienza.', stato: 'aperto' },
  { id: 5, ristoranteId: 12, data: '2026-04-09', tipo: 'evento', qualifiche: ['Maître', 'Fine Dining'], budget: 200, desc: 'Matrimonio, 80 invitati. Serve esperienza in gestione eventi formali.', stato: 'aperto' },
  { id: 6, ristoranteId: 13, data: '2026-04-15', tipo: 'cena', qualifiche: ['Barista', 'Mixologist'], budget: 130, desc: 'Serata cocktail + cena creativa. Serve competenza in mixology e servizio moderno.', stato: 'aperto' },
  { id: 7, ristoranteId: 12, data: '2026-04-18', tipo: 'pranzo', qualifiche: ['Fine Dining'], budget: 120, desc: 'Pranzo business con clienti internazionali. Inglese fluente richiesto.', stato: 'aperto' },
  { id: 8, ristoranteId: 13, data: '2026-04-20', tipo: 'full-day', qualifiche: ['Eventi', 'Catering'], budget: 180, desc: 'Inaugurazione nuova sala. Full-day con servizio pranzo, aperitivo e cena.', stato: 'aperto' }
];

const contratti = [
  { id: 1, cameriereId: 1, ristoranteId: 10, data: '2026-03-28', tipo: 'cena', compensoCam: 130, commissione: 20, stato: 'completato', valCam: 5, valRist: 5, commentoRist: 'Eccellente, professionale e puntuale.' },
  { id: 2, cameriereId: 1, ristoranteId: 11, data: '2026-03-25', tipo: 'full-day', compensoCam: 160, commissione: 20, stato: 'completato', valCam: 4, valRist: 5, commentoRist: 'Molto bravo, tornerà sicuramente.' },
  { id: 3, cameriereId: 1, ristoranteId: 12, data: '2026-03-22', tipo: 'pranzo', compensoCam: 100, commissione: 10, stato: 'pagato', valCam: 4, valRist: 4, commentoRist: null },
  { id: 4, cameriereId: 1, ristoranteId: 13, data: '2026-03-20', tipo: 'evento', compensoCam: 180, commissione: 25, stato: 'pagato', valCam: 5, valRist: 5, commentoRist: 'Gestione impeccabile dell\'evento.' },
  { id: 5, cameriereId: 3, ristoranteId: 10, data: '2026-03-30', tipo: 'cena', compensoCam: 160, commissione: 20, stato: 'completato', valCam: 5, valRist: 5, commentoRist: null },
  { id: 6, cameriereId: 2, ristoranteId: 11, data: '2026-03-27', tipo: 'pranzo', compensoCam: 95, commissione: 10, stato: 'pagato', valCam: 4, valRist: 3, commentoRist: 'Un po\' lenta nei momenti di punta.' },
  { id: 7, cameriereId: 5, ristoranteId: 12, data: '2026-03-29', tipo: 'cena', compensoCam: 140, commissione: 20, stato: 'completato', valCam: 5, valRist: 4, commentoRist: null },
  { id: 8, cameriereId: 1, ristoranteId: 10, data: '2026-04-05', tipo: 'cena', compensoCam: 130, commissione: 20, stato: 'confermato', valCam: null, valRist: null, commentoRist: null },
  { id: 9, cameriereId: 1, ristoranteId: 12, data: '2026-04-09', tipo: 'evento', compensoCam: 180, commissione: 25, stato: 'confermato', valCam: null, valRist: null, commentoRist: null },
  { id: 10, cameriereId: 6, ristoranteId: 13, data: '2026-04-02', tipo: 'cena', compensoCam: 125, commissione: 20, stato: 'completato', valCam: 4, valRist: 5, commentoRist: 'Ottima organizzazione.' },
  { id: 11, cameriereId: 3, ristoranteId: 12, data: '2026-04-01', tipo: 'pranzo', compensoCam: 160, commissione: 10, stato: 'pagato', valCam: 5, valRist: 5, commentoRist: null },
  { id: 12, cameriereId: 4, ristoranteId: 11, data: '2026-03-15', tipo: 'pranzo', compensoCam: 85, commissione: 10, stato: 'pagato', valCam: 3, valRist: 4, commentoRist: 'Volenterosa ma ancora inesperta.' }
];

const messaggi = [
  { id: 1, from: 10, to: 1, text: 'Ciao Marco, ti andrebbe di fare servizio da noi venerdì sera?', time: '2026-04-01 14:30', read: true },
  { id: 2, from: 1, to: 10, text: 'Ciao! Sì, venerdì sera sono libero. Quanti coperti prevedete?', time: '2026-04-01 14:45', read: true },
  { id: 3, from: 10, to: 1, text: 'Circa 40 coperti, servizio dalle 19 alle 23. Ti va bene EUR 130 netti?', time: '2026-04-01 15:00', read: true },
  { id: 4, from: 1, to: 10, text: 'Perfetto, ci sto. Confermo!', time: '2026-04-01 15:10', read: true },
  { id: 5, from: 12, to: 1, text: 'Buongiorno Marco, avremmo bisogno di lei per un matrimonio il 9 aprile. Interessato?', time: '2026-04-02 09:00', read: true },
  { id: 6, from: 1, to: 12, text: 'Buongiorno, certamente! Quanti invitati e che tipo di servizio?', time: '2026-04-02 09:30', read: false },
  { id: 7, from: 12, to: 1, text: '80 invitati, servizio completo con aperitivo, cena seduta e brindisi. Budget EUR 180 netti.', time: '2026-04-02 10:00', read: false },
  { id: 8, from: 11, to: 2, text: 'Ciao Lucia, avresti disponibilità per un pranzo martedì?', time: '2026-04-03 11:00', read: false },
  { id: 9, from: 13, to: 6, text: 'Buongiorno Chiara, ci servirebbe una persona per l\'inaugurazione il 20 aprile.', time: '2026-04-03 16:00', read: false }
];

const alerts = [
  { id: 1, tipo: 'bypass', desc: 'Cameriere #3 (Giuseppe Verdi) e Ristorante #10 (Da Mario): 3 booking cancellati dopo colloquio negli ultimi 30 giorni. Possibile accordo fuori piattaforma.', severity: 'alta', data: '2026-04-01', stato: 'aperto' },
  { id: 2, tipo: 'threshold', desc: 'Cameriere #5 (Paolo Ferrari) ha superato soglia EUR 5.000 YTD senza P.IVA registrata in piattaforma.', severity: 'media', data: '2026-03-29', stato: 'aperto' },
  { id: 3, tipo: 'dispute', desc: 'Contestazione pagamento: Ristorante #11 (Osteria del Sole) vs Cameriere #2 (Lucia Bianchi) - turno 27/03. Il ristorante lamenta servizio insufficiente.', severity: 'alta', data: '2026-03-28', stato: 'in_lavorazione' },
  { id: 4, tipo: 'cancellation', desc: 'Cameriere #4 (Anna Colombo): 4 cancellazioni last-minute nel mese corrente. Pattern anomalo.', severity: 'media', data: '2026-03-27', stato: 'aperto' }
];

const auditLog = [
  { time: '2026-04-02 10:15', user: 'admin@demo.it', action: 'Verifica profilo cameriere #1 (Marco Rossi) - profilo verificato', tipo: 'verifica' },
  { time: '2026-04-01 16:00', user: 'admin@demo.it', action: 'Commissione evento aggiornata: da EUR 20 a EUR 25', tipo: 'config' },
  { time: '2026-03-30 09:30', user: 'admin@demo.it', action: 'Warning inviato a cameriere #4 (Anna Colombo) per cancellazioni ripetute', tipo: 'moderazione' },
  { time: '2026-03-29 14:00', user: 'admin@demo.it', action: 'Alert bypass investigato: cameriere #3 + ristorante #10 - monitoraggio attivo', tipo: 'investigazione' },
  { time: '2026-03-28 11:00', user: 'sistema', action: 'Alert automatico: soglia EUR 5.000 superata per cameriere #5 (Paolo Ferrari)', tipo: 'sistema' },
  { time: '2026-03-25 09:00', user: 'admin@demo.it', action: 'Verifica profilo cameriere #5 (Paolo Ferrari) - profilo verificato', tipo: 'verifica' },
  { time: '2026-03-20 14:30', user: 'admin@demo.it', action: 'Configurazione commissione base aggiornata: servizio singolo EUR 10', tipo: 'config' }
];

const nonRenewal = [
  { ristoranteId: 10, cameriereId: 2, motivo: 'Servizio troppo lento per la nostra clientela', data: '2026-03-15' }
];

const commissioni = {
  servizio: 10,
  giornata: 20,
  evento: 25
};

module.exports = {
  users,
  annunci,
  contratti,
  messaggi,
  alerts,
  auditLog,
  nonRenewal,
  commissioni
};
