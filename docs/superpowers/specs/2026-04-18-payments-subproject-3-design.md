# Spec — Payments Sub-project 3: Webhook Handler (Simulato)

Data: 2026-04-18
Autore: Claude + rossima (brainstorming)
Status: approvato, pronto per piano di implementazione

## Obiettivo

Dare al motore pagamenti un processore eventi asincrono: consuma `StripeEvent.status='pending'` → `processed` (o `failed`/`dead` in caso di errore con retry). Include event type `withholding.reported` introdotto in sub-2: l'handler aggrega la ritenuta in un nuovo model `WithholdingAccrual` che è la base operativa del sub-2c (report F24 al ristorante).

Lavora in modalità mock: nessun HTTP Stripe reale, solo endpoint admin per ri-processare in batch + endpoint `/webhooks/stripe` che accetta payload minimale e delega al processor. Preparazione per live: helper `verifySignature()` stub pronto ad attivarsi con `STRIPE_MODE=live`.

## Contesto

Stato dopo sub-1 + sub-2 (vedi `memory/payments_architecture.md`):

- `StripeEvent` è la tabella append-only che il mock `stripe-mock.js` alimenta per ogni side-effect. Ogni riga nasce con `status='pending'`. Non esiste ancora un consumer.
- Gli event type attualmente scritti:
  - `payment_intent.created`, `payment_intent.captured` (dal mock `paymentIntents.{create,capture}`)
  - `invoice.created`, `invoice.finalized`, `invoice.paid` (dal mock `invoices.*`)
  - `transfer.created` (dal mock `transfers.create`)
  - `account.created`, `customer.created` (dal mock `accounts.*`, `customers.*`)
  - **`withholding.reported`** (NUOVO sub-2 — virtuale, non-Stripe-native, con payload `{ invoiceId, workerProfileId, restaurantProfileId, amountEur, rate, taxRegime, sostitutoImposta: 'restaurant' }`)
- `server.js` ha `express.json()` a riga 128 e `/admin` gated a riga 169. Webhook pubblico richiede bypass auth perché (in produzione) Stripe chiama senza sessione utente.

## Scope

### In scope

- Nuovo model Prisma `WithholdingAccrual` + estensione `StripeEvent` con `retryCount` e `lastRetryAt`.
- Nuovo modulo `lib/webhook-processor.js` — registry `{ eventType: handler }`, funzione `processEvent(prisma, stripeEvent)` pura (no HTTP), funzione `processPending(prisma, { limit, maxRetries })` batch.
- Handler per i 3 event type "operativi":
  - `invoice.paid` — idempotent re-check Invoice.status=paid (già fatto dal payment-agent; qui audit/sync).
  - `payment_intent.captured` — idempotent re-check PaymentOrder.status=captured.
  - `withholding.reported` — **upsert `WithholdingAccrual`** aggregando per `(restaurantProfileId, workerProfileId, periodYear, periodMonth, taxRegimeSnapshot)`.
- Handler no-op registrati come processed (log + set status=processed, nessun side-effect) per: `payment_intent.created`, `invoice.created`, `invoice.finalized`, `transfer.created`, `account.created`, `customer.created`.
- Route HTTP:
  - `POST /webhooks/stripe` — pubblico (no auth). Accetta payload `{ providerEventId }` (o firma Stripe reale quando live) e processa il singolo evento.
  - `POST /admin/webhooks/process-pending` — admin role-gated. Processa in batch tutti i `pending` (con `limit` query param default 100).
  - `POST /admin/webhooks/retry-failed` — admin. Ri-processa tutti i `failed` con `retryCount < maxRetries`.
  - `GET /admin/webhooks/stats` — admin. Ritorna `{ pending, processed, failed, dead }` counts per diagnostica.
- Helper `lib/stripe-signature.js` — stub `verifySignature(rawBody, signatureHeader, secret)` che in mock torna sempre true, in live farà la vera verifica HMAC (lasciato come TODO per quando arriverà).
- Retry logic: su error nel handler, `status='failed'`, `retryCount++`, `error=msg`. A `retryCount >= maxRetries` (default 3), `status='dead'`.
- Smoke test `scripts/smoke-webhook.js` (nuovo) — verifica che il processor consumi correttamente gli eventi pending e produca WithholdingAccrual aggregati correttamente.

