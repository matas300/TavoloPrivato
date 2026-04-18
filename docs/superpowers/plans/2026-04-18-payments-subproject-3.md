# Payments Sub-project 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Load also `finance/commercialista-italiano` skill if you need to reason about fiscal details.

**Goal:** Aggiungere un webhook handler asincrono che consuma `StripeEvent.status='pending'` → `processed`, con retry/DLQ in-tabella. Include handler per `withholding.reported` che aggrega su un nuovo model `WithholdingAccrual` — base operativa per Sub-progetto 2c (report F24).

**Architecture:** Processor sync in-process (niente queue esterna). Registry `{ eventType: handler }` con handler idempotenti. Retry incrementale in-tabella (pending → failed → dead dopo maxRetries). Endpoint pubblico `/webhooks/stripe` per singolo evento (bypass auth), endpoint admin per batch + retry + stats. Signature helper stub per live mode.

**Tech Stack:** Prisma/SQLite, Express (già presente), zero nuove dipendenze.

**Spec di riferimento:** `docs/superpowers/specs/2026-04-18-payments-subproject-3-design.md`.

**Invarianti fiscali (non toccare senza skill commercialista-italiano):**
- Marketplace NON è sostituto d'imposta. L'handler `withholding.reported` NON muove cash della ritenuta; aggrega informativo per report F24 al ristorante (sub-2c).
- Il sub-3 NON emette F24 reale. Solo prepara il dato aggregato.

---

## File Structure

### Create
- `prisma/migrations/<ts>_withholding_accrual_and_event_retry/migration.sql`
- `lib/webhook-processor.js` (~180 LOC)
- `lib/stripe-signature.js` (~25 LOC)
- `routes/webhooks.js` (~40 LOC)
- `scripts/smoke-webhook.js` (~160 LOC)

### Modify
- `prisma/schema.prisma` — +1 model WithholdingAccrual, estensione StripeEvent (retryCount + lastRetryAt), relation su WorkerProfile/RestaurantProfile.
- `routes/admin.js` — +3 route webhooks admin (process-pending, retry-failed, stats).
- `server.js` — mount `/webhooks` PRIMA di requireAuth.
- `package.json` — +1 script `smoke:webhook`.
- `.env.example` — STRIPE_WEBHOOK_SECRET=mock-secret.
- `CLAUDE.md` — sezione "Webhook handler".
- `memory/payments_architecture.md`, `memory/payments_roadmap.md`, `memory/compliance_rules.md`.

### Test vehicle
Zero framework. `npm run smoke:webhook` (nuovo) + `npm run smoke:payments` (invariato 43/43) + `npm run mcp:smoke` (invariato 5/5).

---

## Task 1: Schema — WithholdingAccrual + estensione StripeEvent

**Objective:** Aggiungere model `WithholdingAccrual` e estendere `StripeEvent` con `retryCount` + `lastRetryAt`.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Localizzare StripeEvent e le profile models**

```bash
grep -n "^model StripeEvent\|^model WorkerProfile\|^model RestaurantProfile" prisma/schema.prisma
```

- [ ] **Step 2: Estendere StripeEvent**

Aggiungere dopo il campo `error String?`:

```prisma
  retryCount      Int       @default(0)
  lastRetryAt     DateTime?
```

- [ ] **Step 3: Aggiungere model WithholdingAccrual in fondo al file**

```prisma
model WithholdingAccrual {
  id                  Int       @id @default(autoincrement())
  restaurantProfileId Int
  workerProfileId     Int
  periodYear          Int
  periodMonth         Int
  taxRegimeSnapshot   String
  totalAmountEur      Float     @default(0)
  invoiceCount        Int       @default(0)
  firstInvoiceAt      DateTime
  lastInvoiceAt       DateTime
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  restaurantProfile   RestaurantProfile @relation(fields: [restaurantProfileId], references: [id], onDelete: Cascade)
  workerProfile       WorkerProfile     @relation(fields: [workerProfileId], references: [id], onDelete: Cascade)

  @@unique([restaurantProfileId, workerProfileId, periodYear, periodMonth, taxRegimeSnapshot], name: "accrual_unique_key")
  @@index([restaurantProfileId, periodYear, periodMonth])
}
```

- [ ] **Step 4: Aggiungere relation arrays a WorkerProfile e RestaurantProfile**

In `model WorkerProfile`, aggiungere tra le relation esistenti:
```prisma
  withholdingAccruals  WithholdingAccrual[]
```

In `model RestaurantProfile`, stesso:
```prisma
  withholdingAccruals  WithholdingAccrual[]
```

- [ ] **Step 5: Validate**

```bash
npm run db:validate
```
Expected: "valid".

- [ ] **Step 6: db:generate**

```bash
npm run db:generate
```

- [ ] **Step 7: NON creare migration ancora** (Task 2 la farà).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add WithholdingAccrual + StripeEvent retry fields

