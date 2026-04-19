const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();
const db = require('./data/mock');
const {
  getSimulatorMeta,
  calculateEarningsSimulation,
  normalizeSimulatorAudience
} = require('./lib/earnings-simulator');
const { getPrismaClient } = require('./lib/prisma');
const { createVisitorKey, listEarningsScenarios } = require('./lib/earnings-scenarios');
const { startPaymentAgentScheduler } = require('./lib/payment-agent');

const app = express();
const PORT = process.env.PORT || 3000;

function buildSimulatorPage(audience, currentUser) {
  const normalizedAudience = normalizeSimulatorAudience(audience);

  if (normalizedAudience === 'restaurant') {
    return {
      audience: normalizedAudience,
      path: '/simulatore-ristoratori',
      switchHref: '/simulatore-guadagno',
      switchLabel: 'Versione per professionisti',
      heroLabel: 'Simulatore per ristoratori',
      heroTitleHtml: 'Guarda il <em>costo aziendale reale</em> e quanto valore netto arriva al professionista.',
      heroSubtitle: 'Stesso budget per il locale, ma lettura orientata al servizio acquistato: costo del dipendente, spesa complessiva e compenso netto percepito dal freelance.',
      benchmarkButtonLabel: 'Usa benchmark premium',
      referenceLabel: 'Riferimento premium',
      employeeKicker: 'Netto dipendente di riferimento',
      companyKicker: 'Costo aziendale totale',
      freelanceKicker: 'Netto professionista a parita di spesa',
      breakdownEmployeeTitle: 'Scenario Dipendente',
      breakdownEmployeeHeading: 'Spesa completa del personale interno',
      breakdownFreelanceTitle: 'Scenario Freelance',
      breakdownFreelanceHeading: 'Compenso netto generato dalla stessa spesa',
      savedSectionLabel: 'Scenari salvati',
      savedSectionHeading: 'Tieni traccia dei budget confrontati',
      savedEmptyTitle: 'Nessuno scenario salvato',
      savedEmptyText: 'Salva i budget che vuoi discutere con il consulente o con il socio prima di pubblicare una richiesta.',
      saveButtonLabel: 'Salva questo scenario',
      saveSuccessMessage: 'Scenario ristorante salvato.',
      ctaTitle: currentUser ? 'Apri la dashboard e pubblica la richiesta.' : 'Trasforma il calcolo in una richiesta reale.',
      ctaBody: currentUser
        ? 'Hai gia un account: passa dalla simulazione alla richiesta di servizio e confronta professionisti disponibili.'
        : 'Crea un profilo ristorante, salva i tuoi budget e pubblica un servizio a giornata o evento.',
      ctaPrimaryHref: currentUser ? `/${currentUser.role === 'admin' ? 'admin' : currentUser.role}/dashboard` : '/register',
      ctaPrimaryLabel: currentUser ? 'Vai alla dashboard' : 'Crea profilo ristorante',
      ctaSecondaryHref: '/pricing',
      ctaSecondaryLabel: 'Vedi commissioni',
      finalNote: 'Per i ristoranti il messaggio chiave resta sempre lo stesso: si acquista una prestazione di servizio, non un monte ore.'
    };
  }

  return {
    audience: normalizedAudience,
    path: '/simulatore-guadagno',
    switchHref: '/simulatore-ristoratori',
    switchLabel: 'Versione per ristoratori',
    heroLabel: 'Simulatore Ho.Re.Ca.',
    heroTitleHtml: 'Confronta il tuo <em>netto dipendente</em> con il netto stimato in forfettario.',
    heroSubtitle: 'Il ristorante spende la stessa cifra. Tu vedi come cambia il tuo netto annuo e mensile quando il costo aziendale viene trasformato in compenso freelance.',
    benchmarkButtonLabel: 'Usa benchmark premium',
    referenceLabel: 'Riferimento premium',
    employeeKicker: 'Netto dipendente attuale',
    companyKicker: 'Quanto costi al ristorante',
    freelanceKicker: 'Netto stimato in forfettario',
    breakdownEmployeeTitle: 'Scenario Dipendente',
    breakdownEmployeeHeading: 'Costo del lavoro per il ristorante',
    breakdownFreelanceTitle: 'Scenario Freelance',
    breakdownFreelanceHeading: 'Netto in partita IVA forfettaria',
    savedSectionLabel: 'Scenari salvati',
    savedSectionHeading: 'Blocca i confronti migliori prima di registrarti',
    savedEmptyTitle: 'Ancora nessuno scenario',
    savedEmptyText: 'Salva i calcoli piu convincenti e ritrovali quando aprirai il tuo profilo professionista.',
    saveButtonLabel: 'Salva questo scenario',
    saveSuccessMessage: 'Scenario professionista salvato.',
    ctaTitle: currentUser ? 'Hai gia un account attivo.' : 'Trasforma il calcolo in un profilo che vende meglio.',
    ctaBody: currentUser
      ? 'Passa dalla simulazione alla dashboard e usa questi numeri per impostare fee, disponibilita e obiettivi.'
      : 'Apri il profilo, conserva i tuoi scenari e usa il differenziale annuo come leva commerciale nella candidatura.',
    ctaPrimaryHref: currentUser ? `/${currentUser.role === 'admin' ? 'admin' : currentUser.role}/dashboard` : '/register',
    ctaPrimaryLabel: currentUser ? 'Vai alla dashboard' : 'Apri il profilo gratis',
    ctaSecondaryHref: '/per-ristoranti',
    ctaSecondaryLabel: 'Vedi lato ristoranti',
    finalNote: 'Per i ristoranti il messaggio chiave resta sempre lo stesso: si acquista una prestazione di servizio, non un monte ore.'
  };
}

