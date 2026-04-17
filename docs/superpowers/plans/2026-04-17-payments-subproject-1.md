# Payments Sub-project 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a TavoloLibero il model `BankAccount` multi-IBAN per worker/ristorante, un mockup `lib/stripe-mock.js` API-compatibile col SDK Stripe, e il refactor di `lib/payment-agent.js` per usare il mock con idempotenza transazionale, CRUD UI, e smoke test end-to-end.

**Architecture:** Estensione additiva dello schema Prisma (nessun drop/rename). Factory `lib/stripe.js` sceglie mock vs live via `STRIPE_MODE` env. Il mock scrive `StripeEvent` in DB (consumato dal futuro webhook handler). Payment-agent wrapped in `prisma.$transaction` con idempotency key `milestone-<id>-<op>`. UI multi-IBAN con soft-archive, no DELETE fisico.

**Tech Stack:** Prisma/SQLite, Express/EJS, `@modelcontextprotocol/sdk` (già installato), zero nuove devDeps (IBAN validato inline).

**Spec di riferimento:** `docs/superpowers/specs/2026-04-17-payments-subproject-1-design.md`.

---

## File Structure

### Create

- `lib/iban.js` — validazione IBAN italiani (mod-97), ~40 LOC.
- `lib/stripe.js` — factory mock vs live, ~20 LOC.
- `lib/stripe-mock.js` — mockup SDK Stripe, ~250 LOC.
- `data/bank-account-service.js` — CRUD BankAccount con idempotenza primary flag, ~150 LOC.
- `views/pages/cameriere/bank-accounts.ejs` — lista + form cameriere.
- `views/pages/ristorante/bank-accounts.ejs` — lista + form ristorante (quasi identico).
- `scripts/smoke-payments.js` — smoke test end-to-end, ~200 LOC.
- `prisma/migrations/<ts>_bank_accounts_and_stripe_events/migration.sql` — migration Prisma.

### Modify

- `prisma/schema.prisma` — +2 model (BankAccount, StripeEvent) + 2 campi (stripeAccountId, stripeCustomerId).
- `lib/payment-agent.js` — swap placeholder con chiamate mock, `$transaction`, idempotency key.
- `routes/cameriere.js` — +4 route bank-accounts.
- `routes/ristorante.js` — +4 route bank-accounts.
- `package.json` — +1 script `smoke:payments`.
- `.env.example` (se esiste) — `STRIPE_MODE=mock`.
- `CLAUDE.md` — sezione breve su stripe factory.

### Test vehicle

Zero framework (coerente repo). Verifica via `scripts/smoke-payments.js` e `scripts/smoke-compliance.js` (già esistente, non deve rompersi).

---

## Task 1: Validazione IBAN — `lib/iban.js`

**Files:**
- Create: `lib/iban.js`

- [ ] **Step 1: Scrivere `lib/iban.js`**

```javascript
// Validazione IBAN italiani (IT + 2 check + 23 alfanumerici = 27 char).
// Algoritmo mod-97 standard ISO 13616. Niente libreria esterna.

const IBAN_IT_REGEX = /^IT\d{2}[A-Z0-9]{23}$/;

function normalizeIban(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, '').toUpperCase();
}

function mod97(str) {
  // Converti ogni lettera in due cifre (A=10, B=11, ..., Z=35) poi mod 97.
  let expanded = '';
  for (const ch of str) {
    if (ch >= '0' && ch <= '9') expanded += ch;
    else expanded += (ch.charCodeAt(0) - 55).toString();
  }
  // Mod 97 a blocchi per evitare overflow.
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    const chunk = String(remainder) + expanded.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder;
}

function isValidIban(input) {
  const iban = normalizeIban(input);
  if (!IBAN_IT_REGEX.test(iban)) return false;
  // Sposta i primi 4 char in coda e applica mod 97: deve dare 1.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  return mod97(rearranged) === 1;
}

module.exports = { normalizeIban, isValidIban };
```

- [ ] **Step 2: Verifica con IBAN test reali**

Run:
```bash
node -e "const {isValidIban} = require('./lib/iban'); console.log(isValidIban('IT60X0542811101000000123456'), isValidIban('IT00X0542811101000000123456'), isValidIban('IT60 X054 2811 1010 0000 0123 456'), isValidIban('NOPE'))"
```
Expected: `true false true false`

(Il primo è un IBAN italiano di test noto; il secondo ha check invalidi; il terzo è con spazi; il quarto è spazzatura.)

- [ ] **Step 3: Commit**

```bash
git add lib/iban.js
git commit -m "feat(iban): add IT IBAN validator (mod-97, no external dep)"
```

---

## Task 2: Schema Prisma — BankAccount + StripeEvent

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Leggere lo schema attuale e localizzare `WorkerProfile` e `RestaurantProfile`**

Run: `grep -n "^model WorkerProfile\|^model RestaurantProfile" prisma/schema.prisma`

- [ ] **Step 2: Aggiungere i due nuovi model alla fine di `prisma/schema.prisma`**

Appendere al file:

```prisma

model BankAccount {
  id                  String    @id @default(cuid())
  ownerType           String
  workerProfileId     String?
  restaurantProfileId String?
  iban                String
  bic                 String?
  holderName          String
  holderFiscalCode    String
  label               String?
  isPrimary           Boolean   @default(false)
  status              String    @default("active")
  verifiedAt          DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  workerProfile       WorkerProfile?     @relation(fields: [workerProfileId], references: [id])
  restaurantProfile   RestaurantProfile? @relation(fields: [restaurantProfileId], references: [id])

  @@unique([workerProfileId, iban])
  @@unique([restaurantProfileId, iban])
  @@index([isPrimary, workerProfileId])
  @@index([isPrimary, restaurantProfileId])
}

model StripeEvent {
  id              String    @id @default(cuid())
  providerEventId String    @unique
  eventType       String
  payload         Json
  receivedAt      DateTime  @default(now())
  processedAt     DateTime?
  status          String    @default("pending")
  error           String?

  @@index([status, receivedAt])
}
```