### Out of scope

- Scheduler periodico automatico (resta manuale/endpoint admin in sub-3; scheduler arriverà con infra reale live).
- Queue esterna (Redis/BullMQ/etc).
- Webhook di eventi Stripe non ancora emessi dal mock (es. `charge.refunded` → arriverà in sub-5).
- Firma HMAC reale (stub pronto, implementazione quando `STRIPE_MODE=live`).
- UI admin per ispezionare WithholdingAccrual — arriverà in sub-2c.
- Rate limiting + protezione DDOS sull'endpoint pubblico — quando si va live.
- Deduplicazione cross-retry (l'idempotenza degli handler garantisce che ri-processare un evento già processed sia safe).
- Export F24 vero (CSV/PDF) — sub-2c.

## Decisioni di design

### D1 — Processor sync in-process, niente queue

Express handler chiama `processEvent()` in modo sincrono. Niente Redis/BullMQ/worker separato. 

**Motivo**: il mock è single-process, i volumi sono bassi, il ciclo è già governato da `runMonthlyBillingCycle`. Aggiungere una queue sarebbe pura over-engineering. Quando si andrà live con volumi >>10 tx/s, si valuterà BullMQ in un sub dedicato.

### D2 — `WithholdingAccrual` aggregato per mese

Chiave logica: `(restaurantProfileId, workerProfileId, periodYear, periodMonth, taxRegimeSnapshot)`. Ogni evento `withholding.reported` che arriva → upsert: se chiave esiste, somma `totalAmountEur += amountEur` e incrementa `invoiceCount`. Se non esiste, crea.

**Motivo**: è la granularità naturale per F24 (versamento mensile entro il 16). Il snapshot regime è parte della chiave perché, se un worker cambiasse regime a metà mese, le due ritenute andrebbero in righe F24 diverse (prassi fiscale + coerenza CU).

**Alternativa scartata**: aggregazione per trimestre (troppo grossolana per F24 mensile); per-invoice (ridondante con Invoice stessa, perde il vantaggio aggregato).

**Campi**:
```prisma
model WithholdingAccrual {
  id                  Int       @id @default(autoincrement())
  restaurantProfileId Int
  workerProfileId     Int
  periodYear          Int       // YYYY basato su invoice.issuedAt
  periodMonth         Int       // 1-12
  taxRegimeSnapshot   String    // 'autonomo_occasionale' | 'partita_iva_ordinaria'
  totalAmountEur      Float     @default(0)
  invoiceCount        Int       @default(0)
  firstInvoiceAt      DateTime
  lastInvoiceAt       DateTime
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  restaurantProfile   RestaurantProfile @relation(fields: [restaurantProfileId], references: [id], onDelete: Cascade)
  workerProfile       WorkerProfile     @relation(fields: [workerProfileId], references: [id], onDelete: Cascade)

  @@unique([restaurantProfileId, workerProfileId, periodYear, periodMonth, taxRegimeSnapshot])
  @@index([restaurantProfileId, periodYear, periodMonth])
}
```

### D3 — Retry/DLQ in-tabella

Nessuna DLQ esterna. La stessa `StripeEvent` tiene tutto:
- `status='pending'` → mai processato.
- `status='processed'` → happy path, `processedAt` settato.
- `status='failed'` → errore, `retryCount>=1`, `error` popolato. Retry-able.
- `status='dead'` → `retryCount >= maxRetries`, richiede intervento manuale.

Estensione schema:
```prisma
model StripeEvent {
  // ... campi esistenti ...
  retryCount   Int       @default(0)
  lastRetryAt  DateTime?
}
```

**Motivo**: KISS, niente nuove tabelle, pattern standard single-writer (il mock è single-process).

### D4 — Idempotenza dell'handler

Ogni handler deve essere idempotente sugli effetti: ri-processare un evento già applicato NON deve generare duplicati.

- `withholding.reported` — l'upsert su `WithholdingAccrual` non è trivialmente idempotente (ogni replay sommerebbe di nuovo l'importo). Soluzione: prima di sommare, check `StripeEvent.status`. Se già processed, skip (no-op). Il controllo è già nel wrapper `processEvent`: se evento già processed, ritorna immediatamente senza chiamare handler. Quindi la replay-safety è garantita dal wrapper, non dal handler.
- `invoice.paid` / `payment_intent.captured` — handler è idempotent di natura: setta uno stato a un valore target, se era già quel valore è no-op.