WithholdingAccrual aggrega ritenuta per (ristorante, worker, periodo,
regime) — base per report F24 al ristorante (sub-2c). Chiave unique
composta. StripeEvent esteso con retryCount e lastRetryAt per supporto
retry/DLQ in-tabella (sub-3 webhook handler). Tutto additive."
```

---

## Task 2: Migration Prisma

**Objective:** Applicare la migration additiva al dev.db. Zero perdita dati.

- [ ] **Step 1: Creare migration**

```bash
npx prisma migrate dev --name withholding_accrual_and_event_retry
```

Prisma per SQLite può richiedere rebuild della tabella `StripeEvent` (aggiunta di 2 colonne). Se propone reset del DB, RIFIUTARE. Il pattern atteso è ADD COLUMN per StripeEvent + CREATE TABLE per WithholdingAccrual.

- [ ] **Step 2: Ispezionare SQL**

```bash
MIG=$(ls -t prisma/migrations/ | head -1)
echo "Migration: $MIG"
cat "prisma/migrations/$MIG/migration.sql"
```

Verificare che:
- StripeEvent abbia solo ALTER TABLE ADD COLUMN (o table-rebuild con INSERT SELECT completo).
- WithholdingAccrual abbia CREATE TABLE + CREATE UNIQUE INDEX + CREATE INDEX.
- Nessun DROP senza backfill.

- [ ] **Step 3: Smoke non-regressione**

```bash
npm run smoke:payments 2>&1 | tail -5
npm run mcp:smoke 2>&1 | tail -5
```

Expected: 43/43, 5/5.

- [ ] **Step 4: Verifica nuove tabelle**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const se = await p.\$queryRaw\`PRAGMA table_info('StripeEvent')\`;
  const wa = await p.\$queryRaw\`PRAGMA table_info('WithholdingAccrual')\`;
  console.log('StripeEvent cols:', se.map(c => c.name).join(','));
  console.log('WithholdingAccrual cols:', wa.map(c => c.name).join(','));
  await p.\$disconnect();
})();
"
```

Expected: StripeEvent include retryCount, lastRetryAt. WithholdingAccrual presente con tutti i campi.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/
git commit -m "chore(db): migration WithholdingAccrual + StripeEvent retry cols

Additiva: ALTER TABLE ADD COLUMN su StripeEvent (retryCount, lastRetryAt),
CREATE TABLE WithholdingAccrual con unique (restaurant, worker, year,
month, regime). Smoke payments 43/43 invariato."
```

---

## Task 3: `lib/stripe-signature.js` — signature stub

**Objective:** Creare helper che in mock mode accetta tutto, in live lancia errore esplicito (implementazione HMAC rimandata a sub futuro).

**Files:**
- Create: `lib/stripe-signature.js`

- [ ] **Step 1: Scrivere il file**

```javascript
// lib/stripe-signature.js
// Mock: accetta qualsiasi firma (compresa vuota/null).
// Live: verifica HMAC Stripe-standard. Implementazione rimandata a quando
// STRIPE_MODE=live sara effettivamente attivato.

function verifySignature(rawBody, signatureHeader, secret) {
  const mode = (process.env.STRIPE_MODE || 'mock').toLowerCase();
  if (mode !== 'live') return true;

  // TODO: implementare verifica HMAC SHA-256 alla Stripe quando si va live.
  // Reference: https://stripe.com/docs/webhooks/signatures
  // const elements = (signatureHeader || '').split(',');
  // const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
  // const signatures = elements.filter(e => e.startsWith('v1=')).map(e => e.slice(3));
  // if (!timestamp || !signatures.length) return false;
  // const payload = `${timestamp}.${rawBody}`;
  // const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // return signatures.some(s => crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));

  throw new Error('stripe signature verification not yet implemented for live mode');
}

module.exports = { verifySignature };
```

- [ ] **Step 2: Smoke unit rapido**

```bash
node -e "
const { verifySignature } = require('./lib/stripe-signature');
// mock default
console.log('mock/any:', verifySignature('payload', 't=123,v1=abc', 'sec') === true);
console.log('mock/null-sig:', verifySignature('payload', null, 'sec') === true);
// live mode → throws
process.env.STRIPE_MODE='live';
try { verifySignature('p','s','k'); console.error('FAIL: live should throw'); process.exit(1); }
catch(e){ console.log('live throws OK:', e.message); }
"
```

Expected: mock torna true, live throws.

- [ ] **Step 3: Commit**

```bash
git add lib/stripe-signature.js
git commit -m "feat(webhook): add stripe signature verification stub

In mock mode accetta qualsiasi firma (zero attrito per test locali).
In live mode lancia error esplicito — implementazione HMAC SHA-256
rimandata a quando STRIPE_MODE=live verra effettivamente attivato.
Pattern reference Stripe.webhooks.constructEvent gia commentato come TODO."
```

---

## Task 4: `lib/webhook-processor.js` — processor core

**Objective:** Creare il processor con registry handlers, funzioni `processEvent`, `processPending`, `processPendingRetry`. Handler idempotenti.

**Files:**
- Create: `lib/webhook-processor.js`

- [ ] **Step 1: Scrivere il file**

```javascript
// lib/webhook-processor.js
// Processor sync in-process per StripeEvent. Registry di handler per
// event type. Retry/DLQ in-tabella: pending -> failed (retryCount++) -> dead.
//
// Idempotenza centralizzata nel wrapper: se status='processed', skip.
// Gli handler devono essere scritti idempotenti (updateMany con filtro
// sullo stato target, upsert, etc.).