- [ ] **Step 3: Estendere `WorkerProfile` e `RestaurantProfile`**

Aggiungere nel blocco `model WorkerProfile` (prima della chiusura `}`):
```prisma
  stripeAccountId String?       @unique
  bankAccounts    BankAccount[]
```

Aggiungere nel blocco `model RestaurantProfile` (prima della chiusura `}`):
```prisma
  stripeCustomerId String?       @unique
  bankAccounts     BankAccount[]
```

- [ ] **Step 4: Validare schema**

Run: `npm run db:validate`
Expected: `The schema at prisma\schema.prisma is valid`

- [ ] **Step 5: Generare migration**

Run: `npx prisma migrate dev --name bank_accounts_and_stripe_events`
Expected: la migration viene applicata senza errori e `prisma generate` gira.

Se la CLI chiede conferma su drift o simile, rispondere no e investigare — la migration DEVE essere additiva.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add BankAccount and StripeEvent models + Stripe IDs on profiles"
```

---

## Task 3: Stripe mockup — `lib/stripe-mock.js`

**Files:**
- Create: `lib/stripe-mock.js`

- [ ] **Step 1: Scrivere `lib/stripe-mock.js`**

```javascript
// Mockup Stripe SDK: forma di risposta aderente al vero SDK.
// Scrive StripeEvent su DB per ogni chiamata side-effect.
// Idempotenza: Map<idempotencyKey, response> in-process + fallback DB.

const crypto = require('crypto');
const { getPrismaClient } = require('./prisma');

const idempotencyCache = new Map();

function mockId(prefix) {
  return `${prefix}_mock_${crypto.randomBytes(12).toString('hex')}`;
}

function nowIsoSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function writeEvent(eventType, payload) {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  const providerEventId = `evt_mock_${crypto.randomBytes(12).toString('hex')}`;
  await prisma.stripeEvent.create({
    data: { providerEventId, eventType, payload, status: 'pending' }
  });
  return providerEventId;
}

async function withIdempotency(options, factory) {
  const key = options && options.idempotencyKey;
  if (!key) return factory();
  if (idempotencyCache.has(key)) return idempotencyCache.get(key);
  const result = await factory();
  idempotencyCache.set(key, result);
  return result;
}

const paymentIntents = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('pi');
      const intent = {
        id,
        object: 'payment_intent',
        amount: params.amount,
        currency: params.currency || 'eur',
        status: 'requires_capture',
        application_fee_amount: params.application_fee_amount || 0,
        transfer_data: params.transfer_data || null,
        transfer_group: params.transfer_group || null,
        metadata: params.metadata || {},
        created: nowIsoSeconds()
      };
      await writeEvent('payment_intent.created', intent);
      return intent;
    });
  },
  async capture(id, options) {
    return withIdempotency(options, async () => {
      const intent = {
        id,
        object: 'payment_intent',
        status: 'succeeded',
        captured: true,
        captured_at: nowIsoSeconds()
      };
      await writeEvent('payment_intent.succeeded', intent);
      return intent;
    });
  },
  async retrieve(id) {
    return { id, object: 'payment_intent', status: 'succeeded' };
  }
};

const invoices = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('in');
      const invoice = {
        id,
        object: 'invoice',
        customer: params.customer || null,
        amount_due: params.amount_due || 0,
        currency: params.currency || 'eur',
        status: 'draft',
        due_date: params.due_date || null,
        metadata: params.metadata || {}
      };
      await writeEvent('invoice.created', invoice);
      return invoice;
    });
  },
  async finalizeInvoice(id, options) {
    return withIdempotency(options, async () => {
      const invoice = { id, object: 'invoice', status: 'open' };
      await writeEvent('invoice.finalized', invoice);
      return invoice;
    });
  },
  async pay(id, options) {
    return withIdempotency(options, async () => {
      const invoice = { id, object: 'invoice', status: 'paid', paid_at: nowIsoSeconds() };
      await writeEvent('invoice.paid', invoice);
      return invoice;
    });
  }
};

const transfers = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('tr');
      const transfer = {
        id,
        object: 'transfer',
        amount: params.amount,
        currency: params.currency || 'eur',
        destination: params.destination,
        transfer_group: params.transfer_group || null,
        metadata: params.metadata || {},
        created: nowIsoSeconds()
      };
      await writeEvent('transfer.created', transfer);
      return transfer;
    });
  }
};

const accounts = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('acct');
      const account = { id, object: 'account', type: params.type || 'express', country: params.country || 'IT' };
      await writeEvent('account.created', account);
      return account;
    });
  }
};

const customers = {
  async create(params, options) {
    return withIdempotency(options, async () => {
      const id = mockId('cus');
      const customer = { id, object: 'customer', email: params.email || null, name: params.name || null };
      await writeEvent('customer.created', customer);
      return customer;
    });
  }
};

function _resetForTests() {
  idempotencyCache.clear();
}

module.exports = { paymentIntents, invoices, transfers, accounts, customers, _resetForTests };
```

- [ ] **Step 2: Sanity check sintassi**

Run: `node -c lib/stripe-mock.js`
Expected: nessun output.

- [ ] **Step 3: Commit**

```bash
git add lib/stripe-mock.js
git commit -m "feat(stripe-mock): SDK-compatible mockup writing StripeEvent rows"
```

---

## Task 4: Factory Stripe — `lib/stripe.js`

**Files:**
- Create: `lib/stripe.js`

- [ ] **Step 1: Scrivere `lib/stripe.js`**

```javascript
// Factory: sceglie mock vs SDK Stripe reale via STRIPE_MODE env.
// Default 'mock' per sviluppo locale. 'live' richiede STRIPE_SECRET_KEY.