**Motivo**: centralizzare l'idempotenza nel wrapper evita duplicazione di logica e previene bug.

### D5 — Endpoint pubblico `/webhooks/stripe` bypass auth

Il webhook pubblico va montato PRIMA del middleware di auth applicativa (`requireAuth`). Non è gated né in admin né in cameriere. In mock accetta tutti i payload. In live dovrà verificare la signature.

**Motivo**: Stripe reale chiama senza sessione utente, solo con `Stripe-Signature` header. L'equivalente mock è semplicemente "endpoint aperto".

**Rischi mitigazione**: endpoint aperto è pericoloso in produzione senza signature verification. Il mock `verifySignature()` accetta tutto MA solo se `STRIPE_MODE=mock`. In `live` se signature assente o invalida → 400 e niente processing. Questo previene abuso accidentale.

### D6 — Event parsing: `{ providerEventId }` unico contract

Il webhook mock accetta payload minimale: `{ providerEventId: 'evt_mock_...' }`. Carica l'evento dal DB (popolato dal mock al momento della `create`) e lo passa al processor. In live, Stripe invia l'evento completo in body — il processor lo parserebbe via `stripe.webhooks.constructEvent()`.

**Motivo**: in mock non serve "trasportare" l'evento nel payload webhook, è già sul DB. Semplicità totale, zero duplicazione.

### D7 — Event type registry estensibile

`lib/webhook-processor.js` esporta:
```javascript
const handlers = {
  'invoice.paid': handleInvoicePaid,
  'payment_intent.captured': handlePaymentIntentCaptured,
  'withholding.reported': handleWithholdingReported,
  // no-op handlers
  'payment_intent.created': noop,
  'invoice.created': noop,
  'invoice.finalized': noop,
  'transfer.created': noop,
  'account.created': noop,
  'customer.created': noop,
};
```

Eventi con tipo NON registrato → `status='failed'` con error `"unhandled event type: <type>"`. Dopo maxRetries → `dead` (sicurezza: così un event type nuovo non finisce silenziosamente nel vuoto).

**Motivo**: registry dichiarativo = unico posto dove leggere che eventi sappiamo gestire. Fallimento esplicito su tipi sconosciuti = non copertura sotto il tappeto.

### D8 — Process-pending in batch ma single-thread

`processPending(prisma, { limit, maxRetries })`:
- query `pending` + `failed` con `retryCount < maxRetries`, orderBy `receivedAt asc`, take `limit`.
- for-loop sync, un evento alla volta, nessun Promise.all parallelo.

**Motivo**: evitare race condition sull'aggregazione `WithholdingAccrual` quando più eventi dello stesso (ristorante, worker, mese) arrivano insieme. Il for sequenziale li serializza naturalmente. Per sub-3 il volume è piccolo, non c'è problema di throughput.

## API handler signatures

