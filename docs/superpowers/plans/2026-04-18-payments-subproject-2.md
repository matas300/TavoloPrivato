# Payments Sub-project 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load also `finance/commercialista-italiano` skill for tax domain clarity when in doubt.

**Goal:** Aggiungere al motore pagamenti il calcolo della ritenuta d'acconto 20% per worker in regime `autonomo_occasionale` e `partita_iva_ordinaria`. Il marketplace calcola e registra la ritenuta ma NON la trattiene cash (è il ristorante, sostituto d'imposta, che la trattiene). Preceduto dal rename atomico `grossAmountEur → taxableAmountEur` in tutto il repo.

**Architecture:** Rename chirurgico (Task 1) prima di qualsiasi cambio fiscale; poi estensione additiva schema (enum + colonne, nessun drop). Nuovo modulo puro `lib/tax-calculator.js` per il calcolo. Refactor `lib/payment-agent.js`: precheck taxMode fuori transaction → skip su unknown; dentro transaction uso tax-calculator e persistenza campi estesi. Nuovo evento `withholding.reported` scritto su `StripeEvent` (informativo, non cash del marketplace). Smoke-payments esteso a 4 scenari (forfettario/auth_occ/P.IVA ord/unknown skip).

**Tech Stack:** Prisma/SQLite (migrate additiva), Express/EJS per rename template, zero nuove dipendenze.

