# Spec — Payments Sub-project 1: BankAccount + Stripe Mockup

Data: 2026-04-17
Autore: Claude + rossima (brainstorming)
Status: approvato, pronto per piano di implementazione

## Obiettivo

Dare a TavoloLibero la base operativa della parte "soldi che si muovono" senza ancora integrare Stripe reale:

1. Un model `BankAccount` multi-IBAN per worker e ristorante (con holder fiscale per DAC7).
2. Un mockup `lib/stripe-mock.js` API-compatibile col SDK Stripe ufficiale, abilitato via env var.
3. Refactor di `lib/payment-agent.js` per usare il mock invece di placeholder hardcoded, con idempotenza transazionale.
4. CRUD conti bancari dalla UI cameriere/ristorante.
5. Smoke test che verifica il ciclo fatturazione end-to-end.

Questo sblocca i sotto-progetti successivi (ritenuta d'acconto, webhook handler, DAC7, split payment completo) senza dover riscrivere la base.

## Contesto

Stato attuale (vedi `memory/project_state.md`):

- `lib/payment-agent.js` costruisce il payload Stripe Connect ma non chiama nessun SDK: `providerPaymentIntentId` e `providerInvoiceId` sono stringhe placeholder (`pi_contract_...`, `in_demo_...`).
- Schema Prisma ha già `PaymentOrder`, `Payout`, `Invoice`, `EscrowLedger`, `ContractMilestone` ben strutturati. **Non servono riscritture**, solo estensioni.
- Manca ogni campo per trasportare IBAN/codice fiscale del prestatore → blocca DAC7 e payout reale.
- Manca idempotenza transazionale (`prisma.$transaction`) su creazione artefatti billing.
- Nessun endpoint webhook: tutti i `status` sono aggiornati dal codice app, non da eventi provider.

## Scope

### In scope

- Schema: `BankAccount`, `StripeEvent`, `WorkerProfile.stripeAccountId`, `RestaurantProfile.stripeCustomerId`.
- Mockup `lib/stripe-mock.js` per le sole operazioni usate da `payment-agent.js`: `paymentIntents.{create, capture, retrieve}`, `invoices.{create, finalizeInvoice, pay}`, `transfers.create`, `accounts.create`, `customers.create`.
- Factory `lib/stripe.js` che sceglie mock vs reale via `STRIPE_MODE` (default `mock`).
- Refactor minimo di `payment-agent.js`: wrap transaction, idempotency key, chiamate mock al posto di placeholder.
- Validazione IBAN: `lib/iban.js`, algoritmo mod-97, solo IT, nessuna libreria esterna.
- Route CRUD BankAccount per cameriere e ristorante; view EJS nei pattern esistenti.
- `scripts/smoke-payments.js` coerente con `scripts/smoke-compliance.js` (zero framework).

### Out of scope (altri sotto-progetti)

- Ritenuta d'acconto 20% e IVA 22% (Sub-progetto 2).
- Webhook handler effettivo e processing `StripeEvent` (Sub-progetto 3) — in questo sotto-progetto gli eventi vengono solo **scritti**, non consumati.
- DAC7 `reportable` flag e export (Sub-progetto 4).
- Riconciliazione Payout e refund flow completo (Sub-progetto 5).

## Decisioni di design

### D1 — Multi-IBAN per owner, con isPrimary

Un worker ha N `BankAccount`, uno solo `isPrimary=true`. Il payout va sempre al primary. Cambiare primary genera una voce `AuditLog`. I conti archiviati (`status='archived'`) non possono essere primary ma restano visibili per tracciabilità delle fatture passate.

**Motivo:** l'utente ha richiesto esplicitamente supporto multi-conto. Il flag `isPrimary` è KISS (niente "bank account preference" separato) e già pattern noto.

### D2 — `StripeEvent` persistito da subito

Ogni chiamata al mock scrive una riga `StripeEvent` con `status='pending'`. In questo sotto-progetto **nessuno la consuma**: serve come log append-only e come base per il webhook handler del Sub-progetto 3.

**Motivo:** l'alternativa (in-memory, aggiungere DB dopo) costringerebbe a rewrite quando arriva il webhook handler. Il costo extra ora è una migration e ~20 righe di codice.

### D3 — Factory `lib/stripe.js` con `STRIPE_MODE`

Il codice applicativo importa sempre `require('./lib/stripe')`, mai direttamente `stripe-mock`. La factory sceglie l'implementazione.

**Motivo:** swap mock↔live è una variabile env, non una modifica codice. Riduce il rischio di lasciare riferimenti al mock in produzione.

### D4 — Idempotency key strutturato

Format: `milestone-<milestoneId>-<operation>` (es. `milestone-abc123-capture`). Il mock mantiene `Map<key, response>` in-process + check DB via `StripeEvent.providerEventId`.

**Motivo:** rispecchia il pattern ufficiale Stripe (idempotency-key header) e rende testabile la rigenerazione di risposte identiche.

### D5 — Archiviazione vs eliminazione BankAccount

Niente DELETE fisico: `status='archived'`. Le `Invoice` e `Payout` passate devono restare legate al conto su cui il bonifico è stato eseguito.

**Motivo:** integrità fiscale (Agenzia Entrate richiede tracciabilità retroattiva) + pattern già usato dal repo per altri soft-delete.

### D6 — Validazione IBAN inline

`lib/iban.js` (~30 LOC): check country `IT`, lunghezza 27, mod-97. Niente libreria esterna.

**Motivo:** KISS + riduzione supply chain. Se servirà supporto multi-country (SEPA esteso) in futuro, si valuta `iban` npm package.

## Schema dettagliato

### `BankAccount` (nuovo)

```prisma
model BankAccount {
  id                  String    @id @default(cuid())
  ownerType           String    // 'worker' | 'restaurant'
  workerProfileId     String?
  restaurantProfileId String?
  iban                String
  bic                 String?
  holderName          String
  holderFiscalCode    String    // codice fiscale, per DAC7
  label               String?   // es. "Conto personale"
  isPrimary           Boolean   @default(false)
  status              String    @default("active") // 'active' | 'archived'
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
```

Invariante: un solo `isPrimary=true` per `workerProfileId` o `restaurantProfileId` (enforced in codice, non DB — Prisma/SQLite non supporta unique condizionali portabili).

### `StripeEvent` (nuovo)

```prisma
model StripeEvent {
  id              String    @id @default(cuid())
  providerEventId String    @unique // idempotenza
  eventType       String    // 'payment_intent.succeeded', ...
  payload         Json
  receivedAt      DateTime  @default(now())
  processedAt     DateTime?
  status          String    @default("pending") // 'pending' | 'processed' | 'failed'
  error           String?

  @@index([status, receivedAt])
}
```

### Estensioni

```prisma
model WorkerProfile {
  // ... campi esistenti
  stripeAccountId String?       @unique
  bankAccounts    BankAccount[]
}

model RestaurantProfile {
  // ... campi esistenti
  stripeCustomerId String?      @unique
  bankAccounts     BankAccount[]
}
```

## API Mockup Stripe

`lib/stripe-mock.js` espone questo shape (subset di `stripe` SDK):

```javascript
module.exports = {
  paymentIntents: {
    create(params, options),   // { idempotencyKey } in options
    capture(id, options),
    retrieve(id),
  },
  invoices: {
    create(params, options),
    finalizeInvoice(id, options),
    pay(id, options),
  },
  transfers: {
    create(params, options),
  },
  accounts: {
    create(params, options),   // ritorna { id: 'acct_mock_...' }
  },
  customers: {
    create(params, options),   // ritorna { id: 'cus_mock_...' }
  },
};
```

Comportamento:

- Ogni metodo è **asincrono** (come il vero SDK) e ritorna un oggetto forma-Stripe (es. PaymentIntent ha `id, amount, status, charges, ...`).
- ID generati: prefisso deterministico + cuid, es. `pi_mock_<cuid>`.
- Idempotency: se `options.idempotencyKey` già visto, ritorna risposta precedente (stesso oggetto).
- Ogni chiamata con effetto side-effect scrive `StripeEvent(status='pending', providerEventId=<evt_mock_...>)`.
- Nessun timer/setTimeout: transizioni di stato sono immediate (cattura immediata, paga immediata) salvo quando il payment-agent esplicitamente simula un ritardo (`scheduledCaptureAt`).

## Flusso integrato (payment-agent)

```
runMonthlyBillingCycle
  └─ per ogni ContractMilestone con status=planned e invoiceDate <= today:
      prisma.$transaction([
        createBillingArtifactsForMilestone:
          stripe.paymentIntents.create({ idempotencyKey: 'milestone-<id>-create' })
            → PaymentOrder(providerPaymentIntentId=pi_mock_...)
          stripe.invoices.create({ idempotencyKey: 'milestone-<id>-invoice' })
            → Invoice(providerInvoiceId=in_mock_...)
          ContractMilestone.status = 'invoiced'
      ])

captureDuePaymentOrders
  └─ per ogni PaymentOrder con status=created e scheduledCaptureAt <= now:
      prisma.$transaction([
        stripe.paymentIntents.capture(providerPaymentIntentId, { idempotencyKey: 'milestone-<id>-capture' })
        stripe.transfers.create({ destination: worker.stripeAccountId, idempotencyKey: 'milestone-<id>-transfer' })
        stripe.invoices.pay(providerInvoiceId)
        PaymentOrder.status = 'captured'
        Payout.status = 'released'
        Invoice.status = 'paid'
        ContractMilestone.status = 'paid'
        EscrowLedger.createMany(3 entries: capture, platform_fee, worker_payout)
      ])
```

Tutte le operazioni che non sono atomicamente idempotenti (transfer, pay) hanno idempotencyKey: retry safe.

## Route UI

### Cameriere

- `GET /cameriere/bank-accounts` — lista + form aggiunta
- `POST /cameriere/bank-accounts` — crea (campi: iban, bic?, holderName, holderFiscalCode, label?)
- `POST /cameriere/bank-accounts/:id/primary` — set primary (demote altri in transazione)
- `POST /cameriere/bank-accounts/:id/archive` — soft delete; se era primary → errore 400 con messaggio "prima promuovi un altro conto"

### Ristorante

Identiche, sotto `/ristorante/bank-accounts`.

### Validazione

Server-side:
- `iban`: `/^IT\d{2}[A-Z0-9]{23}$/` + mod-97 check (funzione `isValidIban` in `lib/iban.js`)
- `holderFiscalCode`: `/^[A-Z0-9]{16}$/` (no check completo, solo forma)
- `holderName`: non vuoto, max 128 char
- `label`: optional, max 64 char

Errori ritornati al form con il partial `views/partials/form-error.ejs` se esiste, altrimenti flash message via session.

## Smoke test

`scripts/smoke-payments.js`:

1. Controlla Prisma disponibile; se no, `exit 2` con messaggio (coerente con smoke-compliance).
2. Usa fixture seed esistenti (worker + restaurant + contratto long_term).
3. Crea un `BankAccount` primary per il worker se non esiste.
4. Assicura `WorkerProfile.stripeAccountId` e `RestaurantProfile.stripeCustomerId` via `stripe.accounts.create` / `customers.create`.
5. Chiama `runMonthlyBillingCycle({ asOfDate })` con una data che rende la prima milestone dovuta.
6. Chiama `captureDuePaymentOrders({ now })` con data > dueDate.
7. Asserzioni:
   - `PaymentOrder.status === 'captured'`
   - `PaymentOrder.providerPaymentIntentId.startsWith('pi_mock_')`
   - `Invoice.invoiceStatus === 'paid'`
   - `Invoice.providerInvoiceId.startsWith('in_mock_')`
   - `Payout.status === 'released'`
   - `ContractMilestone.status === 'paid'`
   - `EscrowLedger.count({ paymentOrderId }) === 3`
   - `StripeEvent.count() >= 5` (create PI, create invoice, capture, transfer, pay)
8. Output formato smoke-compliance (✓/✗). Exit 0/1/2.

Script in `package.json`: `"smoke:payments": "node scripts/smoke-payments.js"`.

## Integrazione con compliance esistente

- Il `validate_marketplace_legal_docs` tool MCP viene chiamato (a discrezione di chi sviluppa, via skill `tavolibero-compliance`) su ogni stringa user-facing nuova (form labels, messaggi errore, EJS).
- Il `check_fornero_compliance` NON va toccato: riguarda matching, non pagamenti.
- Lessico nelle view EJS: usare "compenso", "pacchetto servizio", mai "stipendio". Il mock Stripe stesso: commenti e log usano "pagamento", "trasferimento", mai "stipendio".

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Drift futuro tra mock e Stripe reale | Shape di risposta aderente al SDK ufficiale; swap via env, non refactor |
| Idempotency key collision tra retry | Format include operation: `milestone-<id>-<op>` |
| BankAccount primary multiplo per bug transazionale | Demote in stessa `prisma.$transaction` del promote |
| Migration SQLite rompe dev esistenti | Migration additiva (nessun drop/rename di colonne) |
| Validazione IBAN insufficiente | Solo IT per ora; se serve multi-country, swap a `iban` npm package in futuro |

## Criteri di accettazione

1. `npx prisma migrate dev` applica la migration senza errori.
2. `npm run smoke:payments` esce 0 con 8/8 check passati dopo il seed.
3. Un worker può creare 2 IBAN dalla UI, promuovere/archiviare, e il payout va al primary corrente.
4. `grep -r "pi_contract_\|in_demo_" lib/payment-agent.js` ritorna vuoto (placeholder rimossi).
5. Gli smoke test di compliance (`npm run mcp:smoke`) continuano a passare 5/5.
6. `STRIPE_MODE=mock` nel `.env` è documentato in `CLAUDE.md`.

## Files

**Create:**
- `prisma/migrations/<timestamp>_bank_accounts_and_stripe_events/migration.sql`
- `lib/stripe.js` — factory
- `lib/stripe-mock.js` — mock SDK
- `lib/iban.js` — validazione
- `data/bank-account-service.js` — CRUD (segue pattern `data/marketplace-service.js`)
- `views/pages/cameriere/bank-accounts.ejs`
- `views/pages/ristorante/bank-accounts.ejs`
- `scripts/smoke-payments.js`

**Modify:**
- `prisma/schema.prisma` — nuovi model + estensioni profile
- `lib/payment-agent.js` — swap a mock, transaction wrap, idempotency
- `data/mock.js` — hydrator per `BankAccount` (se necessario per dev senza Prisma)
- `routes/cameriere.js` — route bank-accounts
- `routes/ristorante.js` — route bank-accounts
- `package.json` — script `smoke:payments`
- `.env.example` — `STRIPE_MODE=mock` documentato
- `CLAUDE.md` — sezione breve sul Stripe mode factory

## Prossimi passi

1. Piano di implementazione in `docs/superpowers/plans/2026-04-17-payments-subproject-1.md`, task granulare.
2. Esecuzione via `subagent-driven-development`, un task alla volta con review.
3. Dopo merge: Sub-progetto 2 (ritenuta d'acconto + IVA).