```javascript
// lib/webhook-processor.js

async function handleInvoicePaid(prisma, event) {
  const { id: invoiceProviderId } = event.payload;
  // Idempotent: se l'Invoice è già paid, no-op. Se non è paid (raro ma possibile
  // se il webhook arrivasse prima della cattura — non nel nostro mock),
  // aggiornala.
  const result = await prisma.invoice.updateMany({
    where: { providerInvoiceId: invoiceProviderId, invoiceStatus: { not: 'paid' } },
    data: { invoiceStatus: 'paid', paidAt: new Date() }
  });
  return { updated: result.count };
}

async function handlePaymentIntentCaptured(prisma, event) {
  const { id: piId } = event.payload;
  const result = await prisma.paymentOrder.updateMany({
    where: { providerPaymentIntentId: piId, status: { not: 'captured' } },
    data: { status: 'captured', capturedAt: new Date() }
  });
  return { updated: result.count };
}

async function handleWithholdingReported(prisma, event) {
  const { invoiceId, workerProfileId, restaurantProfileId, amountEur, taxRegime } = event.payload;
  if (amountEur <= 0) return { skipped: true, reason: 'zero_amount' };

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { issuedAt: true } });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  const issuedAt = invoice.issuedAt;
  const periodYear = issuedAt.getUTCFullYear();
  const periodMonth = issuedAt.getUTCMonth() + 1;

  // Upsert aggregato: somma se esiste, crea altrimenti.
  // Prisma upsert su composite unique con increment atomic.
  const existing = await prisma.withholdingAccrual.findUnique({
    where: {
      restaurantProfileId_workerProfileId_periodYear_periodMonth_taxRegimeSnapshot: {
        restaurantProfileId, workerProfileId, periodYear, periodMonth, taxRegimeSnapshot: taxRegime,
      }
    }
  });

  if (existing) {
    await prisma.withholdingAccrual.update({
      where: { id: existing.id },
      data: {
        totalAmountEur: { increment: amountEur },
        invoiceCount: { increment: 1 },
        lastInvoiceAt: issuedAt > existing.lastInvoiceAt ? issuedAt : existing.lastInvoiceAt,
      }
    });
    return { action: 'aggregated', accrualId: existing.id };
  } else {
    const created = await prisma.withholdingAccrual.create({
      data: {
        restaurantProfileId, workerProfileId, periodYear, periodMonth, taxRegimeSnapshot: taxRegime,
        totalAmountEur: amountEur, invoiceCount: 1,
        firstInvoiceAt: issuedAt, lastInvoiceAt: issuedAt,
      }
    });
    return { action: 'created', accrualId: created.id };
  }
}

async function processEvent(prisma, stripeEvent, { maxRetries = 3 } = {}) {
  // Idempotenza: se già processed, no-op.
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
    return { status: newStatus, error };
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
    const r = await processEvent(prisma, ev, { maxRetries });
    results.push(r);
  }
  return {
    total: events.length,
    processed: results.filter(r => r.status === 'processed').length,
    failed: results.filter(r => r.status === 'failed').length,
    dead: results.filter(r => r.status === 'dead').length,
    results,
  };
}

async function processPendingRetry(prisma, { limit = 100, maxRetries = 3 } = {}) {
  // Convenience: solo failed + retryCount < maxRetries.
  const events = await prisma.stripeEvent.findMany({
    where: { status: 'failed', retryCount: { lt: maxRetries } },
    orderBy: { lastRetryAt: 'asc' },
    take: limit,
  });
  const results = [];
  for (const ev of events) {
    const r = await processEvent(prisma, ev, { maxRetries });
    results.push(r);
  }
  return { total: events.length, results };
}

module.exports = {
  processEvent, processPending, processPendingRetry,
  handlers,
};
```

## Route HTTP

### `POST /webhooks/stripe` — public

```javascript
// File: routes/webhooks.js (nuovo)
const express = require('express');
const { getPrismaClient } = require('../lib/prisma');
const { processEvent } = require('../lib/webhook-processor');
const { verifySignature } = require('../lib/stripe-signature');

const router = express.Router();

router.post('/stripe', express.json({ limit: '1mb' }), async (req, res) => {
  const prisma = getPrismaClient();
  if (!prisma) return res.status(503).json({ error: 'prisma_unavailable' });

  // Signature verification (mock accepts all, live verifies HMAC).
  const sig = req.headers['stripe-signature'];
  const ok = verifySignature(req.rawBody || JSON.stringify(req.body), sig, process.env.STRIPE_WEBHOOK_SECRET || 'mock-secret');
  if (!ok) return res.status(400).json({ error: 'invalid_signature' });

  const providerEventId = req.body?.providerEventId || req.body?.id;
  if (!providerEventId) return res.status(400).json({ error: 'missing_providerEventId' });

  const event = await prisma.stripeEvent.findUnique({ where: { providerEventId } });
  if (!event) return res.status(404).json({ error: 'event_not_found' });

  const result = await processEvent(prisma, event);
  res.json(result);
});

module.exports = router;
```