const mode = (process.env.STRIPE_MODE || 'mock').toLowerCase();

function loadStripe() {
  if (mode === 'live') {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_MODE=live ma STRIPE_SECRET_KEY mancante');
    }
    // Lazy require: il pacchetto 'stripe' non e' installato in mock mode.
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return require('./stripe-mock');
}

let instance = null;
function getStripe() {
  if (!instance) instance = loadStripe();
  return instance;
}

module.exports = { getStripe, mode };
```

- [ ] **Step 2: Verifica default mode**

Run: `node -e "const s = require('./lib/stripe'); console.log(s.mode, typeof s.getStripe().paymentIntents.create)"`
Expected: `mock function`

- [ ] **Step 3: Commit**

```bash
git add lib/stripe.js
git commit -m "feat(stripe): factory selecting mock vs live via STRIPE_MODE env"
```

---

## Task 5: BankAccount service — `data/bank-account-service.js`

**Files:**
- Create: `data/bank-account-service.js`

- [ ] **Step 1: Scrivere `data/bank-account-service.js`**

```javascript
// CRUD BankAccount con invariante "un solo primary per owner" mantenuto via transaction.
// Ownership polimorfico: workerProfileId OR restaurantProfileId, mai entrambi.

const { getPrismaClient } = require('../lib/prisma');
const { isValidIban, normalizeIban } = require('../lib/iban');

function prismaOrThrow() {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error('prisma_unavailable');
  return prisma;
}

function validateInput(input) {
  const errors = [];
  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) errors.push({ field: 'iban', message: 'IBAN non valido' });
  if (!input.holderName || input.holderName.length > 128) errors.push({ field: 'holderName', message: 'Nome intestatario richiesto (max 128 char)' });
  if (!/^[A-Z0-9]{16}$/.test((input.holderFiscalCode || '').toUpperCase())) errors.push({ field: 'holderFiscalCode', message: 'Codice fiscale non nel formato IT (16 char)' });
  if (input.label && input.label.length > 64) errors.push({ field: 'label', message: 'Etichetta max 64 char' });
  return { iban, errors };
}

function ownerFilter(ownerType, ownerId) {
  if (ownerType === 'worker') return { workerProfileId: ownerId };
  if (ownerType === 'restaurant') return { restaurantProfileId: ownerId };
  throw new Error(`ownerType non supportato: ${ownerType}`);
}

async function listForOwner(ownerType, ownerId) {
  const prisma = prismaOrThrow();
  return prisma.bankAccount.findMany({
    where: ownerFilter(ownerType, ownerId),
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
  });
}

async function createForOwner(ownerType, ownerId, input) {
  const prisma = prismaOrThrow();
  const { iban, errors } = validateInput(input);
  if (errors.length) return { ok: false, errors };

  const owner = ownerFilter(ownerType, ownerId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bankAccount.findMany({ where: { ...owner, status: 'active' } });
    const isFirst = existing.length === 0;
    const created = await tx.bankAccount.create({
      data: {
        ownerType,
        ...owner,
        iban,
        bic: input.bic || null,
        holderName: input.holderName,
        holderFiscalCode: input.holderFiscalCode.toUpperCase(),
        label: input.label || null,
        isPrimary: isFirst,
        status: 'active'
      }
    });
    return { ok: true, bankAccount: created };
  });
}

async function setPrimary(ownerType, ownerId, bankAccountId) {
  const prisma = prismaOrThrow();
  const owner = ownerFilter(ownerType, ownerId);
  return prisma.$transaction(async (tx) => {
    const target = await tx.bankAccount.findFirst({ where: { id: bankAccountId, ...owner } });
    if (!target) return { ok: false, error: 'not_found' };
    if (target.status !== 'active') return { ok: false, error: 'archived_cannot_be_primary' };
    await tx.bankAccount.updateMany({ where: { ...owner, isPrimary: true }, data: { isPrimary: false } });
    await tx.bankAccount.update({ where: { id: bankAccountId }, data: { isPrimary: true } });
    return { ok: true };
  });
}

async function archive(ownerType, ownerId, bankAccountId) {
  const prisma = prismaOrThrow();
  const owner = ownerFilter(ownerType, ownerId);
  const target = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, ...owner } });
  if (!target) return { ok: false, error: 'not_found' };
  if (target.isPrimary) return { ok: false, error: 'primary_cannot_archive' };
  await prisma.bankAccount.update({ where: { id: bankAccountId }, data: { status: 'archived', isPrimary: false } });
  return { ok: true };
}

async function getPrimary(ownerType, ownerId) {
  const prisma = prismaOrThrow();
  return prisma.bankAccount.findFirst({ where: { ...ownerFilter(ownerType, ownerId), isPrimary: true, status: 'active' } });
}