async function handleInvoicePaid(prisma, event) {
  const invId = event.payload?.id;
  if (!invId) throw new Error('invoice.paid payload missing id');
  const result = await prisma.invoice.updateMany({
    where: { providerInvoiceId: invId, invoiceStatus: { not: 'paid' } },
    data: { invoiceStatus: 'paid', paidAt: new Date() }
  });
  return { updated: result.count };
}

async function handlePaymentIntentCaptured(prisma, event) {
  const piId = event.payload?.id;
  if (!piId) throw new Error('payment_intent.captured payload missing id');
  const result = await prisma.paymentOrder.updateMany({
    where: { providerPaymentIntentId: piId, status: { not: 'captured' } },
    data: { status: 'captured', capturedAt: new Date() }
  });
  return { updated: result.count };
}

async function handleWithholdingReported(prisma, event) {
  const p = event.payload || {};
  const { invoiceId, workerProfileId, restaurantProfileId, amountEur, taxRegime } = p;

  if (!invoiceId || !workerProfileId || !restaurantProfileId || !taxRegime) {
    throw new Error('withholding.reported payload incomplete');
  }
  if (typeof amountEur !== 'number' || amountEur <= 0) {
    return { skipped: true, reason: 'zero_or_invalid_amount' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { issuedAt: true }
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const issuedAt = invoice.issuedAt;
  const periodYear = issuedAt.getUTCFullYear();
  const periodMonth = issuedAt.getUTCMonth() + 1;

  const key = {
    restaurantProfileId_workerProfileId_periodYear_periodMonth_taxRegimeSnapshot: {
      restaurantProfileId, workerProfileId, periodYear, periodMonth,
      taxRegimeSnapshot: taxRegime,
    }
  };

  const existing = await prisma.withholdingAccrual.findUnique({ where: key });
  if (existing) {
    const nextLast = issuedAt > existing.lastInvoiceAt ? issuedAt : existing.lastInvoiceAt;
    const nextFirst = issuedAt < existing.firstInvoiceAt ? issuedAt : existing.firstInvoiceAt;
    const updated = await prisma.withholdingAccrual.update({
      where: { id: existing.id },
      data: {
        totalAmountEur: { increment: amountEur },
        invoiceCount: { increment: 1 },
        firstInvoiceAt: nextFirst,
        lastInvoiceAt: nextLast,
      }
    });
    return { action: 'aggregated', accrualId: updated.id, totalAmountEur: updated.totalAmountEur };
  }

  const created = await prisma.withholdingAccrual.create({
    data: {
      restaurantProfileId, workerProfileId, periodYear, periodMonth,
      taxRegimeSnapshot: taxRegime,
      totalAmountEur: amountEur, invoiceCount: 1,
      firstInvoiceAt: issuedAt, lastInvoiceAt: issuedAt,
    }
  });
  return { action: 'created', accrualId: created.id, totalAmountEur: created.totalAmountEur };
}

async function noop(prisma, event) {
  return { noop: true, eventType: event.eventType };
}

const handlers = {
  'invoice.paid': handleInvoicePaid,
  'payment_intent.captured': handlePaymentIntentCaptured,
  'withholding.reported': handleWithholdingReported,
  // No-op placeholders: eventi che il payment-agent gia processa sincronamente.
  'payment_intent.created': noop,
  'invoice.created': noop,
  'invoice.finalized': noop,
  'transfer.created': noop,
  'account.created': noop,
  'customer.created': noop,
};

async function processEvent(prisma, stripeEvent, { maxRetries = 3 } = {}) {
  if (stripeEvent.status === 'processed') {
    return { status: 'already_processed', eventId: stripeEvent.id };
  }

  const handler = handlers[stripeEvent.eventType];
  if (!handler) {
    const error = `unhandled event type: ${stripeEvent.eventType}`;
    const newRetryCount = stripeEvent.retryCount + 1;
    const newStatus = newRetryCount >= maxRetries ? 'dead' : 'failed';
    await prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: { status: newStatus, retryCount: newRetryCount, error, lastRetryAt: new Date() }
    });
    return { status: newStatus, eventId: stripeEvent.id, error };
  }

  try {
    const result = await handler(prisma, stripeEvent);
    await prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: { status: 'processed', processedAt: new Date(), error: null }
    });
    return { status: 'processed', eventId: stripeEvent.id, result };
  } catch (err) {
    const newRetryCount = stripeEvent.retryCount + 1;
    const newStatus = newRetryCount >= maxRetries ? 'dead' : 'failed';
    await prisma.stripeEvent.update({
      where: { id: stripeEvent.id },
      data: { status: newStatus, retryCount: newRetryCount, error: err.message, lastRetryAt: new Date() }
    });
    return { status: newStatus, eventId: stripeEvent.id, error: err.message };
  }
}