Montato in `server.js` PRIMA di `requireAuth`.

### `POST /admin/webhooks/process-pending` — admin

In `routes/admin.js`, nuova route:

```javascript
router.post('/webhooks/process-pending', async (req, res) => {
  const limit = Math.min(1000, parseInt(req.query.limit || '100', 10));
  const result = await processPending(req.app.locals.prisma || getPrismaClient(), { limit });
  res.json(result);
});

router.post('/webhooks/retry-failed', async (req, res) => {
  const limit = Math.min(1000, parseInt(req.query.limit || '100', 10));
  const result = await processPendingRetry(req.app.locals.prisma || getPrismaClient(), { limit });
  res.json(result);
});

router.get('/webhooks/stats', async (req, res) => {
  const prisma = req.app.locals.prisma || getPrismaClient();
  const [pending, processed, failed, dead] = await Promise.all([
    prisma.stripeEvent.count({ where: { status: 'pending' } }),
    prisma.stripeEvent.count({ where: { status: 'processed' } }),
    prisma.stripeEvent.count({ where: { status: 'failed' } }),
    prisma.stripeEvent.count({ where: { status: 'dead' } }),
  ]);
  res.json({ pending, processed, failed, dead });
});
```

## Helper signature

```javascript
// lib/stripe-signature.js
function verifySignature(rawBody, signatureHeader, secret) {
  const mode = (process.env.STRIPE_MODE || 'mock').toLowerCase();
  if (mode !== 'live') return true;
  // TODO sub futuro: implementare verifica HMAC SHA-256 alla Stripe.
  // const elements = (signatureHeader || '').split(',');
  // const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
  // const signatures = elements.filter(e => e.startsWith('v1=')).map(e => e.slice(3));
  // const payload = `${timestamp}.${rawBody}`;
  // const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // return signatures.some(s => crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  throw new Error('stripe signature verification not yet implemented for live mode');
}

module.exports = { verifySignature };
```

## Smoke test

`scripts/smoke-webhook.js` (nuovo):

1. Setup: riusa il fixture contract + i 3 scenari del smoke-payments (forfettario/auth_occ/P.IVA) per popolare StripeEvent. O più semplicemente: chiama `runMonthlyBillingCycle` + `captureDuePaymentOrders` con 3 worker (taxMode diversi) per generare StripeEvent di vari tipi, incluso 2 `withholding.reported`.
2. Stat pre-process: conta pending (deve essere > 0).
3. Esegui `processPending(prisma)`.
4. Asserzioni:
   - Tutti i pending noti ora sono `processed` (conta pending === 0 dopo).
   - 2 `WithholdingAccrual` creati, uno per worker auth_occ e uno per P.IVA ord, entrambi con `totalAmountEur=200`, `invoiceCount=1`, `taxRegimeSnapshot` corretto.
   - Ri-eseguire `processPending` è no-op (tutti già processed).
5. Test retry/dead:
   - Iniettare un `StripeEvent` con eventType unknown (`test.unknown`). Forzare `processPending`.
   - Dopo 1 run: status=`failed`, retryCount=1.
   - Dopo altri `maxRetries-1` retry: status=`dead`, retryCount=maxRetries.
6. Test event specifico via endpoint-style: chiamare `processEvent(prisma, event)` per un evento `withholding.reported` già processato → ritorna `{ status: 'already_processed' }`.

Totale ~15 asserzioni aggiunte.

## Integrazione con server.js