module.exports = { listForOwner, createForOwner, setPrimary, archive, getPrimary, validateInput };
```

- [ ] **Step 2: Sanity check**

Run: `node -c data/bank-account-service.js`
Expected: nessun output.

- [ ] **Step 3: Test veloce in repl**

Run:
```bash
node -e "const s = require('./data/bank-account-service'); console.log(s.validateInput({iban:'IT60X0542811101000000123456', holderName:'Mario Rossi', holderFiscalCode:'RSSMRA80A01H501U'}))"
```
Expected: `{ iban: 'IT60X0542811101000000123456', errors: [] }`

- [ ] **Step 4: Commit**

```bash
git add data/bank-account-service.js
git commit -m "feat(data): bank-account-service with transactional primary invariant"
```

---

## Task 6: Route cameriere — bank-accounts

**Files:**
- Modify: `routes/cameriere.js`

- [ ] **Step 1: Localizzare il router e la sezione in cui montare le route**

Run: `grep -n "router\." routes/cameriere.js | head -20`

Identificare il `router` exportato (di solito `const router = express.Router()`).

- [ ] **Step 2: Aggiungere in testa al file (dopo gli import esistenti)**

```javascript
const bankAccountService = require('../data/bank-account-service');
```

- [ ] **Step 3: Aggiungere 4 route bank-accounts**

Inserire prima della riga `module.exports = router;`:

```javascript
router.get('/bank-accounts', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  try {
    const bankAccounts = await bankAccountService.listForOwner('worker', workerProfileId);
    res.render('pages/cameriere/bank-accounts', { bankAccounts, formErrors: req.session.formErrors || null, formInput: req.session.formInput || {} });
    req.session.formErrors = null;
    req.session.formInput = null;
  } catch (err) {
    if (err.message === 'prisma_unavailable') return res.status(503).send('Database non disponibile');
    throw err;
  }
});

router.post('/bank-accounts', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  const result = await bankAccountService.createForOwner('worker', workerProfileId, req.body);
  if (!result.ok) {
    req.session.formErrors = result.errors;
    req.session.formInput = req.body;
  }
  res.redirect('/cameriere/bank-accounts');
});

router.post('/bank-accounts/:id/primary', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  await bankAccountService.setPrimary('worker', workerProfileId, req.params.id);
  res.redirect('/cameriere/bank-accounts');
});

router.post('/bank-accounts/:id/archive', async (req, res) => {
  const workerProfileId = res.locals.currentUser && res.locals.currentUser.workerProfile && res.locals.currentUser.workerProfile.id;
  if (!workerProfileId) return res.redirect('/');
  const result = await bankAccountService.archive('worker', workerProfileId, req.params.id);
  if (!result.ok) req.session.formErrors = [{ field: 'general', message: result.error }];
  res.redirect('/cameriere/bank-accounts');
});
```

- [ ] **Step 4: Sanity check**

Run: `node -c routes/cameriere.js`
Expected: nessun output.

- [ ] **Step 5: Commit**

```bash
git add routes/cameriere.js
git commit -m "feat(cameriere): bank-accounts CRUD routes"
```

---

## Task 7: View cameriere — `bank-accounts.ejs`

**Files:**
- Create: `views/pages/cameriere/bank-accounts.ejs`

- [ ] **Step 1: Esaminare un layout EJS esistente per il pattern**

Run: `ls views/pages/cameriere/`

Aprire uno di quei file per copiare il wrapping (es. come inizia e finisce con partials layout).

- [ ] **Step 2: Creare `views/pages/cameriere/bank-accounts.ejs`**

```ejs
<%- include('../../partials/header', { title: 'Conti bancari' }) %>

<main class="container">
  <h1>I miei conti</h1>
  <p>Gestisci gli IBAN su cui ricevere il compenso dei tuoi incarichi. Il conto contrassegnato come primario riceve i bonifici.</p>

  <% if (formErrors && formErrors.length) { %>
    <div class="alert alert-error">
      <ul>
        <% formErrors.forEach(function(e) { %>
          <li><%= e.field %>: <%= e.message %></li>
        <% }) %>
      </ul>
    </div>
  <% } %>

  <section>
    <h2>Conti registrati</h2>
    <% if (!bankAccounts.length) { %>
      <p>Nessun conto registrato. Aggiungine uno qui sotto.</p>
    <% } else { %>
      <table>
        <thead>
          <tr><th>IBAN</th><th>Intestatario</th><th>Etichetta</th><th>Stato</th><th>Azioni</th></tr>
        </thead>
        <tbody>
          <% bankAccounts.forEach(function(ba) { %>
            <tr>
              <td><code><%= ba.iban %></code></td>
              <td><%= ba.holderName %></td>
              <td><%= ba.label || '—' %></td>
              <td>
                <%= ba.status === 'archived' ? 'archiviato' : (ba.isPrimary ? 'primario' : 'attivo') %>
              </td>
              <td>
                <% if (ba.status === 'active' && !ba.isPrimary) { %>
                  <form method="post" action="/cameriere/bank-accounts/<%= ba.id %>/primary" style="display:inline">
                    <button type="submit">Rendi primario</button>
                  </form>
                  <form method="post" action="/cameriere/bank-accounts/<%= ba.id %>/archive" style="display:inline">
                    <button type="submit">Archivia</button>
                  </form>
                <% } %>
              </td>
            </tr>
          <% }) %>
        </tbody>
      </table>
    <% } %>
  </section>

  <section>
    <h2>Aggiungi un conto</h2>
    <form method="post" action="/cameriere/bank-accounts">
      <label>IBAN (IT)<br>
        <input type="text" name="iban" required value="<%= (formInput && formInput.iban) || '' %>" placeholder="IT60X0542811101000000123456">
      </label><br>
      <label>BIC/SWIFT (opzionale)<br>
        <input type="text" name="bic" value="<%= (formInput && formInput.bic) || '' %>">
      </label><br>
      <label>Intestatario<br>
        <input type="text" name="holderName" required maxlength="128" value="<%= (formInput && formInput.holderName) || '' %>">
      </label><br>
      <label>Codice fiscale intestatario<br>
        <input type="text" name="holderFiscalCode" required maxlength="16" pattern="[A-Za-z0-9]{16}" value="<%= (formInput && formInput.holderFiscalCode) || '' %>">
      </label><br>
      <label>Etichetta (opzionale)<br>
        <input type="text" name="label" maxlength="64" value="<%= (formInput && formInput.label) || '' %>">
      </label><br>
      <button type="submit">Aggiungi conto</button>
    </form>
  </section>