async function renderSimulatorPage(req, res, audience) {
  const simulatorMeta = getSimulatorMeta();
  const simulatorPage = buildSimulatorPage(audience, req.session.user || null);
  const simulatorInitial = calculateEarningsSimulation({
    ...simulatorMeta.defaultInput,
    audience: simulatorPage.audience
  });

  const prisma = getPrismaClient();
  const visitorKey = req.session.simulatorVisitorKey || null;
  const savedScenarios = prisma
    ? await listEarningsScenarios({
      prisma,
      userId: req.session.user ? req.session.user.id : null,
      visitorKey,
      audience: simulatorPage.audience,
      limit: 4
    })
    : (req.session.savedEarningsScenarios || [])
      .filter(item => item.audience === simulatorPage.audience)
      .slice(0, 4);

  res.render('pages/public/simulatore-guadagno', {
    title: simulatorPage.audience === 'restaurant' ? 'Simulatore per Ristoratori' : 'Simulatore Guadagno',
    simulatorMeta,
    simulatorInitial,
    simulatorPage,
    savedScenarios
  });
}

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'output')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'tavolibero-secret-key-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Make session user available to all templates
app.use((req, res, next) => {
  if (req.session.user) {
    const liveUser = db.getUser(req.session.user.id);
    if (!liveUser || liveUser.status === 'suspended') {
      req.session.destroy(() => {});
      res.locals.currentUser = null;
      res.locals.path = req.path;
      return next();
    }

    const { password: _, ...safeUser } = liveUser;
    req.session.user = safeUser;
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.path = req.path;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const cameriereRoutes = require('./routes/cameriere');
const ristoranteRoutes = require('./routes/ristorante');
const adminRoutes = require('./routes/admin');
const webhooksRoutes = require('./routes/webhooks');
const { requireAuth, requireRole } = require('./middleware/auth');

// Public webhook endpoint (bypass auth: Stripe calls without session).
// Must be mounted BEFORE any requireAuth-protected routes.
app.use('/webhooks', webhooksRoutes);

app.use('/', authRoutes);
app.use('/api', apiRoutes);
app.use('/cameriere', requireAuth, requireRole('cameriere'), cameriereRoutes);
app.use('/ristorante', requireAuth, requireRole('ristorante'), ristoranteRoutes);
app.use('/admin', requireAuth, requireRole('admin'), adminRoutes);

// Public pages
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role === 'admin' ? 'admin' : req.session.user.role}/dashboard`);
  }
  res.render('pages/public/landing-camerieri', { title: 'Per Camerieri Freelance' });
});

app.get('/per-ristoranti', (req, res) => {
  res.render('pages/public/landing-ristoranti', { title: 'Per Ristoranti' });
});

app.get('/come-funziona', (req, res) => {
  res.render('pages/public/come-funziona', { title: 'Come Funziona' });
});

app.get('/pricing', (req, res) => {
  res.render('pages/public/pricing', { title: 'Commissioni' });
});

app.get('/simulatore-guadagno', async (req, res) => {
  await renderSimulatorPage(req, res, 'worker');
});

app.get('/simulatore-ristoratori', async (req, res) => {
  if (!req.session.simulatorVisitorKey) {
    req.session.simulatorVisitorKey = createVisitorKey();
  }
  await renderSimulatorPage(req, res, 'restaurant');
});

app.get('/faq', (req, res) => {
  res.render('pages/public/faq', { title: 'FAQ' });
});

// 404
app.use((req, res) => {
  res.status(404).render('pages/public/404', { title: 'Pagina non trovata' });
});

db.ready.finally(() => {
  app.listen(PORT, () => {
    const prisma = getPrismaClient();
    if (prisma && process.env.ENABLE_PAYMENT_AGENT_SCHEDULER === 'true') {
      startPaymentAgentScheduler(prisma, {
        intervalMs: process.env.PAYMENT_AGENT_INTERVAL_MS
      });
      console.log('PaymentAgent scheduler attivo');
    }
    console.log(`TavoloLibero running at http://localhost:${PORT}`);
  });
});