async function processPending(prisma, { limit = 100, maxRetries = 3 } = {}) {
  const events = await prisma.stripeEvent.findMany({
    where: { status: { in: ['pending', 'failed'] }, retryCount: { lt: maxRetries } },
    orderBy: { receivedAt: 'asc' },
    take: limit,
  });
  const results = [];
  for (const ev of events) {
    results.push(await processEvent(prisma, ev, { maxRetries }));
  }
  return {
    total: events.length,
    processed: results.filter(r => r.status === 'processed').length,
    failed: results.filter(r => r.status === 'failed').length,
    dead: results.filter(r => r.status === 'dead').length,
    already_processed: results.filter(r => r.status === 'already_processed').length,
    results,
  };
}

async function processPendingRetry(prisma, { limit = 100, maxRetries = 3 } = {}) {
  const events = await prisma.stripeEvent.findMany({
    where: { status: 'failed', retryCount: { lt: maxRetries } },
    orderBy: [{ lastRetryAt: 'asc' }, { receivedAt: 'asc' }],
    take: limit,
  });
  const results = [];
  for (const ev of events) {
    results.push(await processEvent(prisma, ev, { maxRetries }));
  }
  return { total: events.length, results };
}

module.exports = {
  processEvent, processPending, processPendingRetry,
  handlers,
};
```

- [ ] **Step 2: Syntax check**

```bash
node -e "require('./lib/webhook-processor')"
```
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add lib/webhook-processor.js
git commit -m "feat(webhook): add processor with handler registry

Registry { eventType: handler } con handler per invoice.paid,
payment_intent.captured, withholding.reported + noop per 6 event
type gia processati sincronamente dal payment-agent.

processEvent: idempotente (skip se status=processed), retry +
DLQ in-tabella (pending -> failed -> dead dopo maxRetries=3).
Handler con eventType sconosciuto vanno in failed/dead con error
esplicito (niente silent skip).

processPending: batch orderBy receivedAt asc, limit cappato.
processPendingRetry: solo status=failed orderBy lastRetryAt asc.

handleWithholdingReported aggrega su WithholdingAccrual per
(ristorante, worker, anno, mese, regime) — upsert con increment
atomic su totalAmountEur e invoiceCount. Deriva periodo da
invoice.issuedAt UTC."
```

---

## Task 5: `routes/webhooks.js` — endpoint pubblico

**Objective:** Creare route `/webhooks/stripe` che accetta payload minimalista, verifica firma (stub), carica StripeEvent dal DB e chiama processEvent.

**Files:**
- Create: `routes/webhooks.js`

- [ ] **Step 1: Scrivere il file**

```javascript
// routes/webhooks.js
// Endpoint pubblico per webhook Stripe. Bypass auth (Stripe chiama
// senza sessione utente). Signature verification via lib/stripe-signature:
// mock accetta tutto, live verifica HMAC.

const express = require('express');
const { getPrismaClient } = require('../lib/prisma');
const { processEvent } = require('../lib/webhook-processor');
const { verifySignature } = require('../lib/stripe-signature');

const router = express.Router();

router.post('/stripe', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'prisma_unavailable' });

  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET || 'mock-secret';

  try {
    if (!verifySignature(rawBody, sig, secret)) {
      return res.status(400).json({ error: 'invalid_signature' });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const providerEventId = req.body?.providerEventId || req.body?.id;
  if (!providerEventId) return res.status(400).json({ error: 'missing_providerEventId' });

  const event = await prisma.stripeEvent.findUnique({ where: { providerEventId } });
  if (!event) return res.status(404).json({ error: 'event_not_found' });

  try {
    const result = await processEvent(prisma, event);
    res.json(result);
  } catch (err) {
    console.error('[webhooks/stripe] unexpected error:', err);
    res.status(500).json({ error: 'processor_internal_error' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Montare in server.js PRIMA di requireAuth**

In `server.js`, trovare la riga `app.use(express.json());` (circa 128) e DOPO aggiungere (se non c'è già in zona, a riga 169 c'è /admin gated):

```javascript
const webhooksRoutes = require('./routes/webhooks');
app.use('/webhooks', webhooksRoutes);
```

IMPORTANTE: questo deve stare PRIMA di qualsiasi `app.use('/...', requireAuth, ...)`. Verificare con grep.

- [ ] **Step 3: Verifica syntax server.js**

```bash
node -e "require('./server')" 2>&1 | head -5 &
SERVER_PID=$!
sleep 2
kill $SERVER_PID 2>/dev/null
```

Oppure più sicuro: avviare il server in background e fare una health request.

```bash
node server.js &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/webhooks/stripe -H 'Content-Type: application/json' -d '{"providerEventId":"nope"}'
# expected: 404 (event_not_found) — significa che la route e raggiungibile e non c'e auth gate
kill $SERVER_PID 2>/dev/null
wait 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add routes/webhooks.js server.js
git commit -m "feat(webhook): add public POST /webhooks/stripe endpoint

Bypass auth (Stripe chiama senza sessione utente). Verifica firma via
lib/stripe-signature (mock permissivo, live throws finche HMAC non
implementato). Accetta payload minimalista { providerEventId } che
usa come chiave per caricare StripeEvent dal DB e chiama processEvent.