</main>

<%- include('../../partials/footer') %>
```

**Nota:** se `views/partials/header.ejs` / `footer.ejs` non esistono con questi nomi esatti, adattare al partial effettivamente presente (es. `layout.ejs`). Guardare un'altra view cameriere esistente.

- [ ] **Step 3: Commit**

```bash
git add views/pages/cameriere/bank-accounts.ejs
git commit -m "feat(views): bank-accounts page for cameriere"
```

---

## Task 8: Route + view ristorante

**Files:**
- Modify: `routes/ristorante.js`
- Create: `views/pages/ristorante/bank-accounts.ejs`

- [ ] **Step 1: Aggiungere le 4 route in `routes/ristorante.js`**

Sopra `module.exports = router;`, aggiungere (cambiando `worker` → `restaurant` e il path):

```javascript
const bankAccountService = require('../data/bank-account-service');

router.get('/bank-accounts', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  try {
    const bankAccounts = await bankAccountService.listForOwner('restaurant', restaurantProfileId);
    res.render('pages/ristorante/bank-accounts', { bankAccounts, formErrors: req.session.formErrors || null, formInput: req.session.formInput || {} });
    req.session.formErrors = null;
    req.session.formInput = null;
  } catch (err) {
    if (err.message === 'prisma_unavailable') return res.status(503).send('Database non disponibile');
    throw err;
  }
});

router.post('/bank-accounts', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  const result = await bankAccountService.createForOwner('restaurant', restaurantProfileId, req.body);
  if (!result.ok) {
    req.session.formErrors = result.errors;
    req.session.formInput = req.body;
  }
  res.redirect('/ristorante/bank-accounts');
});

router.post('/bank-accounts/:id/primary', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  await bankAccountService.setPrimary('restaurant', restaurantProfileId, req.params.id);
  res.redirect('/ristorante/bank-accounts');
});