- Montare `routes/webhooks.js` PRIMA di `requireAuth` (tipicamente subito dopo `express.json()`):
  ```javascript
  const webhooksRoutes = require('./routes/webhooks');
  app.use('/webhooks', webhooksRoutes);
  ```
- `/admin/webhooks/*` sono già sotto `requireAuth, requireRole('admin')`.
- `.env.example`: aggiungere `STRIPE_WEBHOOK_SECRET=mock-secret`.

## Validazione compliance MCP

Prima del commit finale, `npm run mcp:smoke` deve passare 5/5. Nessuna stringa user-facing in sub-3 (solo logica + endpoint JSON). Il messaggio `TaxModeUnknownError` non si può incontrare qui (si incontra nel payment-agent).

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Race condition sull'aggregazione WithholdingAccrual se 2 eventi stesso mese processati in parallelo | Process sequenziale (D8). Sub futuro: add `@@unique` constraint + retry su constraint violation. |
| Replay di un evento `withholding.reported` raddoppierebbe il totale | Wrapper `processEvent` skippa se `status='processed'` (D4). |
| Handler `handleWithholdingReported` fallisce se invoice deleted tra write StripeEvent e processing | Allerta con error descrittivo; retry; dopo maxRetries va in dead, intervento manuale. |
| Endpoint pubblico `/webhooks/stripe` abuso in produzione | In live, `verifySignature()` blocca tutto ciò che non ha firma valida. In mock non protetto ma solo dev. |
| Webhook secret hardcoded "mock-secret" | `.env.example` lo documenta. In deploy, env override obbligatoria. |
| Nuovi event type in futuro non registrati → dead silenziosi | Intenzionale: failure esplicita, `/admin/webhooks/stats` mostra il counter dead, admin investiga. |
| `processPending` con limit troppo grande in un unico request HTTP → timeout | limit cappato a 1000, orderBy receivedAt asc per iniziare dai più vecchi. Per volumi superiori, chiamare più volte. |

## Criteri di accettazione

1. `npx prisma migrate dev` applica migration additiva (WithholdingAccrual + estensione StripeEvent con retryCount/lastRetryAt) senza perdita dati.
2. `npm run smoke:payments` continua a passare 43/43 invariato.
3. `npm run mcp:smoke` 5/5 invariato.
4. `npm run smoke:webhook` (nuovo) esce 0 con 15+ check.
5. POST `/webhooks/stripe` con `{ providerEventId }` di un evento pending → 200 + `{ status: 'processed' }`.
6. POST `/admin/webhooks/process-pending` processa tutti i pending e ritorna counts.
7. `WithholdingAccrual` aggregato correttamente per i 2 worker non-forfettari dei fixture.
8. `CLAUDE.md` aggiornato con sezione "Webhook handler (Sub-progetto 3)".
9. `memory/payments_architecture.md` + `memory/payments_roadmap.md` aggiornati.

## Files

### Create

- `prisma/migrations/<ts>_withholding_accrual_and_event_retry/migration.sql`
- `lib/webhook-processor.js` (~180 LOC)
- `lib/stripe-signature.js` (~20 LOC)
- `routes/webhooks.js` (~35 LOC)
- `scripts/smoke-webhook.js` (~150 LOC)

### Modify

- `prisma/schema.prisma` — +1 model (WithholdingAccrual), estensione StripeEvent (retryCount/lastRetryAt), relation su WorkerProfile/RestaurantProfile.
- `routes/admin.js` — +3 route webhooks admin.
- `server.js` — mount `/webhooks` prima di requireAuth.
- `package.json` — +1 script `smoke:webhook`.
- `.env.example` — +STRIPE_WEBHOOK_SECRET=mock-secret.
- `CLAUDE.md` — nuova sezione.
- `memory/payments_architecture.md`, `memory/payments_roadmap.md`.

## Prossimi passi

1. Piano di implementazione in `docs/superpowers/plans/2026-04-18-payments-subproject-3.md` (bite-sized).
2. Esecuzione via subagent-driven-development.
3. Dopo merge: sub-2b (onboarding UI fiscale) o sub-6 (IVA 22%), scelta utente.