Montato in server.js PRIMA di requireAuth e prima di /admin gated."
```

---

## Task 6: Admin routes — process-pending, retry-failed, stats

**Objective:** Aggiungere 3 route admin per processare in batch e ispezionare stats.

**Files:**
- Modify: `routes/admin.js`

- [ ] **Step 1: Localizzare il punto giusto in routes/admin.js**

```bash
head -30 routes/admin.js
grep -n "^router\.\|^const " routes/admin.js | head -20
```

Aggiungere in cima, con gli altri require:
```javascript
const { processPending, processPendingRetry } = require('../lib/webhook-processor');
const { getPrismaClient } = require('../lib/prisma');
```

- [ ] **Step 2: Aggiungere le 3 route**

Alla fine del file, prima di `module.exports`:

```javascript
router.post('/webhooks/process-pending', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'prisma_unavailable' });
  const limit = Math.min(1000, parseInt(req.query.limit || '100', 10) || 100);
  try {
    const result = await processPending(prisma, { limit });
    res.json(result);
  } catch (err) {
    console.error('[admin/webhooks/process-pending]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhooks/retry-failed', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'prisma_unavailable' });
  const limit = Math.min(1000, parseInt(req.query.limit || '100', 10) || 100);
  try {
    const result = await processPendingRetry(prisma, { limit });
    res.json(result);
  } catch (err) {
    console.error('[admin/webhooks/retry-failed]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/webhooks/stats', async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'prisma_unavailable' });
  const [pending, processed, failed, dead] = await Promise.all([
    prisma.stripeEvent.count({ where: { status: 'pending' } }),
    prisma.stripeEvent.count({ where: { status: 'processed' } }),
    prisma.stripeEvent.count({ where: { status: 'failed' } }),
    prisma.stripeEvent.count({ where: { status: 'dead' } }),
  ]);
  res.json({ pending, processed, failed, dead });
});
```

ATTENZIONE: se il file `routes/admin.js` usa `module.exports = router` al fondo, assicurarsi che il router sia lo stesso. Se invece usa `module.exports = (router) => {...}` — molto meno comune — adattare.

- [ ] **Step 3: Syntax check**

```bash
node -e "require('./routes/admin')"
```

- [ ] **Step 4: Commit**

```bash
git add routes/admin.js
git commit -m "feat(webhook): add admin routes for batch processing

POST /admin/webhooks/process-pending?limit=100 — processa in batch
tutti gli StripeEvent pending/failed con retryCount<maxRetries.
Limit cappato a 1000.

POST /admin/webhooks/retry-failed?limit=100 — ri-processa solo i
failed (utile dopo fix bug negli handler).

GET /admin/webhooks/stats — counts per status { pending, processed,
failed, dead }. Per diagnostica in UI admin futura (sub-2c/UI)."
```

---

## Task 7: `scripts/smoke-webhook.js` + package.json

**Objective:** Smoke test end-to-end del webhook processor.

**Files:**
- Create: `scripts/smoke-webhook.js`
- Modify: `package.json` (+script `smoke:webhook`)

- [ ] **Step 1: Aggiungere script a package.json**

```json
  "scripts": {
    ...
    "smoke:webhook": "node scripts/smoke-webhook.js"
  }
```

- [ ] **Step 2: Scrivere lo smoke**

```javascript
#!/usr/bin/env node
// Smoke webhook end-to-end: usa i fixture smoke-payments per generare
// StripeEvent (inclusi 2 withholding.reported), poi processa e asserisce.

require('dotenv').config();