router.post('/bank-accounts/:id/archive', async (req, res) => {
  const restaurantProfileId = res.locals.currentUser && res.locals.currentUser.restaurantProfile && res.locals.currentUser.restaurantProfile.id;
  if (!restaurantProfileId) return res.redirect('/');
  const result = await bankAccountService.archive('restaurant', restaurantProfileId, req.params.id);
  if (!result.ok) req.session.formErrors = [{ field: 'general', message: result.error }];
  res.redirect('/ristorante/bank-accounts');
});
```

Se `bankAccountService` è già richiesto in testa al file dall'edit, non duplicare l'import.

- [ ] **Step 2: Creare `views/pages/ristorante/bank-accounts.ejs`**

Stesso contenuto della view cameriere (Task 7, Step 2), ma sostituire:
- `h1`: "Conti del ristorante"
- Tutte le action form: `/cameriere/bank-accounts` → `/ristorante/bank-accounts`
- Copy: "ricevere il compenso" → "eseguire bonifici verso la piattaforma / ricevere eventuali accrediti"

- [ ] **Step 3: Sanity check e commit**

```bash
node -c routes/ristorante.js && git add routes/ristorante.js views/pages/ristorante/bank-accounts.ejs && git commit -m "feat(ristorante): bank-accounts CRUD + page"
```

---

## Task 9: Refactor `lib/payment-agent.js` per usare il mock

**Files:**
- Modify: `lib/payment-agent.js`

- [ ] **Step 1: Leggere `lib/payment-agent.js` e identificare `createBillingArtifactsForMilestone` e `captureDuePaymentOrders`**

Run: `grep -n "createBillingArtifactsForMilestone\|captureDuePaymentOrders\|pi_contract_\|in_demo_" lib/payment-agent.js`

- [ ] **Step 2: Aggiungere l'import della factory in testa al file**

Aggiungere dopo gli import esistenti (vicino a `const { getPrismaClient } = ...`):

```javascript
const { getStripe } = require('./stripe');
```

- [ ] **Step 3: Sostituire placeholder in `createBillingArtifactsForMilestone`**

Trovare il blocco che crea `PaymentOrder` con `providerPaymentIntentId: 'pi_contract_<id>'` (o simile) e `Invoice` con `providerInvoiceId: 'in_demo_<id>'`.

Sostituire l'intera funzione con questa versione (mantenere la signature e il comportamento di idempotenza su `contractMilestoneId`):

```javascript
async function createBillingArtifactsForMilestone(prisma, milestone, asOfDate) {
  const stripe = getStripe();
  const existing = await prisma.paymentOrder.findFirst({ where: { contractMilestoneId: milestone.id } });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const pi = await stripe.paymentIntents.create(
      {
        amount: Math.round(milestone.grossAmountEur * 100),
        currency: 'eur',
        application_fee_amount: Math.round(milestone.platformFeeEur * 100),
        transfer_group: `contract-${milestone.serviceContractId}`,
        metadata: { milestoneId: milestone.id, contractId: milestone.serviceContractId }
      },
      { idempotencyKey: `milestone-${milestone.id}-create` }
    );

    const inv = await stripe.invoices.create(
      {
        amount_due: Math.round(milestone.grossAmountEur * 100),
        currency: 'eur',
        due_date: milestone.dueDate ? Math.floor(new Date(milestone.dueDate).getTime() / 1000) : null,
        metadata: { milestoneId: milestone.id }
      },
      { idempotencyKey: `milestone-${milestone.id}-invoice` }
    );

    const order = await tx.paymentOrder.create({
      data: {
        serviceContractId: milestone.serviceContractId,
        contractMilestoneId: milestone.id,
        provider: 'stripe_connect',
        providerPaymentIntentId: pi.id,
        providerInvoiceId: inv.id,
        currency: 'EUR',
        amountTotalEur: milestone.grossAmountEur,
        platformFeeEur: milestone.platformFeeEur,
        payoutAmountEur: milestone.workerNetEur,
        status: 'created',
        scheduledCaptureAt: milestone.dueDate || asOfDate,
        dueDate: milestone.dueDate
      }
    });

    await tx.invoice.create({
      data: {
        paymentOrderId: order.id,
        serviceContractId: milestone.serviceContractId,
        contractMilestoneId: milestone.id,
        invoiceType: 'platform',
        providerInvoiceId: inv.id,
        invoiceStatus: 'open',
        amountEur: milestone.grossAmountEur,
        issuedAt: asOfDate,
        dueDate: milestone.dueDate
      }
    });

    await tx.contractMilestone.update({
      where: { id: milestone.id },
      data: { status: 'invoiced', providerInvoiceId: inv.id }
    });

    return order;
  });
}
```

- [ ] **Step 4: Sostituire placeholder in `captureDuePaymentOrders`**

Cercare la funzione e riscriverla (mantenendo signature e ritorno). Versione finale:

```javascript
async function captureDuePaymentOrders(prisma, options) {
  const stripe = getStripe();
  const now = (options && options.now) ? new Date(options.now) : new Date();

  const orders = await prisma.paymentOrder.findMany({
    where: { status: 'created', scheduledCaptureAt: { lte: now } },
    include: { contractMilestone: true }
  });

  const results = [];
  for (const order of orders) {
    const result = await prisma.$transaction(async (tx) => {
      await stripe.paymentIntents.capture(order.providerPaymentIntentId, { idempotencyKey: `milestone-${order.contractMilestoneId}-capture` });

      const worker = await tx.workerProfile.findFirst({
        where: { serviceContracts: { some: { id: order.serviceContractId } } }
      });

      if (worker && worker.stripeAccountId) {
        await stripe.transfers.create(
          {
            amount: Math.round(order.payoutAmountEur * 100),
            currency: 'eur',
            destination: worker.stripeAccountId,
            transfer_group: `contract-${order.serviceContractId}`,
            metadata: { milestoneId: order.contractMilestoneId }
          },
          { idempotencyKey: `milestone-${order.contractMilestoneId}-transfer` }
        );
      }

      if (order.providerInvoiceId) {
        await stripe.invoices.pay(order.providerInvoiceId, { idempotencyKey: `milestone-${order.contractMilestoneId}-pay` });
      }

      await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'captured', capturedAt: now } });

      await tx.payout.upsert({
        where: { paymentOrderId: order.id },
        create: {
          paymentOrderId: order.id,
          workerProfileId: worker ? worker.id : null,
          payoutAmountEur: order.payoutAmountEur,
          status: 'released',
          releasedAt: now
        },
        update: { status: 'released', releasedAt: now }
      });

      await tx.invoice.updateMany({ where: { paymentOrderId: order.id }, data: { invoiceStatus: 'paid', paidAt: now } });
      await tx.contractMilestone.update({ where: { id: order.contractMilestoneId }, data: { status: 'paid' } });

      await tx.escrowLedger.createMany({
        data: [
          { paymentOrderId: order.id, entryType: 'capture', amountEur: order.amountTotalEur, metadata: {} },
          { paymentOrderId: order.id, entryType: 'platform_fee', amountEur: order.platformFeeEur, metadata: {} },
          { paymentOrderId: order.id, entryType: 'worker_payout', amountEur: order.payoutAmountEur, metadata: {} }
        ]
      });

      return order.id;
    });
    results.push(result);
  }
  return results;
}
```

**Nota:** se la signature della funzione `Payout.workerProfileId` è NOT NULL nello schema, e `worker` può essere null, gestire il caso (skip il record o loggare). Controllare col `grep "model Payout" prisma/schema.prisma`.

- [ ] **Step 5: Verifica che non restino placeholder**

Run: `grep -n "pi_contract_\|in_demo_" lib/payment-agent.js`
Expected: nessun risultato.

- [ ] **Step 6: Sanity check**

Run: `node -c lib/payment-agent.js`
Expected: nessun output.

- [ ] **Step 7: Commit**

```bash
git add lib/payment-agent.js
git commit -m "refactor(payment-agent): use Stripe mock via factory with idempotent transactions"
```

---

## Task 10: Smoke test — `scripts/smoke-payments.js`

**Files:**
- Create: `scripts/smoke-payments.js`
- Modify: `package.json`

- [ ] **Step 1: Aggiungere lo script in `package.json`**

Aggiungere nel blocco `"scripts"`:

```json
"smoke:payments": "node scripts/smoke-payments.js"
```

- [ ] **Step 2: Creare `scripts/smoke-payments.js`**

```javascript
#!/usr/bin/env node
// Smoke payments end-to-end: seed fixture → billing cycle → capture → asserzioni.
// Zero framework. Exit 0 se tutto passa, 1 se fallisce, 2 se Prisma non disponibile.

require('dotenv').config();