**Spec di riferimento:** `docs/superpowers/specs/2026-04-18-payments-subproject-2-design.md`.
**Skill fiscale:** `finance/commercialista-italiano` (expertise sostituto d'imposta, marketplace intermediario, regimi IT).

**Vincoli fiscali chiave (dalla skill):**
- TavoloLibero = marketplace intermediario puro → **ristorante** è sostituto d'imposta, non il marketplace.
- Ritenuta 20%: trattenuta dal ristorante al momento del pagamento, versata con F24 cod. 1040. Il marketplace la registra per audit/F24-report (sub-2c) e DAC7 (sub-4).
- IVA 22%: OUT OF SCOPE (Sub-progetto 6).
- `taxMode=unknown`: hard-skip della milestone, non defaulting.

---

## File Structure

### Create

- `lib/tax-calculator.js` — funzione pura `computeInvoiceTaxes`, ~80 LOC.
- `scripts/smoke-tax-calculator.js` — unit smoke del modulo puro (opzionale — se integrato in smoke-payments si salta).
- `prisma/migrations/<ts>_rename_taxable_and_add_withholding/migration.sql` — migration.

### Modify

- `prisma/schema.prisma` — rename `grossAmountEur` in ServiceContract + ContractMilestone, enum TaxMode estesa, colonne withholding/totalDue/snapshot su Invoice/Payout/PaymentOrder.
- `prisma/seed.js` — rename field + aggiungere 3 worker fixture (auth_occ, P.IVA ord, unknown).
- `lib/payment-agent.js` — precheck taxMode + uso tax-calculator + nuove entries escrow.
- `lib/contract-agent.js` — rename (solo letture).
- `lib/compliance-agent.js` — rename (solo letture).
- `lib/stripe-mock.js` — helper per scrivere `StripeEvent` di tipo `withholding.reported` (o lasciare a payment-agent, vedi Task 7).
- `routes/api.js`, `routes/cameriere.js`, `routes/ristorante.js`, `routes/admin.js` — rename.
- `views/pages/cameriere/contratti-lunghi.ejs`, `views/pages/ristorante/contratti-lunghi.ejs` — rename.
- `public/js/long-contract-page.js`, `public/js/admin-legal-billing.js` — rename.
- `mcp/tools/check-fornero-compliance.js` — rename.
- `docs/legal-architecture-audit.md` — rename (documentazione).
- `scripts/smoke-payments.js` — 3 nuovi scenari + scenario unknown skip.
- `scripts/smoke-compliance.js` — NOT TOUCHED (deve continuare a passare).
- `CLAUDE.md` — sezione "Calcolo fiscale ritenuta" + nota marketplace non sostituto.
- `memory/payments_architecture.md`, `memory/compliance_rules.md` — aggiornamenti.

### Do NOT touch

- `lib/earnings-simulator.js`, `lib/earnings-scenarios.js` — solo marketing/forfettario per scelta utente.
- `lib/stripe.js` factory — già OK dal sub-1.
- `lib/iban.js`, `data/bank-account-service.js` — estranei al sub-2.

### Test vehicle

Zero framework (coerente repo). Verifica via `npm run smoke:payments` esteso (24+ check su 4 scenari), `npm run mcp:smoke` invariato 5/5.

---

## Task 1: Rename atomico `grossAmountEur` → `taxableAmountEur`

**Objective:** Rinominare il field in tutto il repo in un unico commit, senza toccare logica. Smoke e compliance devono continuare a passare identici dopo il rename.

**Files (18):** vedi lista in "Modify" sopra — tutti i file che contengono la stringa letterale `grossAmountEur`.

**Motivazione:** `grossAmountEur` era ambiguo ("lordo di cosa?"). Semanticamente è sempre stato l'**imponibile** (compenso concordato, pre-ritenuta, pre-IVA). Col sub-2 arrivano campi fiscali reali: chiarire il nome prima di aggiungerli riduce la confusione futura.

- [ ] **Step 1: Verifica working tree pulito**

```bash
cd ~/progetti/TavoloPrivato
git status
git branch --show-current
```

Expected: branch `feat/compliance-mcp`, working tree clean.

- [ ] **Step 2: Conta occorrenze prima del rename (baseline)**

```bash
grep -rn "grossAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs" --include="*.md" | wc -l
```

Expected: `62` (se diverso, aggiornare la baseline e procedere).

- [ ] **Step 3: Rename in schema Prisma**

Modifica `prisma/schema.prisma` riga 539 e 578: cambiare `grossAmountEur` in `taxableAmountEur`.

- [ ] **Step 4: Rename in tutti i file JS/EJS/MD**

Usare un singolo comando sed portabile:

```bash
cd ~/progetti/TavoloPrivato
for f in $(grep -rl "grossAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs" --include="*.md"); do
  sed -i 's/grossAmountEur/taxableAmountEur/g' "$f"
done
```

ATTENZIONE: `--include` qui è parte di `grep`, non `sed`. Verificare con il primo `grep -rl` senza pipe che la lista torni 18 file.

- [ ] **Step 5: Verifica rename completo**

```bash
grep -rn "grossAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs" --include="*.md"
# expected: zero match (tranne in doc storica sub-1 plan se esiste)

grep -rn "taxableAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs" --include="*.md" | wc -l
# expected: 62 (stessa count, in nuovi nomi)
```

Se compaiono match residui (es. in commenti, stringhe di errore che menzionavano il vecchio nome), sistemarli manualmente.

- [ ] **Step 6: Rigenerare client Prisma**

```bash
npm run db:generate
```

Expected: "Generated Prisma Client (vX.Y.Z) to ./node_modules/@prisma/client in Ns". No errori.

- [ ] **Step 7: NON applicare migrate yet** (la migration sarà creata nel Task 4 con anche le colonne nuove, in un singolo SQL)

Semplice verifica che `prisma validate` passi:

```bash
npm run db:validate
```

Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 8: Smoke di non-regressione PRE-migration**

A questo punto il codice usa `taxableAmountEur` in memoria, ma dev.db ha ancora `grossAmountEur`. I seed esistenti e il payment-agent leggerebbero da colonna rinominata. **Serve la migration PRIMA di runnare smoke-payments.**

Quindi: skippiamo lo smoke in questo Task. Il Task 4 creerà la migration e la applicherà; lì verifichiamo lo smoke di non-regressione.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rename grossAmountEur -> taxableAmountEur across codebase

Rename puramente sintattico in tutti i 18 file che usavano il nome
(prisma schema + seed, lib agents, routes, views, mcp tools, doc).
Zero modifiche di logica. Semantica invariata: il campo rappresenta
sempre l'imponibile (pre-ritenuta, pre-IVA). Il rename prepara il
Sub-progetto 2 (ritenuta d'acconto 20%) evitando confusioni su
cosa significhi 'gross' quando arriveranno i regimi fiscali
non-forfettari."
```

---

## Task 2: Estendere `enum TaxMode` + verifica call sites

**Objective:** Aggiungere `partita_iva_ordinaria` all'enum TaxMode. Verificare che nessun switch/match esaustivo si rompa.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Modificare l'enum**

In `prisma/schema.prisma` alla riga 28:

```prisma
enum TaxMode {
  forfettario
  autonomo_occasionale
  partita_iva_ordinaria
  unknown
}
```

- [ ] **Step 2: Trovare tutti i call site di `taxMode`**

```bash
grep -rn "taxMode" --include="*.js" --include="*.prisma"
```

Expected (da sub-1, 4 match):
- `prisma/schema.prisma:28` (enum def)
- `prisma/schema.prisma:286` (TaxProfile field)
- `prisma/schema.prisma:321` (index)
- `lib/contract-agent.js:103, 217, 279` (lettura del valore — non switch)

Verificare manualmente che nessuno faccia `switch(taxMode)` con `default` che fa throw: se ci fosse, andrebbe aggiornato. Nel codice sub-1 era tutto letture semplici, quindi aggiungere un valore all'enum è back-compatible.

- [ ] **Step 3: Rigenerare client Prisma**

```bash
npm run db:generate
```

Expected: no errori.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add partita_iva_ordinaria to TaxMode enum

Prepara il Sub-progetto 2 (ritenuta d'acconto). I 3 regimi con
trattamento fiscale differenziato sono ora rappresentabili a schema.
L'enum esteso è back-compatible: nessun call-site fa matching
esaustivo su TaxMode."
```

---

## Task 3: Estendere schema `Invoice`, `Payout`, `PaymentOrder`

**Objective:** Aggiungere le colonne fiscali (ritenuta, totalDue, netToWorker, snapshot regime) al schema Prisma, tutte nullable o con default per back-compat.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Localizzare `model Invoice`, `model Payout`, `model PaymentOrder`**

```bash
grep -n "^model Invoice\|^model Payout\|^model PaymentOrder" prisma/schema.prisma
```

Expected:
- `model PaymentOrder` riga 616
- `model Payout` riga 654
- `model Invoice` riga 674

- [ ] **Step 2: Estendere `model Invoice`**

Patch in `prisma/schema.prisma`, model Invoice (dopo `paymentTermsBase` riga 689, prima delle relations):

```prisma
  // Campi fiscali sub-2
  taxableAmountEur      Float?
  withholdingRate       Float    @default(0)
  withholdingAmountEur  Float    @default(0)
  totalDueEur           Float?
  netToWorkerEur        Float?
  taxRegimeSnapshot     String?
```

Usare `mcp_patch` per inserire questi campi dopo la riga `paymentTermsBase    PaymentTermsBase?` e prima di `paymentOrder        PaymentOrder      @relation(...)`.

- [ ] **Step 3: Estendere `model Payout`**

In `model Payout`, dopo `payoutAmountEur Float`:

```prisma
  withholdingAmountEur  Float    @default(0)
```

- [ ] **Step 4: Estendere `model PaymentOrder`**

In `model PaymentOrder`, dopo `payoutAmountEur Float`:

```prisma
  totalDueEur             Float?
```

- [ ] **Step 5: Validate**

```bash
npm run db:validate
```

Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add withholding + totalDue + regime snapshot fields

Invoice: taxableAmountEur, withholdingRate, withholdingAmountEur,
totalDueEur, netToWorkerEur, taxRegimeSnapshot.
Payout: withholdingAmountEur (informativo, marketplace non e
sostituto d imposta).
PaymentOrder: totalDueEur (quanto il ristorante paga al mkt).

Tutti i campi nullable o default 0: migration additiva, zero rischio
sui dati esistenti."
```

---

## Task 4: Migration Prisma — rename + additive columns

**Objective:** Applicare al dev.db la migration composita: rename colonna `grossAmountEur` → `taxableAmountEur` in 2 tabelle + aggiunta nuove colonne. Verificare che lo smoke-payments esistente (sub-1) passi invariato (numeri forfettario identici a prima).

**Files:**
- Create: `prisma/migrations/<ts>_rename_taxable_and_add_withholding/migration.sql` (auto-generata)

- [ ] **Step 1: Creare la migration**

```bash
cd ~/progetti/TavoloPrivato
npx prisma migrate dev --name rename_taxable_and_add_withholding
```

Prisma rileverà:
- Rename colonna `grossAmountEur` → `taxableAmountEur` su `ServiceContract` e `ContractMilestone`. **Attenzione:** Prisma per default droppa+ricrea; con SQLite 3.25+ supporta ALTER COLUMN RENAME, ma Prisma potrebbe proporre drop. Verificare il SQL generato.
- Aggiunta colonne su Invoice/Payout/PaymentOrder (ADD COLUMN, non drop).
- Aggiunta valore `partita_iva_ordinaria` all'enum TaxMode (in SQLite gli enum sono CHECK constraint o stringhe — Prisma li gestisce via validate lato app).

- [ ] **Step 2: Ispezionare il SQL generato**

```bash
find prisma/migrations -name "migration.sql" -newer prisma/schema.prisma | head -1
# o
ls -lt prisma/migrations/ | head -3
cat prisma/migrations/<timestamp>_rename_taxable_and_add_withholding/migration.sql
```

**Controllo critico:** la migration DEVE essere un rename (o create new + copy + drop old, in ordine safe) e ADD COLUMN. Se Prisma ha generato un `DROP TABLE` o `DROP COLUMN grossAmountEur` senza copia dei dati, **STOP**: modificare manualmente il SQL per usare ALTER TABLE ... RENAME COLUMN (SQLite 3.25+) e riapplicare.

Pattern atteso (se Prisma usa rename nativo):
```sql
ALTER TABLE "ServiceContract" RENAME COLUMN "grossAmountEur" TO "taxableAmountEur";
ALTER TABLE "ContractMilestone" RENAME COLUMN "grossAmountEur" TO "taxableAmountEur";
ALTER TABLE "Invoice" ADD COLUMN "taxableAmountEur" REAL;
ALTER TABLE "Invoice" ADD COLUMN "withholdingRate" REAL NOT NULL DEFAULT 0;
-- etc.
```

Pattern alternativo (rebuild tabella — Prisma spesso fa così per SQLite):
```sql
CREATE TABLE "new_ServiceContract" (...colonne con taxableAmountEur...);
INSERT INTO "new_ServiceContract" SELECT ..., "grossAmountEur" AS "taxableAmountEur", ... FROM "ServiceContract";
DROP TABLE "ServiceContract";
ALTER TABLE "new_ServiceContract" RENAME TO "ServiceContract";
```

Entrambi preservano i dati. Se invece appare solo `DROP COLUMN` senza copia, abortire.

- [ ] **Step 3: Verifica stato dev.db post-migrate**

```bash
npm run db:generate
# optional inspection
sqlite3 prisma/dev.db "PRAGMA table_info('ContractMilestone');" 2>&1 | head -20
sqlite3 prisma/dev.db "PRAGMA table_info('Invoice');" 2>&1 | head -20
```

Expected: `taxableAmountEur` presente su ContractMilestone e Invoice; nuove colonne withholding/totalDue/netToWorker presenti su Invoice.

Se `sqlite3` non è disponibile, usare node:
```bash
node -e "const p=require('@prisma/client').PrismaClient; const c=new p(); c.\$queryRaw\`PRAGMA table_info('Invoice')\`.then(r=>console.log(r)).finally(()=>c.\$disconnect())"
```

- [ ] **Step 4: Smoke di non-regressione payments (sub-1 forfettario)**

```bash
npm run smoke:payments
```

Expected: 14/14 check passed (sub-1 baseline), exit 0. Il seed è solo forfettario, la ritenuta è 0, i numeri sono invariati.

Se fallisce: il rename non è stato applicato completamente (qualche lettura usa ancora `grossAmountEur` da DB — verificare Task 1 Step 5) o la migration non è andata bene (Task 4 Step 2).

- [ ] **Step 5: Smoke compliance di non-regressione**

```bash
npm run mcp:smoke
```

Expected: 5/5 passed.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "chore(db): migration rename grossAmountEur + add withholding cols

Rename colonna su ServiceContract e ContractMilestone.
Aggiunta colonne fiscali su Invoice/Payout/PaymentOrder.
Additiva: nessuna perdita di dati.
Smoke payments sub-1: 14/14 invariato (forfettario = 0 ritenuta)."
```

---

## Task 5: Modulo `lib/tax-calculator.js`

**Objective:** Creare una funzione pura che calcola tutti i campi fiscali dati `taxableEur`, `platformFeeEur`, `taxMode`. Nessun side-effect, nessuna dipendenza Prisma. Unit-testabile.

**Files:**
- Create: `lib/tax-calculator.js`

- [ ] **Step 1: Scrivere il modulo**

```javascript
// lib/tax-calculator.js
//
// Calcolo fiscale per emissione Invoice TavoloLibero (Sub-progetto 2).
// Marketplace e intermediario puro: NON e sostituto d imposta.
// La ritenuta 20% e trattenuta dal ristorante (sostituto giuridico
// ex art. 23 DPR 600/73) e versata con F24 cod. 1040. Il marketplace
// la REGISTRA (per audit, report F24 al ristorante, DAC7) ma non
// tocca cassa.
//
// IVA 22%: out of scope in sub-2, arrivera in sub-6 (pass-through).
//
// Vedi skill finance/commercialista-italiano per derivazione giuridica.

const WITHHOLDING_RATE = 0.20;

class TaxModeUnknownError extends Error {
  constructor(workerProfileId) {
    super(
      `Cannot bill worker ${workerProfileId}: taxMode is unknown or missing. ` +
      `Complete fiscal onboarding first (Sub-progetto 2b).`
    );
    this.code = 'TAX_MODE_UNKNOWN';
    this.workerProfileId = workerProfileId;
  }
}

function money(n) {
  return Math.round(n * 100) / 100;
}

function computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode, workerProfileId }) {
  if (typeof taxableEur !== 'number' || Number.isNaN(taxableEur)) {
    throw new TypeError(`taxableEur must be a number, got ${typeof taxableEur}`);
  }
  if (taxableEur <= 0) {
    throw new TypeError(`taxableEur must be positive, got ${taxableEur}`);
  }
  if (typeof platformFeeEur !== 'number' || Number.isNaN(platformFeeEur)) {
    throw new TypeError(`platformFeeEur must be a number, got ${typeof platformFeeEur}`);
  }
  if (platformFeeEur < 0) {
    throw new TypeError(`platformFeeEur cannot be negative, got ${platformFeeEur}`);
  }
  if (platformFeeEur > taxableEur) {
    throw new RangeError(`platformFeeEur (${platformFeeEur}) cannot exceed taxableEur (${taxableEur})`);
  }

  if (!taxMode || taxMode === 'unknown') {
    throw new TaxModeUnknownError(workerProfileId);
  }

  const ALLOWED = new Set(['forfettario', 'autonomo_occasionale', 'partita_iva_ordinaria']);
  if (!ALLOWED.has(taxMode)) {
    throw new TypeError(`Unknown taxMode: ${taxMode}. Expected one of: ${[...ALLOWED].join(', ')}`);
  }

  const taxable = money(taxableEur);
  const fee = money(platformFeeEur);

  let withholdingRate = 0;
  let withholdingAmountEur = 0;

  if (taxMode === 'autonomo_occasionale' || taxMode === 'partita_iva_ordinaria') {
    withholdingRate = WITHHOLDING_RATE;
    withholdingAmountEur = money(taxable * WITHHOLDING_RATE);
  }

  // forfettario: withholding = 0, il worker dichiara dicitura di esonero art. 1 c. 67 L. 190/2014

  const totalDueEur = money(taxable - withholdingAmountEur);   // ristorante -> marketplace
  const netToWorkerEur = money(totalDueEur - fee);              // marketplace -> worker

  return {
    taxableAmountEur: taxable,
    withholdingRate,
    withholdingAmountEur,
    totalDueEur,
    netToWorkerEur,
    platformFeeEur: fee,
    taxRegimeSnapshot: taxMode,
  };
}

module.exports = {
  computeInvoiceTaxes,
  WITHHOLDING_RATE,
  TaxModeUnknownError,
};
```

- [ ] **Step 2: Smoke unit rapido inline**

```bash
node -e "
const { computeInvoiceTaxes, TaxModeUnknownError } = require('./lib/tax-calculator');

// forfettario
const r1 = computeInvoiceTaxes({ taxableEur: 1000, platformFeeEur: 100, taxMode: 'forfettario', workerProfileId: 1 });
console.log('forfettario:', JSON.stringify(r1));
if (r1.netToWorkerEur !== 900) { console.error('FAIL forfettario'); process.exit(1); }

// auth_occ
const r2 = computeInvoiceTaxes({ taxableEur: 1000, platformFeeEur: 100, taxMode: 'autonomo_occasionale', workerProfileId: 2 });
console.log('auth_occ:', JSON.stringify(r2));
if (r2.withholdingAmountEur !== 200 || r2.totalDueEur !== 800 || r2.netToWorkerEur !== 700) { console.error('FAIL auth_occ'); process.exit(1); }

// P.IVA ord (same as auth_occ in sub-2)
const r3 = computeInvoiceTaxes({ taxableEur: 1000, platformFeeEur: 100, taxMode: 'partita_iva_ordinaria', workerProfileId: 3 });
console.log('P.IVA ord:', JSON.stringify(r3));
if (r3.withholdingAmountEur !== 200 || r3.taxRegimeSnapshot !== 'partita_iva_ordinaria') { console.error('FAIL P.IVA'); process.exit(1); }

// unknown throws
try {
  computeInvoiceTaxes({ taxableEur: 1000, platformFeeEur: 100, taxMode: 'unknown', workerProfileId: 4 });
  console.error('FAIL: should have thrown'); process.exit(1);
} catch (e) {
  if (!(e instanceof TaxModeUnknownError)) { console.error('FAIL: wrong error type', e); process.exit(1); }
  console.log('unknown throws OK:', e.code);
}

// negative taxable throws
try {
  computeInvoiceTaxes({ taxableEur: -5, platformFeeEur: 0, taxMode: 'forfettario', workerProfileId: 5 });
  console.error('FAIL: negative should throw'); process.exit(1);
} catch (e) {
  if (!(e instanceof TypeError)) { console.error('FAIL wrong err'); process.exit(1); }
  console.log('negative throws OK');
}

// fee > taxable throws
try {
  computeInvoiceTaxes({ taxableEur: 100, platformFeeEur: 200, taxMode: 'forfettario', workerProfileId: 6 });
  console.error('FAIL: fee>taxable should throw'); process.exit(1);
} catch (e) {
  if (!(e instanceof RangeError)) { console.error('FAIL wrong err'); process.exit(1); }
  console.log('fee>taxable throws OK');
}

console.log('\\nALL UNIT OK');
"
```

Expected: stampa 3 output JSON + 3 OK messages + "ALL UNIT OK", exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/tax-calculator.js
git commit -m "feat(tax): add pure tax-calculator module for sub-2

Calcolo ritenuta d acconto 20% per auth_occ e P.IVA ordinaria.
Funzione pura, zero side-effect, unit-testabile.
Marketplace non e sostituto d imposta: registriamo withholding
ma non tocca cassa (e il ristorante a trattenere e versare F24).
IVA 22% out of scope (sub-6)."
```

---

## Task 6: Helper `stripe-mock` per evento `withholding.reported`

**Objective:** Aggiungere al mock Stripe un helper che scrive `StripeEvent` di tipo `withholding.reported`. Questo evento non simula un side-effect Stripe reale (non esiste come evento Stripe) — è un "virtual event" interno che documenta la ritenuta registrata. Il sub-3 webhook handler lo consumerà per produrre report F24.

**Files:**
- Modify: `lib/stripe-mock.js`

- [ ] **Step 1: Localizzare il pattern di scrittura StripeEvent esistente**

```bash
grep -n "StripeEvent\|providerEventId" lib/stripe-mock.js | head -20
```

Cercare la funzione interna usata da `paymentIntents.create`, `invoices.pay`, ecc. per capire il pattern.

- [ ] **Step 2: Aggiungere metodo `writeWithholdingReported`**

Opzione A (preferita): esporre un nuovo namespace `withholding` nel mock.

```javascript
// all'interno del module.exports del mock:
withholding: {
  async report({ invoiceId, workerProfileId, restaurantProfileId, amountEur, rate, taxRegime }, options = {}) {
    const eventId = options.idempotencyKey
      ? `evt_mock_wh_${options.idempotencyKey}`
      : `evt_mock_wh_${invoiceId}_${Date.now()}`;
    // usare la stessa helper interna che scrive StripeEvent, es. `_persistEvent`
    await persistStripeEvent({
      providerEventId: eventId,
      eventType: 'withholding.reported',
      payload: {
        invoiceId,
        workerProfileId,
        restaurantProfileId,
        amountEur,
        rate,
        taxRegime,
        sostitutoImposta: 'restaurant',   // documentazione: e il ristorante, non il marketplace
      },
    });
    return { id: eventId, eventType: 'withholding.reported' };
  }
}
```

Usare `mcp_patch` per inserire il namespace rispettando la struttura esistente del mock. Se `persistStripeEvent` si chiama diversamente, adattare al nome interno trovato al Step 1.

- [ ] **Step 3: Verifica rapida con node**

```bash
node -e "
const stripe = require('./lib/stripe')();
(async () => {
  const r = await stripe.withholding.report({
    invoiceId: 999,
    workerProfileId: 1,
    restaurantProfileId: 1,
    amountEur: 200,
    rate: 0.20,
    taxRegime: 'autonomo_occasionale',
  });
  console.log('withholding.report result:', r);
})().catch(e => { console.error(e); process.exit(1); });
"
```

Expected: oggetto con `id: 'evt_mock_wh_...'` e `eventType: 'withholding.reported'`.

Nota: se il ritorno richiede un DB vivo, e questo script non ha Prisma pronto, saltare questo smoke e testare nel Task 11 via `smoke-payments.js`.

- [ ] **Step 4: Commit**

```bash
git add lib/stripe-mock.js
git commit -m "feat(stripe-mock): add withholding.report virtual event

Evento non-Stripe-native ma usa il canale StripeEvent per audit
della ritenuta d acconto trattenuta dal ristorante (sostituto).
Sara consumato dal webhook handler sub-3 per produrre report F24.
Marketplace non e sostituto: l evento e solo informativo."
```

---

## Task 7: Refactor `payment-agent.js` — precheck taxMode + integrazione tax-calculator

**Objective:** Aggiornare `createBillingArtifactsForMilestone` (e il caller `runMonthlyBillingCycle`) per:
1. Caricare `workerProfile.taxProfile.taxMode` PRIMA della transazione.
2. Se `taxMode === 'unknown'` o mancante: skip, non entrare in transaction, restituire `{ skipped: true, reason: 'TAX_MODE_UNKNOWN', ... }`.
3. Se OK: invocare `computeInvoiceTaxes` e persistere i nuovi campi su Invoice/Payout/PaymentOrder.
4. Scrivere evento `withholding.reported` se `withholdingAmountEur > 0`.

**Files:**
- Modify: `lib/payment-agent.js`

- [ ] **Step 1: Import del tax-calculator**

In cima al file:

```javascript
const { computeInvoiceTaxes, TaxModeUnknownError } = require('./tax-calculator');
```

- [ ] **Step 2: Modificare `runMonthlyBillingCycle` per raccogliere skip**

Il metodo deve accumulare `skipped: [{ milestoneId, reason, workerProfileId }]` e continuare a processare le altre milestone quando una è skippata per TAX_MODE_UNKNOWN. Altre eccezioni restano hard-fail.

Pseudo-pattern:

```javascript
async function runMonthlyBillingCycle({ asOfDate } = {}) {
  const processed = [];
  const skipped = [];
  const dueMilestones = await prisma.contractMilestone.findMany({ /* ... planned, dueDate <= asOf */ });
  for (const milestone of dueMilestones) {
    try {
      const result = await createBillingArtifactsForMilestone(milestone);
      if (result?.skipped) {
        skipped.push({ milestoneId: milestone.id, reason: result.reason, workerProfileId: result.workerProfileId });
      } else {
        processed.push(result);
      }
    } catch (err) {
      console.error(`[payment-agent] milestone ${milestone.id} failed hard:`, err);
      throw err;   // mantenere comportamento pre-sub-2 su errori non-tax
    }
  }
  return { processed, skipped };
}
```

- [ ] **Step 3: Modificare `createBillingArtifactsForMilestone` — precheck fuori transaction**

```javascript
async function createBillingArtifactsForMilestone(milestone) {
  // Precheck taxMode FUORI dalla transazione.
  const contract = await prisma.serviceContract.findUnique({
    where: { id: milestone.serviceContractId },
    include: {
      workerProfile: { include: { taxProfile: true } }
    }
  });
  const worker = contract?.workerProfile;
  const taxMode = worker?.taxProfile?.taxMode;
  if (!taxMode || taxMode === 'unknown') {
    console.log(`[payment-agent] SKIP milestone ${milestone.id}: workerProfile ${worker?.id} has taxMode=${taxMode || 'missing'}`);
    return { skipped: true, reason: 'TAX_MODE_UNKNOWN', milestoneId: milestone.id, workerProfileId: worker?.id };
  }

  // Calcolo fiscale (puro, pre-transaction)
  const taxes = computeInvoiceTaxes({
    taxableEur: milestone.taxableAmountEur,
    platformFeeEur: milestone.platformFeeEur,
    taxMode,
    workerProfileId: worker.id,
  });

  // ... proseguire con prisma.$transaction usando taxes.*
}
```

- [ ] **Step 4: Dentro `$transaction`, usare `taxes.*` per popolare PaymentOrder e Invoice**

Nel blocco esistente (circa righe 190-210 del payment-agent post-rename):

```javascript
await tx.paymentOrder.create({
  data: {
    serviceContractId: contract.id,
    contractMilestoneId: milestone.id,
    provider: 'stripe_connect',
    providerPaymentIntentId: pi.id,
    providerInvoiceId: mockInvoice.id,
    currency: 'EUR',
    amountTotalEur: taxes.taxableAmountEur,       // imponibile (invariato semantica)
    platformFeeEur: taxes.platformFeeEur,
    payoutAmountEur: taxes.netToWorkerEur,         // nuovo calcolo
    totalDueEur: taxes.totalDueEur,                 // NUOVO CAMPO
    status: 'created',
    scheduledCaptureAt: milestone.dueDate,
    dueDate: milestone.dueDate,
  }
});

await tx.invoice.create({
  data: {
    paymentOrderId: paymentOrder.id,
    serviceContractId: contract.id,
    contractMilestoneId: milestone.id,
    invoiceType: 'platform_milestone',
    providerInvoiceId: mockInvoice.id,
    invoiceStatus: 'draft',
    amountEur: taxes.taxableAmountEur,              // back-compat (amountEur = imponibile)
    taxableAmountEur: taxes.taxableAmountEur,       // nuovo
    withholdingRate: taxes.withholdingRate,         // nuovo
    withholdingAmountEur: taxes.withholdingAmountEur,
    totalDueEur: taxes.totalDueEur,
    netToWorkerEur: taxes.netToWorkerEur,
    taxRegimeSnapshot: taxes.taxRegimeSnapshot,
    issuedAt: new Date(),
    dueDate: milestone.dueDate,
    paymentTermsDays: contract.paymentTermsDays,
    paymentTermsBase: contract.paymentTermsBase,
  }
});
```

- [ ] **Step 5: `stripe.paymentIntents.create`: usare `totalDueEur`, non `taxableAmountEur`**

Nel blocco che oggi fa `amount: Math.round(paymentOrder.amountTotalEur * 100)`:

```javascript
const pi = await stripe.paymentIntents.create({
  amount: Math.round(taxes.totalDueEur * 100),     // CAMBIATO: il ristorante paga totalDueEur, non taxable
  currency: 'eur',
  capture_method: 'manual',
  application_fee_amount: Math.round(taxes.platformFeeEur * 100),
  customer: restaurant.stripeCustomerId,
  transfer_data: { destination: worker.stripeAccountId },
  metadata: {
    contractMilestoneId: String(milestone.id),
    taxRegime: taxes.taxRegimeSnapshot,
  },
}, { idempotencyKey: `milestone-${milestone.id}-create` });
```

- [ ] **Step 6: Scrivere evento `withholding.reported` se ritenuta > 0**

Dopo la creazione dell'invoice, dentro o subito fuori la $transaction (FUORI è più sicuro per separare concerns):

```javascript
if (taxes.withholdingAmountEur > 0) {
  await stripe.withholding.report({
    invoiceId: invoice.id,
    workerProfileId: worker.id,
    restaurantProfileId: contract.restaurantProfileId,
    amountEur: taxes.withholdingAmountEur,
    rate: taxes.withholdingRate,
    taxRegime: taxes.taxRegimeSnapshot,
  }, { idempotencyKey: `milestone-${milestone.id}-withholding` });
}
```

- [ ] **Step 7: Verificare `db:validate` e sintassi**

```bash
npm run db:generate
node -c lib/payment-agent.js 2>&1 || node -e "require('./lib/payment-agent')"
```

Expected: nessun syntax error.

- [ ] **Step 8: Commit**

```bash
git add lib/payment-agent.js
git commit -m "feat(payment-agent): integrate tax-calculator + skip on unknown taxMode

Precheck fuori transaction: se workerProfile.taxProfile.taxMode e
unknown, skippa la milestone (lascia status=planned) e riporta
nello skipped[] del ciclo mensile. Nessuna eccezione propagata:
hard-fail del singolo task, soft-continua del batch.

Se taxMode e valido, tax-calculator determina taxable/withholding/
totalDue/netToWorker. PaymentIntent ora usa totalDueEur (quanto il
ristorante effettivamente paga, gia al netto della ritenuta).
Invoice e Payout persistono i nuovi campi. Evento withholding.
reported scritto su StripeEvent quando ritenuta > 0."
```

---

## Task 8: Refactor `captureDuePaymentOrders` — EscrowLedger extended

**Objective:** Aggiornare la parte di cattura pagamento perché:
1. `Payout` riceva `withholdingAmountEur` dall'Invoice collegata.
2. `EscrowLedger` abbia una entry `withholding_reported` quando la ritenuta > 0.
3. Il transfer Stripe usi `payoutAmountEur` (che ora è il netto finale post-ritenuta, post-fee).

**Files:**
- Modify: `lib/payment-agent.js`

- [ ] **Step 1: Localizzare `captureDuePaymentOrders`**

```bash
grep -n "captureDuePaymentOrders\|escrowLedger\|EscrowLedger" lib/payment-agent.js
```

- [ ] **Step 2: Modificare l'update di Payout per includere withholding**

Nel blocco `$transaction` che fa `tx.payout.update(...)`:

```javascript
const invoice = await tx.invoice.findFirst({
  where: { paymentOrderId: order.id },
  orderBy: { issuedAt: 'desc' },
});

await tx.payout.upsert({
  where: { paymentOrderId: order.id },
  update: {
    payoutAmountEur: order.payoutAmountEur,      // gia nuovo calcolo (netToWorker)
    withholdingAmountEur: invoice?.withholdingAmountEur || 0,
    status: 'released',
    releasedAt: new Date(),
  },
  create: {
    paymentOrderId: order.id,
    workerProfileId: order.serviceContract.workerProfileId,
    payoutAmountEur: order.payoutAmountEur,
    withholdingAmountEur: invoice?.withholdingAmountEur || 0,
    status: 'released',
    releasedAt: new Date(),
  }
});
```

- [ ] **Step 3: EscrowLedger — entry `capture` con totalDueEur invece di amountTotalEur**

Motivo: `capture` significa "quanto e entrato dal ristorante". In sub-1 era `amountTotalEur` (che allora era il totale). Ora `amountTotalEur` e l'imponibile, e ` totalDueEur` e il totale pagato. Quindi capture entry deve usare `totalDueEur`:

```javascript
const entries = [
  { paymentOrderId: order.id, entryType: 'capture',        amountEur: order.totalDueEur || order.amountTotalEur, metadata: {} },
  { paymentOrderId: order.id, entryType: 'platform_fee',   amountEur: order.platformFeeEur,                        metadata: {} },
  { paymentOrderId: order.id, entryType: 'worker_payout',  amountEur: order.payoutAmountEur,                       metadata: {} },
];

if (invoice?.withholdingAmountEur > 0) {
  entries.push({
    paymentOrderId: order.id,
    entryType: 'withholding_reported',
    amountEur: invoice.withholdingAmountEur,
    metadata: { regime: invoice.taxRegimeSnapshot, sostituto: 'restaurant' },
  });
}

await tx.escrowLedger.createMany({ data: entries });
```

Il fallback `|| order.amountTotalEur` copre i record legacy pre-sub-2 che hanno `totalDueEur=null`.

- [ ] **Step 4: `stripe.transfers.create` — amount già corretto**

Verifica che il transfer usi `order.payoutAmountEur`:

```javascript
await stripe.transfers.create({
  amount: Math.round(order.payoutAmountEur * 100),   // gia netto post-ritenuta-post-fee
  currency: 'eur',
  destination: worker.stripeAccountId,
  metadata: { paymentOrderId: String(order.id) },
}, { idempotencyKey: `milestone-${milestone.id}-transfer` });
```

Nessuna modifica se il codice già leggeva `order.payoutAmountEur`.

- [ ] **Step 5: Verifica syntax + db:generate**

```bash
npm run db:generate
node -e "require('./lib/payment-agent')"
```

- [ ] **Step 6: Commit**

```bash
git add lib/payment-agent.js
git commit -m "feat(payment-agent): extend capture flow for withholding

Payout.withholdingAmountEur letto da Invoice (informativo, non cash).
EscrowLedger 'capture' ora usa totalDueEur (cosa entra davvero dal
ristorante). Nuova entry 'withholding_reported' con regime +
sostituto=restaurant quando ritenuta > 0. Transfer amount gia
corretto via payoutAmountEur."
```

---

## Task 9: Seed fixture con 3 regimi + 1 unknown

**Objective:** Aggiornare `prisma/seed.js` perché lo smoke-payments abbia 4 worker con taxMode diversi. Alternativa KISS: non toccare il seed globale e fare patch via upsert dentro `smoke-payments.js` (più isolato). Scelta preferita: **patch in smoke-payments**, seed resta mainly forfettario.

**Files:**
- Modify: `scripts/smoke-payments.js` (il Task 11 lo farà)
- Optional modify: `prisma/seed.js` (aggiungere 2 worker fixture opzionali se la patch nello smoke si rivela troppo invasiva)

**Decisione:** Task 9 diventa no-op seed-side, solo verifica che il seed esistente abbia ALMENO 1 worker con TaxProfile (anche `unknown`). I 4 regimi li materializza lo smoke al Task 11.

- [ ] **Step 1: Verifica stato TaxProfile nel seed**

```bash
grep -n "taxMode\|taxProfile\|TaxProfile" prisma/seed.js | head -20
```

Se esiste già creazione di TaxProfile per i worker seed, nessuna modifica. Altrimenti aggiungere un blocco minimo che crea un TaxProfile con `taxMode: 'forfettario'` per tutti i worker del seed (così il sub-1 smoke forfettario continua a funzionare).

- [ ] **Step 2 (condizionale, solo se seed non crea TaxProfile):** aggiungere

```javascript
for (const worker of workers) {
  await prisma.taxProfile.upsert({
    where: { workerProfileId: worker.id },
    update: {},
    create: { workerProfileId: worker.id, taxMode: 'forfettario' },
  });
}
```

In fondo allo script seed, dopo la creazione dei WorkerProfile.

- [ ] **Step 3: Rirunnare seed**

```bash
npm run db:seed
```

Expected: no errori, DB popolato.

- [ ] **Step 4: Commit (se modifiche al seed)**

```bash
git add prisma/seed.js
git commit -m "chore(seed): ensure taxProfile forfettario for all workers"
```

Se non servono modifiche (seed ha gia TaxProfile), skippare commit di questo task.

---

## Task 10: Estensione `scripts/smoke-payments.js` — 4 scenari

**Objective:** Trasformare lo smoke esistente (forfettario only, 14 check) in uno smoke a 4 scenari: forfettario (baseline sub-1), autonomo_occasionale, partita_iva_ordinaria, unknown (skip). Setup: lo smoke patcha via upsert 3 worker per impostare i 3 regimi + uno a unknown. Non modifica il seed.

**Files:**
- Modify: `scripts/smoke-payments.js`

- [ ] **Step 1: Leggere lo smoke attuale**

```bash
wc -l scripts/smoke-payments.js
head -50 scripts/smoke-payments.js
```

Capire la struttura: variabili, asserzioni (funzione `assert`/`check`), cleanup.

- [ ] **Step 2: Factoring — estrarre `runScenario({ worker, restaurant, taxMode, expected })`**

Estrarre il corpo dello smoke esistente in una funzione parametrica:

```javascript
async function runScenarioFor({ worker, restaurant, taxMode, scenarioLabel, expected }) {
  // 1. upsert TaxProfile(workerProfileId: worker.id, taxMode)
  // 2. crea o refresha contract + milestone per la coppia
  // 3. runMonthlyBillingCycle({ asOfDate: dueDate + 1 day })
  // 4. captureDuePaymentOrders({ now: dueDate + 2 days })
  // 5. assert:
  //    - invoice.taxRegimeSnapshot === taxMode
  //    - invoice.withholdingAmountEur === expected.withholding
  //    - invoice.totalDueEur === expected.totalDue
  //    - invoice.netToWorkerEur === expected.netToWorker
  //    - payout.payoutAmountEur === expected.netToWorker
  //    - payout.withholdingAmountEur === expected.withholding
  //    - escrowLedger count: 3 se withholding=0, 4 se withholding>0
  //    - StripeEvent withholding.reported presente iff withholding>0
}
```

- [ ] **Step 3: Aggiungere scenario 4: unknown skip**

```javascript
async function runScenarioUnknown({ worker, restaurant }) {
  // 1. upsert TaxProfile(workerProfileId: worker.id, taxMode: 'unknown')
  // 2. crea contract + milestone planned
  // 3. const result = await runMonthlyBillingCycle({ asOfDate: dueDate + 1 day })
  // 4. assert:
  //    - result.skipped include { milestoneId, reason: 'TAX_MODE_UNKNOWN', workerProfileId: worker.id }
  //    - milestone status === 'planned' (post-cycle)
  //    - nessun PaymentOrder creato per quella milestone
  //    - nessuna eccezione propagata
}
```

- [ ] **Step 4: Invocare i 4 scenari nel `main()`**

```javascript
async function main() {
  const fixtures = await setupFixtures();   // 4 worker + 4 restaurant + 4 contract (o riusa esistenti diversificando)

  await runScenarioFor({
    worker: fixtures.workers.forfettario,
    restaurant: fixtures.restaurants[0],
    taxMode: 'forfettario',
    scenarioLabel: 'FORFETTARIO',
    expected: { withholding: 0, totalDue: 1000, netToWorker: 900 },
  });

  await runScenarioFor({
    worker: fixtures.workers.authOcc,
    restaurant: fixtures.restaurants[1],
    taxMode: 'autonomo_occasionale',
    scenarioLabel: 'AUTONOMO_OCCASIONALE',
    expected: { withholding: 200, totalDue: 800, netToWorker: 700 },
  });

  await runScenarioFor({
    worker: fixtures.workers.pivaOrd,
    restaurant: fixtures.restaurants[2],
    taxMode: 'partita_iva_ordinaria',
    scenarioLabel: 'PARTITA_IVA_ORDINARIA',
    expected: { withholding: 200, totalDue: 800, netToWorker: 700 },
  });

  await runScenarioUnknown({
    worker: fixtures.workers.unknown,
    restaurant: fixtures.restaurants[3],
  });

  console.log('\\n==========================');
  console.log(`TOTAL: ${passed}/${total} checks passed`);
  process.exit(passed === total ? 0 : 1);
}
```

`setupFixtures()` deve garantire che i 4 contract usino `taxableAmountEur: 1000` e `platformFeeEur: 100` (o quale che sia la baseline), per rendere le asserzioni deterministiche.

- [ ] **Step 5: Run**

```bash
npm run smoke:payments
```

Expected: 24+ check passed, exit 0.

Se fallisce, inspezionare l'output ✓/✗ e iterare.

- [ ] **Step 6: `mcp:smoke` invariato**

```bash
npm run mcp:smoke
```

Expected: 5/5 passed.

- [ ] **Step 7: Commit**

```bash
git add scripts/smoke-payments.js
git commit -m "test(smoke-payments): add 3 new scenarios (auth_occ, P.IVA ord, unknown skip)

24+ asserzioni totali. Ogni scenario verifica invoice/payout/
escrowLedger/StripeEvent.withholding.reported. Scenario unknown
verifica skip senza eccezioni + milestone resta planned. Smoke
sub-1 forfettario baseline invariato."
```

---

## Task 11: Aggiornare `CLAUDE.md` e memory

**Objective:** Documentare il nuovo modulo fiscale, il ruolo marketplace "non sostituto", e i 4 regimi. Aggiornare i memory file per l'agente futuro.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `memory/payments_architecture.md`
- Modify: `memory/compliance_rules.md`

- [ ] **Step 1: Aggiungere sezione "Calcolo fiscale ritenuta" a CLAUDE.md**

Dopo la sezione "Pagamenti: Stripe mock vs live", aggiungere:

```markdown
## Calcolo fiscale ritenuta (Sub-2)

Il modulo `lib/tax-calculator.js` è funzione pura `computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode, workerProfileId })`. Il `payment-agent` lo invoca **prima** di `$transaction` con un precheck: se `taxMode === 'unknown'` la milestone viene skippata (resta `planned`), il ciclo mensile continua sulle altre.

**Ruolo marketplace: intermediario puro, non sostituto d'imposta.** L'art. 23 DPR 600/73 identifica il committente (ristorante) come sostituto — la ritenuta 20% la trattiene lui dal pagamento che fa al marketplace, e la versa con F24 cod. 1040. Il marketplace la **registra** (evento `withholding.reported` su `StripeEvent`, colonna `withholdingAmountEur` su Invoice/Payout, entry `withholding_reported` su EscrowLedger) ma **non tocca cash**.

**Matrice sub-2** (gross=1000, fee=100):

| regime                | withholding | totalDue (rist→mkt) | netToWorker (mkt→worker) |
|-----------------------|-------------|---------------------|--------------------------|
| forfettario           | 0           | 1000                | 900                      |
| autonomo_occasionale  | 200         | 800                 | 700                      |
| partita_iva_ordinaria | 200         | 800                 | 700                      |
| unknown               | SKIP        | —                   | —                        |

IVA 22% è out of scope sub-2 → Sub-progetto 6.
```

- [ ] **Step 2: Aggiornare `memory/payments_architecture.md`**

Sostituire la sezione "Stato al 2026-04-17" e "Cosa NON c'è ancora" con qualcosa tipo:

```markdown
**Stato al 2026-04-18 (Sub-progetto 2 done):**

Oltre al sub-1 (vedi sotto), il motore pagamenti ora calcola la ritenuta
d'acconto 20% per regimi non-forfettari. Marketplace = intermediario puro,
NON sostituto d'imposta. La ritenuta è informativa lato piattaforma
(registrata per futuro report F24 al ristorante e DAC7), cash-wise il
ristorante paga già al netto di ritenuta e la versa lui all'Erario.

**Nuovo modulo:** `lib/tax-calculator.js`, funzione pura.
**Nuovo enum value:** `TaxMode.partita_iva_ordinaria`.
**Nuovi campi Invoice:** taxableAmountEur, withholdingRate, withholdingAmountEur, totalDueEur, netToWorkerEur, taxRegimeSnapshot.
**Nuovi campi Payout:** withholdingAmountEur.
**Nuovo campo PaymentOrder:** totalDueEur.
**Nuovo evento StripeEvent:** `withholding.reported` (virtual, consumato da sub-3).
**Nuovo rename:** `grossAmountEur → taxableAmountEur` in tutto il repo.
**Precheck `taxMode=unknown`:** hard-skip milestone, non defaulting.

**Cosa NON c'è ancora:**
- IVA 22% pass-through (Sub-progetto 6).
- Onboarding UI fiscale worker (Sub-progetto 2b).
- Report F24/CU aggregato per ristorante (Sub-progetto 2c).
- Webhook handler che consuma StripeEvent (Sub-progetto 3).
- DAC7 export annuale (Sub-progetto 4).
- Refund flow completo con rimborso ritenuta/IVA pro-quota (Sub-progetto 5).
```

- [ ] **Step 3: Aggiornare `memory/compliance_rules.md`**

Aggiungere punto 6:

```markdown
6. **Marketplace NON è sostituto d'imposta.** TavoloLibero è intermediario puro (art. 23 DPR 600/73). La ritenuta d'acconto 20% la trattiene il ristorante (committente giuridico) dal pagamento che fa al marketplace. Il marketplace la registra per audit/F24-report/DAC7 ma non tocca cash ritenuta. Mai scrivere in UI "trattieni la ritenuta" o "versiamo per te": il marketplace la evidenzia, il ristorante la versa. Vedi skill `finance/commercialista-italiano` §2 per l'inquadramento giuridico.
```

- [ ] **Step 4: Verifica lessico nuovo vs compliance**

```bash
npm run mcp:smoke
```

Expected: 5/5 (compliance-agent validation non rompe).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md memory/payments_architecture.md memory/compliance_rules.md
git commit -m "docs: document sub-2 tax-calculator + marketplace not-substitute rule

CLAUDE.md nuova sezione 'Calcolo fiscale ritenuta' con matrice
4 regimi. payments_architecture aggiornato con stato sub-2 done.
compliance_rules punto 6: marketplace intermediario puro, il
sostituto e il ristorante. Niente UI 'trattieni per te'."
```

---

## Task 12: Final check + smoke end-to-end

**Objective:** Verifica di integrazione finale. Controlli critici tutti verdi. Pulizia branch.

- [ ] **Step 1: Grep di verifica finale**

```bash
# grossAmountEur deve essere zero in tutto il codice (OK se in doc storica sub-1)
grep -rn "grossAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs"
# expected: 0 match

# aliquota 0.20 deve vivere solo in tax-calculator.js
grep -rn "0\\.20" lib/ | grep -v tax-calculator.js
# expected: 0 match (se ne compaiono, sono da astrarre o sono numeri non-ritenuta)

# enum value usato correttamente
grep -rn "partita_iva_ordinaria" --include="*.js" --include="*.prisma" | wc -l
# expected: >= 3 (schema + tax-calculator + smoke)
```

- [ ] **Step 2: Smoke completi**

```bash
npm run smoke:payments
npm run mcp:smoke
```

Expected: 24+/24+ e 5/5. Entrambi exit 0.

- [ ] **Step 3: Migration check**

```bash
npx prisma migrate status
```

Expected: "Database schema is up to date!"

- [ ] **Step 4: `git log` review**

```bash
git log --oneline main..HEAD | head -20
```

Expected: ~10-12 commit del sub-2, dopo i commit del sub-1.

- [ ] **Step 5: Aggiornare roadmap — segnare sub-2 done**

Modificare `memory/payments_roadmap.md` linea "2. ⏭ Sub-progetto 2 — Ritenuta..." in "2. ✅ Sub-progetto 2 — Ritenuta..." e aggiornare la data completamento.

- [ ] **Step 6: Commit finale**

```bash
git add memory/payments_roadmap.md
git commit -m "docs(memory): mark sub-project 2 complete

Ritenuta d acconto 20% per auth_occ e P.IVA ord (IVA sub-6).
Marketplace = intermediario puro (non sostituto).
Smoke payments: 24+/24+; MCP smoke: 5/5.
Next: discussione priorita sub-2b (onboarding UI) vs sub-3
(webhook) vs sub-6 (IVA) con rossima."
```

- [ ] **Step 7: Push (NON fare — l'utente ha detto di committare e pushare solo alla fine di tutti i subproject)**

Skippare il push. Restare sul branch `feat/compliance-mcp`.

---

## Checklist di accettazione finale

Prima di chiudere il sub-2:

- [ ] Tutti i 12 task committati.
- [ ] `npm run smoke:payments` → 24+/24+ ✓
- [ ] `npm run mcp:smoke` → 5/5 ✓
- [ ] `grep -rn "grossAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs"` → 0 match (escluso plan/spec storici)
- [ ] `grep -rn "0\\.20" lib/` → solo `tax-calculator.js`
- [ ] `prisma migrate status` pulito
- [ ] `CLAUDE.md` ha sezione "Calcolo fiscale ritenuta"
- [ ] `memory/compliance_rules.md` ha punto 6 marketplace non-sostituto
- [ ] `memory/payments_architecture.md` e `payments_roadmap.md` aggiornati
- [ ] Working tree clean, branch `feat/compliance-mcp` avanti su main di ~42 commit

**Next**: rossima sceglie tra sub-2b (onboarding fiscale UI), sub-3 (webhook handler) o sub-6 (IVA).

## Remember

```
Task 1 = rename atomico PRIMA di toccare logica.
Task 4 = migration e verifica subito dopo rename.
Precheck taxMode FUORI transaction.
Marketplace non e sostituto: ritenuta e informativa, non cash.
IVA 22% e sub-6, non ora.
Smoke dopo ogni task pesante (5-6 volte totale).
```