const { getPrismaClient } = require('../lib/prisma');
const { getStripe } = require('../lib/stripe');
const bankAccountService = require('../data/bank-account-service');
const {
  runMonthlyBillingCycle,
  captureDuePaymentOrders
} = require('../lib/payment-agent');
const {
  processEvent, processPending, processPendingRetry
} = require('../lib/webhook-processor');

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '\u2713' : '\u2717'} ${name}${detail ? ' -- ' + detail : ''}`);
}

async function setupFixture(prisma, stripe) {
  const contract = await prisma.serviceContract.findFirst({
    where: { engagementType: 'long_term' },
    include: { workerProfile: true, restaurantProfile: true }
  });
  if (!contract) { console.error('seed mancante'); process.exit(1); }
  if (!contract.workerProfile.stripeAccountId) {
    const acct = await stripe.accounts.create({ type: 'express', country: 'IT' });
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { stripeAccountId: acct.id } });
    contract.workerProfile.stripeAccountId = acct.id;
  }
  if (!contract.restaurantProfile.stripeCustomerId) {
    const cus = await stripe.customers.create({ name: contract.restaurantProfile.displayName || 'Ristorante' });
    await prisma.restaurantProfile.update({ where: { id: contract.restaurantProfile.id }, data: { stripeCustomerId: cus.id } });
    contract.restaurantProfile.stripeCustomerId = cus.id;
  }
  let primary = await bankAccountService.getPrimary('worker', contract.workerProfile.id);
  if (!primary) {
    const c = await bankAccountService.createForOwner('worker', contract.workerProfile.id, {
      iban: 'IT60X0542811101000000123456',
      holderName: 'Worker Test',
      holderFiscalCode: 'RSSMRA80A01H501U'
    });
    primary = c.bankAccount;
  }
  return contract;
}

async function createMilestone(prisma, contract, sequence, y, m, d) {
  return prisma.contractMilestone.create({
    data: {
      serviceContractId: contract.id,
      sequence,
      milestoneLabel: `WEBHOOK SMOKE seq ${sequence}`,
      periodStart: new Date(y, m - 1, d),
      periodEnd: new Date(y, m - 1, d),
      invoiceDate: new Date(y, m - 1, d),
      dueDate: new Date(y, m - 1, d + 7),
      taxableAmountEur: 1000,
      platformFeeEur: 100,
      workerNetEur: 900,
      status: 'planned'
    }
  });
}

async function cleanup(prisma, milestoneIds) {
  for (const id of milestoneIds) {
    const orders = await prisma.paymentOrder.findMany({ where: { contractMilestoneId: id } });
    for (const o of orders) {
      await prisma.escrowLedger.deleteMany({ where: { paymentOrderId: o.id } });
      await prisma.payout.deleteMany({ where: { paymentOrderId: o.id } });
      await prisma.invoice.deleteMany({ where: { paymentOrderId: o.id } });
    }
    await prisma.paymentOrder.deleteMany({ where: { contractMilestoneId: id } });
    await prisma.contractMilestone.deleteMany({ where: { id } });
  }
}

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) { console.error('prisma_unavailable'); process.exit(2); }
  const stripe = getStripe();

  const contract = await setupFixture(prisma, stripe);
  const originalTaxMode = contract.workerProfile.taxMode;
  const milestoneIds = [];

  try {
    // Crea 2 milestone: una auth_occ, una P.IVA ord. Entrambe genereranno 'withholding.reported'.
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { taxMode: 'autonomo_occasionale' } });
    const ms1 = await createMilestone(prisma, contract, 200, 2027, 3, 10);
    milestoneIds.push(ms1.id);
    await runMonthlyBillingCycle(prisma, { asOfDate: new Date(2027, 2, 15) });
    await captureDuePaymentOrders(prisma, { now: new Date(2027, 2, 20) });

    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { taxMode: 'partita_iva_ordinaria' } });
    const ms2 = await createMilestone(prisma, contract, 201, 2027, 3, 11);
    milestoneIds.push(ms2.id);
    await runMonthlyBillingCycle(prisma, { asOfDate: new Date(2027, 2, 15) });
    await captureDuePaymentOrders(prisma, { now: new Date(2027, 2, 20) });

    // 1) Counts prima del processing.
    const preStats = {
      pending: await prisma.stripeEvent.count({ where: { status: 'pending' } }),
      processed: await prisma.stripeEvent.count({ where: { status: 'processed' } }),
    };
    record('fixture: StripeEvent pending > 0', preStats.pending > 0, `pending=${preStats.pending}`);
    const whEventsBefore = await prisma.stripeEvent.count({ where: { eventType: 'withholding.reported', status: 'pending' } });
    record('fixture: withholding.reported pending >= 2', whEventsBefore >= 2, `count=${whEventsBefore}`);

    // 2) Process batch
    const batch = await processPending(prisma, { limit: 1000 });
    record('batch: processed > 0', batch.processed > 0, `processed=${batch.processed}`);
    record('batch: dead === 0', batch.dead === 0, `dead=${batch.dead}`);

    // 3) Tutti i withholding.reported ora processed
    const whProcessed = await prisma.stripeEvent.count({ where: { eventType: 'withholding.reported', status: 'processed' } });
    record('tutti withholding.reported processed', whProcessed >= 2, `count=${whProcessed}`);
    const pendingAfter = await prisma.stripeEvent.count({ where: { status: 'pending' } });
    record('no pending residui post-batch', pendingAfter === 0, `pending=${pendingAfter}`);

    // 4) WithholdingAccrual: 2 record creati (stesso ristorante+worker+anno+mese ma regimi diversi)
    const accruals = await prisma.withholdingAccrual.findMany({
      where: { workerProfileId: contract.workerProfile.id, periodYear: 2027, periodMonth: 3 }
    });
    record('WithholdingAccrual count === 2', accruals.length === 2, `count=${accruals.length}`);

    const authOcc = accruals.find(a => a.taxRegimeSnapshot === 'autonomo_occasionale');
    record('accrual auth_occ: totalAmountEur === 200', !!authOcc && authOcc.totalAmountEur === 200, authOcc && String(authOcc.totalAmountEur));
    record('accrual auth_occ: invoiceCount === 1', !!authOcc && authOcc.invoiceCount === 1, authOcc && String(authOcc.invoiceCount));
    const pIva = accruals.find(a => a.taxRegimeSnapshot === 'partita_iva_ordinaria');
    record('accrual P.IVA: totalAmountEur === 200', !!pIva && pIva.totalAmountEur === 200, pIva && String(pIva.totalAmountEur));

    // 5) Ri-eseguire processPending e' no-op
    const rerun = await processPending(prisma, { limit: 1000 });
    record('replay: total === 0', rerun.total === 0, `total=${rerun.total}`);

    // 6) processEvent diretto su evento gia processed → already_processed
    const oneProcessed = await prisma.stripeEvent.findFirst({ where: { eventType: 'withholding.reported', status: 'processed' } });
    const replayResult = await processEvent(prisma, oneProcessed);
    record('processEvent su processed → already_processed', replayResult.status === 'already_processed', replayResult.status);

    // 7) Test event type unknown + retry/DLQ
    const unknownEvent = await prisma.stripeEvent.create({
      data: {
        providerEventId: `evt_mock_test_unknown_${Date.now()}`,
        eventType: 'test.totally_unknown',
        payload: { foo: 'bar' },
        status: 'pending',
      }
    });
    // Retry 1 → failed
    const r1 = await processEvent(prisma, unknownEvent, { maxRetries: 3 });
    record('unknown event: 1st attempt → failed', r1.status === 'failed', `status=${r1.status} rc=?`);
    const afterR1 = await prisma.stripeEvent.findUnique({ where: { id: unknownEvent.id } });
    record('unknown event: retryCount === 1', afterR1.retryCount === 1, `rc=${afterR1.retryCount}`);
    // Retry 2 → failed
    await processEvent(prisma, afterR1, { maxRetries: 3 });
    const afterR2 = await prisma.stripeEvent.findUnique({ where: { id: unknownEvent.id } });
    record('unknown event: retryCount === 2', afterR2.retryCount === 2 && afterR2.status === 'failed', `rc=${afterR2.retryCount} status=${afterR2.status}`);
    // Retry 3 → dead
    await processEvent(prisma, afterR2, { maxRetries: 3 });
    const afterR3 = await prisma.stripeEvent.findUnique({ where: { id: unknownEvent.id } });
    record('unknown event: 3rd attempt → dead', afterR3.status === 'dead' && afterR3.retryCount === 3, `status=${afterR3.status} rc=${afterR3.retryCount}`);

    // 8) processPendingRetry NON ri-prende i dead
    const retryResult = await processPendingRetry(prisma, { limit: 100 });
    const deadInRetry = retryResult.results.find(r => r.eventId === unknownEvent.id);
    record('processPendingRetry esclude dead', !deadInRetry, deadInRetry ? 'ERRATO' : 'ok');

    // Cleanup unknown event.
    await prisma.stripeEvent.delete({ where: { id: unknownEvent.id } });

    // 9) Cleanup accruals di test (altrimenti inquinano il DB)
    await prisma.withholdingAccrual.deleteMany({
      where: { workerProfileId: contract.workerProfile.id, periodYear: 2027, periodMonth: 3 }
    });
  } finally {
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { taxMode: originalTaxMode } });
    await cleanup(prisma, milestoneIds);
  }

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passati`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Errore fatale:', err); process.exit(1); });
```

- [ ] **Step 3: Run**

```bash
npm run smoke:webhook
```

Expected: 15+/15+ passed, exit 0.

Se fallisce, diagnostica iterando.

- [ ] **Step 4: Regressione**

```bash
npm run smoke:payments
npm run mcp:smoke
```

Expected: 43/43 e 5/5 invariati.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/smoke-webhook.js
git commit -m "test(smoke-webhook): end-to-end processor coverage

15+ check: pending batch processing, withholding aggregation (2 regimi
stesso mese → 2 accrual distinti), replay-safety (already_processed),
retry cascade (failed→failed→dead a maxRetries=3), processPendingRetry
esclude i dead. Fixture: 2 milestone con regime diverso sul contratto
long_term esistente + taxMode ripristinato a fine run. Cleanup
artifacts + accruals dopo asserzioni.

smoke:payments 43/43 invariato. mcp:smoke 5/5 invariato."
```