const { getPrismaClient } = require('../lib/prisma');
const { getStripe } = require('../lib/stripe');
const bankAccountService = require('../data/bank-account-service');
const {
  runMonthlyBillingCycle,
  captureDuePaymentOrders
} = require('../lib/payment-agent');

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '\u2713' : '\u2717'} ${name}${detail ? ' -- ' + detail : ''}`);
}

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) {
    console.error('prisma_unavailable: configurare DATABASE_URL + npx prisma generate');
    process.exit(2);
  }

  // 1) Trovare un contratto long_term esistente, altrimenti fallire con messaggio chiaro.
  const contract = await prisma.serviceContract.findFirst({
    where: { contractType: 'long_term' },
    include: { workerProfile: true, restaurantProfile: true, milestones: true }
  });
  if (!contract) {
    console.error('Nessun ServiceContract long_term trovato. Eseguire: npm run db:seed');
    process.exit(1);
  }
  record('fixture: trovato contratto long_term', true, `id=${contract.id}`);

  const stripe = getStripe();

  // 2) Assicurare stripeAccountId su worker e stripeCustomerId su restaurant.
  if (!contract.workerProfile.stripeAccountId) {
    const acct = await stripe.accounts.create({ type: 'express', country: 'IT' });
    await prisma.workerProfile.update({ where: { id: contract.workerProfile.id }, data: { stripeAccountId: acct.id } });
    contract.workerProfile.stripeAccountId = acct.id;
  }
  record('worker: stripeAccountId presente', !!contract.workerProfile.stripeAccountId, contract.workerProfile.stripeAccountId);

  if (!contract.restaurantProfile.stripeCustomerId) {
    const cus = await stripe.customers.create({ name: contract.restaurantProfile.displayName || 'Ristorante' });
    await prisma.restaurantProfile.update({ where: { id: contract.restaurantProfile.id }, data: { stripeCustomerId: cus.id } });
    contract.restaurantProfile.stripeCustomerId = cus.id;
  }
  record('restaurant: stripeCustomerId presente', !!contract.restaurantProfile.stripeCustomerId, contract.restaurantProfile.stripeCustomerId);

  // 3) Assicurare un BankAccount primary per il worker.
  let primary = await bankAccountService.getPrimary('worker', contract.workerProfile.id);
  if (!primary) {
    const created = await bankAccountService.createForOwner('worker', contract.workerProfile.id, {
      iban: 'IT60X0542811101000000123456',
      holderName: contract.workerProfile.displayName || 'Worker Test',
      holderFiscalCode: 'RSSMRA80A01H501U'
    });
    if (!created.ok) {
      console.error('createForOwner fallita', created.errors);
      process.exit(1);
    }
    primary = created.bankAccount;
  }
  record('worker: primary bank account presente', !!primary, primary && primary.iban);

  // 4) Run billing cycle in modo che almeno la prima milestone sia dovuta.
  const firstMilestone = contract.milestones.sort((a, b) => a.sequence - b.sequence)[0];
  if (!firstMilestone) {
    console.error('Contratto senza milestone: eseguire seed completo');
    process.exit(1);
  }
  const asOf = new Date(firstMilestone.invoiceDate);
  await runMonthlyBillingCycle(prisma, { asOfDate: asOf });
  record('billing cycle eseguito', true, `asOf=${asOf.toISOString().slice(0, 10)}`);

  const order = await prisma.paymentOrder.findFirst({ where: { contractMilestoneId: firstMilestone.id } });
  record('PaymentOrder creato', !!order, order && `status=${order.status} pi=${order.providerPaymentIntentId}`);
  record('PaymentOrder ha ID Stripe mock', !!(order && order.providerPaymentIntentId && order.providerPaymentIntentId.startsWith('pi_mock_')), order && order.providerPaymentIntentId);

  // 5) Capture.
  const captureAt = new Date(firstMilestone.dueDate || firstMilestone.invoiceDate);
  captureAt.setDate(captureAt.getDate() + 1);
  await captureDuePaymentOrders(prisma, { now: captureAt });
  record('capture eseguito', true, `now=${captureAt.toISOString().slice(0, 10)}`);

  const orderAfter = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
  record('PaymentOrder.status === captured', orderAfter && orderAfter.status === 'captured', orderAfter && orderAfter.status);

  const invoice = await prisma.invoice.findFirst({ where: { paymentOrderId: order.id } });
  record('Invoice.invoiceStatus === paid', invoice && invoice.invoiceStatus === 'paid', invoice && invoice.invoiceStatus);

  const payout = await prisma.payout.findFirst({ where: { paymentOrderId: order.id } });
  record('Payout.status === released', payout && payout.status === 'released', payout && payout.status);

  const milestoneAfter = await prisma.contractMilestone.findUnique({ where: { id: firstMilestone.id } });
  record('ContractMilestone.status === paid', milestoneAfter && milestoneAfter.status === 'paid', milestoneAfter && milestoneAfter.status);

  const ledger = await prisma.escrowLedger.count({ where: { paymentOrderId: order.id } });
  record('EscrowLedger ha 3 voci', ledger === 3, `count=${ledger}`);

  const events = await prisma.stripeEvent.count();
  record('StripeEvent count >= 5', events >= 5, `count=${events}`);

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passati`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Eseguire lo smoke**

Run: `npm run smoke:payments`

Expected: tutti e 12 i check passano. Exit 0.

Se fallisce per "Nessun ServiceContract long_term trovato": prima `npm run db:seed`, poi ripetere.

Se fallisce per errori di tipo su `Payout.workerProfileId` NOT NULL: aggiornare Task 9 Step 4 (skip upsert Payout se worker non trovato) e ri-eseguire.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-payments.js package.json
git commit -m "test(payments): end-to-end smoke test for BankAccount + mock billing"
```

---

## Task 11: Documentazione — `.env.example` + `CLAUDE.md`

**Files:**
- Modify: `.env.example` (create se manca)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Controllare se `.env.example` esiste**

Run: `ls .env.example 2>/dev/null && echo exists || echo missing`

- [ ] **Step 2: Se non esiste, creare `.env.example` minimale**

```bash
DATABASE_URL="file:./dev.db"
PORT=3000
STRIPE_MODE=mock
# STRIPE_SECRET_KEY=sk_live_xxx   # richiesto solo se STRIPE_MODE=live
```

Se esiste, aggiungere solo le righe `STRIPE_MODE` e il commento `STRIPE_SECRET_KEY`.

- [ ] **Step 3: Aggiornare `CLAUDE.md`**

Localizzare la sezione `## MCP tools disponibili` e subito DOPO aggiungere:

```markdown
## Pagamenti: Stripe mock vs live

La factory `lib/stripe.js` sceglie l'implementazione via env var:

- `STRIPE_MODE=mock` (default): usa `lib/stripe-mock.js`, nessuna chiamata esterna, scrive `StripeEvent` su DB.
- `STRIPE_MODE=live`: richiede `STRIPE_SECRET_KEY` e il pacchetto `stripe` installato.

Il mock espone la stessa shape del vero SDK per: `paymentIntents.{create,capture,retrieve}`, `invoices.{create,finalizeInvoice,pay}`, `transfers.create`, `accounts.create`, `customers.create`. Ogni chiamata con side-effect scrive una riga `StripeEvent` con `status=pending` (consumata dal futuro webhook handler).

I BankAccount sono multi-IBAN per worker/ristorante (model `BankAccount`), con `isPrimary` enforced in transazione dal service `data/bank-account-service.js`. Archiviazione = soft-delete (`status='archived'`), niente DELETE fisico per integrità fiscale retroattiva.

Smoke: `npm run smoke:payments`.
```

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs(payments): document STRIPE_MODE factory and BankAccount model"
```

---

## Task 12: Aggiornare memory bank

**Files:**
- Modify: `memory/project_state.md`
- Create: `memory/payments_architecture.md`
- Modify: `memory/MEMORY.md`

- [ ] **Step 1: Aggiornare `memory/project_state.md`**

Nella sezione "Mancante (gap critici per MVP compliant)" rimuovere:
- "BankAccount/IBAN model: necessario per payout worker e split payment reale" → spostare a "Fatto"
- "Stripe webhook handler: assente" → lasciare con nota "base persistita (StripeEvent), handler arriverà nel Sub-progetto 3"

Aggiungere nella sezione "Fatto (maturo)":
```
- BankAccount multi-IBAN per worker/ristorante con holder fiscale (DAC7-ready).
- Stripe mockup SDK-compatible (lib/stripe-mock.js), factory selettiva via STRIPE_MODE (lib/stripe.js).
- StripeEvent persistito append-only per tutti i side-effect del mock.
- payment-agent.js refactored: prisma.$transaction + idempotency key per milestone.
```

- [ ] **Step 2: Creare `memory/payments_architecture.md`**

```markdown
---
name: Architettura pagamenti TavoloLibero
description: Come funziona il flusso soldi oggi (Sub-progetto 1 completato), cosa manca, estensioni programmate
type: project
---

**Stato al 2026-04-17 (Sub-progetto 1 done):**

Il flusso pagamenti è mockabile end-to-end ma non chiama Stripe reale. Base pronta per DAC7, ritenuta d'acconto, webhook handler.

**Punti chiave:**

- **Factory**: `lib/stripe.js` — `STRIPE_MODE=mock|live`, default mock. Importare sempre da qui, mai direttamente da `stripe-mock.js` o `stripe`.
- **Mock**: `lib/stripe-mock.js` — SDK-compatible, scrive `StripeEvent` su DB per ogni operazione.
- **BankAccount**: multi-IBAN per owner (worker/restaurant), `isPrimary` uno solo per owner mantenuto in transaction. Soft-delete via `status='archived'`, niente DELETE fisico.
- **Payment-agent**: `prisma.$transaction` su `createBillingArtifactsForMilestone` e `captureDuePaymentOrders`. Idempotency key format `milestone-<id>-<op>`.
- **StripeEvent**: tabella append-only, `status=pending` alla scrittura. Il webhook handler del Sub-progetto 3 la consumerà.

**Cosa NON c'è ancora:**

- Ritenuta d'acconto 20% per autonomo_occasionale (Sub-progetto 2).
- IVA 22% per non-forfettari (Sub-progetto 2).
- Webhook handler che consuma `StripeEvent.status=pending` → `processed` (Sub-progetto 3).
- `reportable` flag su Invoice per DAC7 (Sub-progetto 4).
- Refund flow completo (Sub-progetto 5).

**How to apply:** quando tocchi codice payment, importa da `lib/stripe`. Mai da `stripe-mock` direttamente. Se aggiungi un'operazione Stripe nuova al payment-agent, verifica che il mock la supporti — altrimenti estendi `lib/stripe-mock.js` mantenendo la shape SDK ufficiale.
```

- [ ] **Step 3: Aggiungere la riga in `memory/MEMORY.md`**

Inserire in coda:
```
- [Architettura pagamenti](payments_architecture.md) — Stripe mock factory, BankAccount multi-IBAN, idempotenza transazionale
```

- [ ] **Step 4: Commit**

```bash
git add memory/
git commit -m "docs(memory): record payments sub-project 1 architecture"
```

---

## Verifica finale

- [ ] **Smoke test completo**

Run: `npm run smoke:payments`
Expected: `12/12 passati`, exit 0.

- [ ] **Smoke compliance non regredisce**

Run: `npm run mcp:smoke`
Expected: `5/5 passati`, exit 0.

- [ ] **Server si avvia**

Run: `npm run dev`
Expected: `TavoloLibero running at http://localhost:3000`. Ctrl+C dopo conferma.

- [ ] **Grep: nessun placeholder residuo**

Run: `grep -rn "pi_contract_\|in_demo_" lib/ data/ routes/`
Expected: zero risultati.

- [ ] **Grep: nessun import diretto del mock fuori dalla factory**

Run: `grep -rn "require.*stripe-mock" lib/ data/ routes/ scripts/ | grep -v "lib/stripe.js"`
Expected: zero risultati (tranne eventualmente `_resetForTests` in smoke, vedi caso).