---

## Task 8: `.env.example` + CLAUDE.md + memory

**Objective:** Documentare sub-3 in CLAUDE.md + aggiornare memory.

**Files:**
- Modify: `.env.example`, `CLAUDE.md`, `memory/payments_architecture.md`, `memory/payments_roadmap.md`.

- [ ] **Step 1: `.env.example`**

Aggiungere:
```
STRIPE_WEBHOOK_SECRET=mock-secret
```

- [ ] **Step 2: `CLAUDE.md` — nuova sezione dopo "Calcolo fiscale ritenuta"**

```markdown
## Webhook handler (Sub-progetto 3)

Processore asincrono per `StripeEvent`: consuma `status='pending'` → `processed`, con retry/DLQ in-tabella.

- **Modulo**: `lib/webhook-processor.js`. Registry `handlers[eventType]`. Handler idempotenti. Wrapper `processEvent` skippa se già `processed`.
- **Retry**: `pending` → `failed` (retryCount++) → `dead` (a `retryCount >= maxRetries`, default 3). Event type sconosciuti vanno in `failed`/`dead`.
- **Aggregazione ritenuta**: handler `withholding.reported` fa upsert su `WithholdingAccrual` per `(ristorante, worker, anno, mese, regime)`. Somma `totalAmountEur`, incrementa `invoiceCount`. Base dati per report F24 (Sub-progetto 2c).
- **Endpoint pubblico**: `POST /webhooks/stripe`. Bypass auth. Signature via `lib/stripe-signature` (stub mock permissivo, live lancia finché HMAC non implementato). Accetta `{ providerEventId }`, carica StripeEvent, chiama processEvent.
- **Endpoint admin**: `POST /admin/webhooks/process-pending`, `POST /admin/webhooks/retry-failed`, `GET /admin/webhooks/stats`.
- **Live mode**: `.env` → `STRIPE_WEBHOOK_SECRET=<secret-da-Stripe-Dashboard>`. Implementare HMAC in `lib/stripe-signature.js`.

Smoke: `npm run smoke:webhook` (15+ check).
```

- [ ] **Step 3: `memory/payments_architecture.md` — aggiornare stato**

Sostituire il blocco "Stato al 2026-04-18 (Sub-progetto 2 done)" con "Stato al 2026-04-18 (Sub-progetti 1+2+3 done)" aggiungendo:

```markdown
**Nuovo (sub-3):**
- `lib/webhook-processor.js` — processor sync in-process con retry/DLQ.
- Model `WithholdingAccrual` — aggregato mensile ritenuta per ristorante/worker/regime.
- Endpoint `/webhooks/stripe` (public) + `/admin/webhooks/*` (admin).
- `lib/stripe-signature.js` — stub HMAC per live mode futuro.
- StripeEvent esteso con `retryCount` e `lastRetryAt`.

**Flusso end-to-end ora**:
1. payment-agent scrive StripeEvent(status=pending).
2. webhook-processor processa (batch via /admin o singolo via /webhooks/stripe) → status=processed.
3. Handler `withholding.reported` alimenta `WithholdingAccrual` (base sub-2c).
4. Event type sconosciuti → failed/dead, visibili in /admin/webhooks/stats.
```

E alla sezione "Cosa NON c'è ancora" rimuovere "Webhook handler..." perché ora c'è.

- [ ] **Step 4: `memory/payments_roadmap.md` — segnare sub-3 done**

Cambiare "3. **Sub-progetto 3 — Webhook handler (simulato).**" in "3. ✅ **Sub-progetto 3 — Webhook handler (simulato).** Done 2026-04-18." + aggiungere bullets dei deliverable.

- [ ] **Step 5: Commit**

```bash
git add .env.example CLAUDE.md memory/
git commit -m "docs(sub-3): document webhook processor + WithholdingAccrual

CLAUDE.md: nuova sezione 'Webhook handler (Sub-progetto 3)' con
architettura, endpoint, retry/DLQ, aggregation WithholdingAccrual,
flusso end-to-end.

memory/payments_architecture.md: stato aggiornato a sub-1+2+3 done.
memory/payments_roadmap.md: sub-3 segnato completato.
.env.example: STRIPE_WEBHOOK_SECRET=mock-secret documentato."
```

---

## Task 9: Final check + push

**Objective:** Verifica completa e push su origin.

- [ ] **Step 1: Smoke completi**

```bash
cd ~/progetti/TavoloPrivato
npm run smoke:payments 2>&1 | tail -3
npm run mcp:smoke 2>&1 | tail -3
npm run smoke:webhook 2>&1 | tail -5
```

Expected: 43/43, 5/5, 15+/15+.

- [ ] **Step 2: Prisma migrate status**

```bash
npx prisma migrate status 2>&1 | tail -5
```

Expected: "Database schema is up to date!"

- [ ] **Step 3: Working tree pulito**

```bash
git status
git log --oneline main..HEAD | head -15
```

Expected: working tree clean, ~8-10 commit nuovi.

- [ ] **Step 4: Push**

```bash
git push origin feat/compliance-mcp 2>&1 | tail -5
```

- [ ] **Step 5: Report finale**

Elencare tutti i commit del sub-3, i numeri smoke, il link alla PR (se da aprire). L'utente deciderà dopo se attaccare sub-2b, sub-6, o altro.

---

## Checklist di accettazione finale

- [ ] smoke:payments 43/43 ✓
- [ ] mcp:smoke 5/5 ✓
- [ ] smoke:webhook 15+/15+ ✓
- [ ] prisma migrate status pulito ✓
- [ ] POST /webhooks/stripe risponde 200 con {status:processed} per evento valido
- [ ] GET /admin/webhooks/stats ritorna counts corretti
- [ ] WithholdingAccrual creato correttamente dai 2 worker non-forfettari
- [ ] Retry cascade pending → failed → dead funziona a maxRetries=3
- [ ] Replay di evento processed → already_processed (idempotenza)
- [ ] CLAUDE.md + memory aggiornati
- [ ] Branch feat/compliance-mcp pushato su origin

## Remember

```
Handler idempotenti (wrapper skippa già processed).
Marketplace NON e sostituto: withholding.reported e audit, non cash.
Endpoint pubblico bypass auth, signature verifica la blocca in live.
Retry in-tabella (no queue esterna). Sequenziale (no Promise.all).
```
