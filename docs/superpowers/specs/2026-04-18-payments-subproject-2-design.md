# Spec — Payments Sub-project 2: Ritenuta d'acconto 20%

Data: 2026-04-18
Autore: Claude + rossima (brainstorming) + skill `finance/commercialista-italiano` (applicata)
Status: approvato, pronto per piano di implementazione

## Obiettivo

Aggiungere al motore pagamenti il calcolo della **ritenuta d'acconto 20%** per worker in regime `autonomo_occasionale` e `partita_iva_ordinaria`. Il marketplace calcola e registra la ritenuta (per reporting F24 al ristorante e futuro DAC7) ma **non la trattiene**: è il ristorante (sostituto d'imposta) che la trattiene dal pagamento e la versa all'Erario.

IVA 22% è stata **spostata al Sub-progetto 6** (decisione rossima + analisi complessità).

## Contesto giuridico (dalla skill `commercialista-italiano`)

- **Ruolo marketplace TavoloLibero**: intermediario puro, NON Merchant of Record. Confermato da `CLAUDE.md` (compliance rules §3): "Il ristorante paga la piattaforma, che trattiene fee e versa netto al freelance. Mai flussi in cui la piattaforma paga direttamente come datore."
- **Committente giuridico della prestazione**: ristorante. Contratto ex art. 2222 C.c. direttamente tra cameriere e ristorante.
- **Sostituto d'imposta**: ristorante (art. 23 DPR 600/73). Marketplace NON è sostituto.
- **Flusso cassa reale**: il ristorante paga al marketplace l'importo **già al netto della ritenuta** che lui ha trattenuto come sostituto. Il marketplace gira al worker tale importo meno la commissione piattaforma.
- **Obblighi F24/CU**: restano in capo al ristorante (versamento F24 cod. 1040 entro il 16 del mese successivo, CU al worker entro 16 marzo anno successivo). Il marketplace dovrà (in sub futuro) produrre un report aggregato per aiutare il ristorante a compilare F24/CU.

## Contesto tecnico

Stato (vedi `memory/payments_architecture.md`, chiuso sub-1 il 2026-04-17):

- `lib/payment-agent.js` genera milestone + PaymentOrder + Invoice + Payout in `prisma.$transaction`, con idempotency key `milestone-<id>-<op>`.
- Il mock Stripe (`lib/stripe-mock.js`) scrive ogni side-effect su `StripeEvent(status='pending')`.
- Calcolo attuale: `amountTotalEur = milestone.grossAmountEur`, `platformFeeEur` da input, `payoutAmountEur = gross − fee`. Nessuna differenziazione fiscale.
- `TaxProfile.taxMode` è `enum TaxMode { forfettario | autonomo_occasionale | unknown }`.

## Scope

### In scope

1. **Rename semantico**: `grossAmountEur` → `taxableAmountEur` in `ContractMilestone`, `PaymentOrder` (`amountTotalEur` resta — significa imponibile totale del PaymentOrder), nei service, nei template EJS, nei seed, nei PDF. Questo allinea il nome al significato reale: il campo è sempre stato l'imponibile (pre-IVA, pre-ritenuta), il rename lo rende esplicito prima di complicarci con nuovi campi fiscali.
2. **Estensione `enum TaxMode`** con `partita_iva_ordinaria`.
3. **Nuove colonne su `Invoice`**: `withholdingRate`, `withholdingAmountEur`, `totalDueEur`, `netToWorkerEur`, `taxRegimeSnapshot`.
4. **Nuove colonne su `Payout`**: `withholdingAmountEur` (registrata ma non cash del marketplace).
5. **Nuova colonna su `PaymentOrder`**: `totalDueEur` (quanto il ristorante ha versato al marketplace = imponibile − ritenuta se dovuta).
6. **Nuovo modulo `lib/tax-calculator.js`** — funzione pura `computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode })` con calcoli puliti e test di unità.
7. **Refactor `lib/payment-agent.js`**:
   - carica `workerProfile.taxProfile.taxMode`;
   - **precheck fuori transazione**: se `taxMode === 'unknown'` → skip milestone, non entra in `$transaction`, log e ritorno nel report (hard-fail del singolo task, soft-continua il ciclo mensile);
   - invoca `computeInvoiceTaxes`;
   - popola i nuovi campi;
   - amount di `stripe.paymentIntents.create` diventa `totalDueEur` (imponibile − ritenuta);
   - scrive `StripeEvent` simbolico `withholding.reported` (nome cambiato da `accrued` a `reported` per rifletterne il ruolo: siamo intermediario, registriamo, non incassiamo) per ogni Invoice con `withholdingAmountEur > 0`.
8. **Aggiornamento `scripts/smoke-payments.js`** con 4 scenari: forfettario (happy path, numeri invariati), autonomo_occasionale (ritenuta 20%), partita_iva_ordinaria (ritenuta 20% senza IVA — IVA in sub-6), unknown (skip).
9. **Aggiornamento `CLAUDE.md`** con sezione "Calcolo fiscale ritenuta" + chiarimento ruolo marketplace (non sostituto d'imposta).
10. **Aggiornamento memory**: `payments_architecture.md`, `payments_roadmap.md`, `compliance_rules.md` (aggiungere punto "marketplace non è sostituto d'imposta").

### Out of scope

- **IVA 22%** → Sub-progetto 6 (NUOVO). Vedi roadmap aggiornata.
- **Onboarding fiscale UI worker** → Sub-progetto 2b.
- **Report F24 aggregato per ristorante** → Sub-progetto 2c.
- **Generazione XML CU annuale** → Sub-progetto 4 (DAC7) + 2c (CU).
- **INPS gestione separata** (soglia €5.000, ⅔-⅓) → Sub-progetto futuro dedicato.
- **Fattura elettronica SdI** → fuori scope roadmap attuale (è un tema infrastrutturale separato).
- **Refund parziali con rimborso ritenuta** → Sub-progetto 5.
- **Storia e migration di `grossAmountEur → taxableAmountEur` negli EarningsScenario** se non è strettamente necessario (da valutare caso per caso nel plan).
- **Simulatore `earnings-simulator.js`**: nessuna modifica (scelta rossima — solo marketing, solo forfettario).

## Decisioni di design

### D1 — Rename `grossAmountEur` → `taxableAmountEur`

Il campo è sempre stato semanticamente l'imponibile (il compenso concordato, prima di qualsiasi tassa). In forfettario "gross" = "totale fattura" = imponibile (esente IVA, no ritenuta). In auth_occ/P.IVA "gross" = "compenso lordo" = imponibile (pre-IVA, pre-ritenuta). Il nome "gross" era ambiguo — in inglese significa "lordo di tutto" ma qui significava "lordo di ritenuta" che per un forfettario è identico al totale. Con l'arrivo dei regimi non-forfettari il nome confonde. Meglio rinominare ora, una volta, con un task dedicato.

**Blast radius**: 62 occorrenze in 18 file (JS, EJS, JS pubblici, seed, schema, doc, spec, plan). Tutte literal, nessuna dinamica. Task 1 del plan = rename atomico con commit dedicato, prima di ogni altro lavoro.

**Motivo**: l'utente (rossima) ha espressamente chiesto il rename subito, per evitare confusioni future. Allinea nome e semantica.

### D2 — Marketplace NON è sostituto d'imposta

Il marketplace **non trattiene cash per la ritenuta**. La ritenuta la trattiene il ristorante (sostituto giuridico) dal pagamento che fa al marketplace. Il marketplace riceve quindi già `taxableEur − withholding`. Di questo, trattiene la fee (calcolata sull'imponibile, D4) e gira al worker il resto.

**Derivazione cassa**:
```
totalDueEur = taxableEur − withholdingEur   (il ristorante paga questo al marketplace)
netToWorkerEur = totalDueEur − platformFeeEur   (quello che il marketplace gira al worker)
```

Il campo `Invoice.withholdingAmountEur` serve a:
1. Fare da audit trail ("quanta ritenuta il ristorante ha trattenuto per questo worker questo mese").
2. Base per il report F24 aggregato al ristorante (sub-2c futuro).
3. Base per CU annuale worker e DAC7 (sub-4).

**Evento `StripeEvent`**: nome cambiato da `withholding.accrued` (usato nella bozza v1) a `withholding.reported` per riflettere il ruolo informativo, non cash.

**Motivo**: applicazione diretta della procedura decisionale della skill `commercialista-italiano` §2 "Caso piattaforma digitale" (marketplace intermediario puro → NON sostituto). Confermato anche da `CLAUDE.md` compliance rules §3 (split payment via Stripe Connect, mai flussi "come datore").

**Validazione futura richiesta**: prima di andare in produzione, far validare il modello a un commercialista iscritto. Disclaimer esplicito in `memory/compliance_rules.md`.

### D3 — IVA 22% rimandata a Sub-progetto 6

Decisione rossima: l'IVA ha complessità proprie (pass-through al worker, reverse charge edge cases, LIPE, fattura elettronica SdI con `<DatiRiepilogo>`) che meritano sub dedicato. Sub-2 si concentra su ritenuta; sub-6 aggiungerà IVA con modello pass-through puro (ristorante paga imponibile + IVA − ritenuta, marketplace gira IVA al worker insieme al netto).

Conseguenza su sub-2: per `partita_iva_ordinaria` calcoliamo solo ritenuta 20%. I numeri saranno identici a `autonomo_occasionale`. Differenza solo in `taxRegimeSnapshot`. Quando arriverà sub-6, si aggiungeranno campi IVA e la matrice si differenzierà.

### D4 — Fee piattaforma calcolata sull'imponibile

`platformFeeEur` si calcola su `taxableAmountEur`, non su `totalDueEur`. La piattaforma addebita il servizio (imponibile), non il "giro fiscale".

**Motivo**: se la fee fosse sul totale, crescerebbe artificiosamente con l'IVA (quando arriverà) o scenderebbe con la ritenuta, penalizzando ingiustamente certi regimi. Neutralità fiscale della fee.

### D5 — `taxMode === 'unknown'` = hard fail della singola milestone

Se al momento della fatturazione il worker ha `taxProfile` mancante o `taxMode=unknown`, `createBillingArtifactsForMilestone` **non entra** in `$transaction`: viene saltato con `skip.reason = 'TAX_MODE_UNKNOWN'`, la milestone resta `planned`. Il ciclo mensile continua sugli altri worker; il report finale elenca gli skippati.

**Motivo**: sicurezza fiscale (no defaulting silenzioso che genera obblighi retroattivi) + pressione ad attivare il Sub-2b (onboarding). Hard-fail del singolo task, soft-continua del batch: scelta utente, confermata.

### D6 — Snapshot regime su Invoice

`Invoice.taxRegimeSnapshot` congela la stringa del regime al momento dell'emissione. Se il worker cambia regime in futuro, le fatture storiche continuano a riflettere il regime al momento.

**Motivo**: audit fiscale + coerenza PDF/UI + necessario per CU annuale (che deve riportare il regime al momento del compenso).

### D7 — `tax-calculator.js` funzione pura, no side-effect

Nessuna chiamata a DB, nessun log. Signature `computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode })` → oggetto plain. Pura, unit-testabile senza mock Prisma. Il payment-agent la invoca e persiste.

**Motivo**: stesso pattern di `lib/iban.js` in sub-1. KISS, testabile, zero dipendenze.

### D8 — Aliquote hardcoded con costanti esportate

`WITHHOLDING_RATE = 0.20`. Esportata dal modulo per riuso. Non configurabile via env.

**Motivo**: YAGNI; l'aliquota 20% è stabile da decenni; una modifica richiede redesign legale, non flip env. `VAT_RATE_ORDINARY = 0.22` sarà aggiunta in sub-6.

## Matrice fiscale (sub-2, senza IVA)

Dato `taxableEur` (imponibile concordato) e `platformFeeEur`:

| regime                 | withholdingRate | withholdingEur        | totalDueEur (ristorante→mkt) | netToWorkerEur (mkt→worker) |
|------------------------|-----------------|-----------------------|------------------------------|-----------------------------|
| forfettario            | 0               | 0                     | taxableEur                   | taxableEur − fee            |
| autonomo_occasionale   | 0.20            | taxableEur × 0.20     | taxableEur − withholding     | totalDue − fee              |
| partita_iva_ordinaria  | 0.20            | taxableEur × 0.20     | taxableEur − withholding     | totalDue − fee              |
| unknown                | —               | —                     | SKIP                         | SKIP                        |

(In sub-6 si aggiungerà `vatAmountEur` e `totalDueEur` diventerà `taxableEur + vat − withholding` per P.IVA ordinaria.)

Arrotondamenti a 2 decimali con helper `money()` già presente in payment-agent (consolidarlo in `lib/money.js` o duplicarlo? → nel plan: estrarre in `lib/money.js` come task preliminare se risulta pulito).

**Esempio forfettario** `taxableEur=1000, fee=100`:
- withholding=0, totalDue=1000, netToWorker=900. **Invariato rispetto a pre-sub-2**.

**Esempio autonomo_occasionale** `taxableEur=1000, fee=100`:
- withholding=200, totalDue=800, netToWorker=700.
- Il ristorante versa 800 al marketplace. Trattiene lui 200 e li versa con F24 1040 entro il 16 del mese successivo.
- Marketplace trattiene 100 di fee, gira 700 al worker.

**Esempio P.IVA ordinaria** (senza IVA in sub-2) `taxableEur=1000, fee=100`:
- withholding=200, totalDue=800, netToWorker=700. **Identici ad autonomo_occasionale in sub-2.**
- `taxRegimeSnapshot='partita_iva_ordinaria'` — distinguibile in report.
- Sub-6 aggiungerà `vatAmountEur=220`, e `totalDueEur` diventerà `1000 + 220 − 200 = 1020`, `netToWorkerEur = 1020 − 100 = 920`.

## Schema dettagliato

### `enum TaxMode` — estensione

```prisma
enum TaxMode {
  forfettario
  autonomo_occasionale
  partita_iva_ordinaria   // NEW
  unknown
}
```

### `model ContractMilestone` — rename

```prisma
model ContractMilestone {
  // ...
  taxableAmountEur Float   // renamed from grossAmountEur
  // ...
}
```

### `model Invoice` — estensione

```prisma
model Invoice {
  // ... campi esistenti ...
  taxableAmountEur      Float?   // = imponibile (nullable per back-compat su invoice pre-sub-2)
  withholdingRate       Float   @default(0)
  withholdingAmountEur  Float   @default(0)
  totalDueEur           Float?   // pagato dal ristorante al marketplace
  netToWorkerEur        Float?   // trasferito dal marketplace al worker
  taxRegimeSnapshot     String?  // 'forfettario' | 'autonomo_occasionale' | 'partita_iva_ordinaria'
  // amountEur resta = taxableAmountEur per back-compat; deprecato logicamente.
}
```

### `model Payout` — estensione

```prisma
model Payout {
  // ... campi esistenti ...
  withholdingAmountEur  Float   @default(0)   // informativo, non cash del marketplace
  // payoutAmountEur resta e ora significa "netToWorkerEur".
}
```

### `model PaymentOrder` — estensione

```prisma
model PaymentOrder {
  // ... campi esistenti ...
  totalDueEur  Float?   // = invoice.totalDueEur; è quanto il ristorante ha versato al marketplace
}
```

**Nota**: `amountTotalEur` esistente continua a significare "imponibile" (coerente con D1 rename). Non viene toccato.

## API modulo `tax-calculator`

```javascript
// lib/tax-calculator.js

const WITHHOLDING_RATE = 0.20;

class TaxModeUnknownError extends Error {
  constructor(workerProfileId) {
    super(`Cannot bill worker ${workerProfileId}: taxMode is unknown or missing. Complete onboarding first.`);
    this.code = 'TAX_MODE_UNKNOWN';
    this.workerProfileId = workerProfileId;
  }
}

function computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode }) {
  // Returns:
  // {
  //   taxableAmountEur,
  //   withholdingRate, withholdingAmountEur,
  //   totalDueEur,        // ristorante → marketplace
  //   netToWorkerEur,     // marketplace → worker
  //   platformFeeEur,     // marketplace trattiene
  //   taxRegimeSnapshot,
  // }
}

module.exports = { computeInvoiceTaxes, WITHHOLDING_RATE, TaxModeUnknownError };
```

Regole di calcolo:

```
forfettario:
  withholdingRate = 0
  withholdingAmountEur = 0
  totalDueEur = taxableEur
  netToWorkerEur = taxableEur − platformFeeEur

autonomo_occasionale | partita_iva_ordinaria:
  withholdingRate = 0.20
  withholdingAmountEur = money(taxableEur * 0.20)
  totalDueEur = money(taxableEur - withholdingAmountEur)
  netToWorkerEur = money(totalDueEur - platformFeeEur)

unknown | null | undefined:
  throw TaxModeUnknownError(workerProfileId)

INPUT VALIDATION:
- taxableEur <= 0  → TypeError
- platformFeeEur < 0 → TypeError
- platformFeeEur > taxableEur → RangeError (fee impossibile)
- taxMode non in enum → TypeError
```

## Integrazione payment-agent

### Precheck (fuori transazione)

In `runMonthlyBillingCycle` / `createBillingArtifactsForMilestone`, prima del `prisma.$transaction`:

```javascript
const worker = await prisma.workerProfile.findUnique({
  where: { id: contract.workerProfileId },
  include: { taxProfile: true }
});

const taxMode = worker?.taxProfile?.taxMode;
if (!taxMode || taxMode === 'unknown') {
  console.log(`[payment-agent] SKIP milestone ${milestone.id}: worker ${worker?.id} taxMode unknown`);
  return { skipped: true, reason: 'TAX_MODE_UNKNOWN', milestoneId: milestone.id, workerProfileId: worker?.id };
}
```

### createBillingArtifactsForMilestone (pseudocodice delta)

```
PRIMA:
  paymentOrder.amountTotalEur = milestone.grossAmountEur
  paymentOrder.platformFeeEur = milestone.platformFeeEur
  paymentOrder.payoutAmountEur = gross − fee
  stripe.paymentIntents.create({ amount_cents: amountTotalEur * 100 })

DOPO:
  // precheck gestito fuori: qui taxMode è valido
  taxes = computeInvoiceTaxes({
    taxableEur: milestone.taxableAmountEur,   // era grossAmountEur
    platformFeeEur: milestone.platformFeeEur,
    taxMode: worker.taxProfile.taxMode
  })

  paymentOrder.amountTotalEur = taxes.taxableAmountEur  // invariato nome/semantica
  paymentOrder.platformFeeEur = taxes.platformFeeEur
  paymentOrder.payoutAmountEur = taxes.netToWorkerEur   // nuovo calcolo
  paymentOrder.totalDueEur = taxes.totalDueEur          // nuovo campo

  stripe.paymentIntents.create({
    amount_cents: Math.round(taxes.totalDueEur * 100),      // CAMBIATO: quanto il ristorante paga
    application_fee_amount: Math.round(taxes.platformFeeEur * 100),
    idempotencyKey: `milestone-${milestone.id}-create`
  })

  invoice = {
    amountEur: taxes.taxableAmountEur,          // back-compat
    taxableAmountEur: taxes.taxableAmountEur,
    withholdingRate: taxes.withholdingRate,
    withholdingAmountEur: taxes.withholdingAmountEur,
    totalDueEur: taxes.totalDueEur,
    netToWorkerEur: taxes.netToWorkerEur,
    taxRegimeSnapshot: taxes.taxRegimeSnapshot,
    // resto invariato
  }

  se taxes.withholdingAmountEur > 0:
    stripeMock scrive StripeEvent({
      eventType: 'withholding.reported',         // cambiato da 'accrued' a 'reported'
      providerEventId: `evt_mock_wh_${invoice.id}`,
      payload: {
        invoiceId: invoice.id,
        workerProfileId: worker.id,
        restaurantProfileId: contract.restaurantProfileId,
        amountEur: taxes.withholdingAmountEur,
        rate: taxes.withholdingRate,
        taxRegime: taxes.taxRegimeSnapshot,
        // per futuro F24: il ristorante è sostituto
      }
    })
```

### captureDuePaymentOrders (delta)

```
stripe.paymentIntents.capture(providerPaymentIntentId)   // invariato
stripe.transfers.create({
  amount: Math.round(order.payoutAmountEur * 100),       // ora è netto post-ritenuta, post-fee
  destination: worker.stripeAccountId,
  idempotencyKey: `milestone-${milestone.id}-transfer`
})

Payout update:
  withholdingAmountEur = invoice.withholdingAmountEur
  payoutAmountEur = invoice.netToWorkerEur               // invariato nome, nuovo calcolo

EscrowLedger entries (coerenti con taxes):
  { entryType: 'capture',            amountEur: totalDueEur }         // CAMBIATO: era amountTotalEur
  { entryType: 'platform_fee',       amountEur: platformFeeEur }      // invariato
  { entryType: 'worker_payout',      amountEur: netToWorkerEur }      // invariato nome, nuovo valore
  se withholding > 0:
    { entryType: 'withholding_reported', amountEur: withholdingAmountEur, metadata: { regime, sostituto: 'restaurant' } }  // nuovo
```

## Smoke test

`scripts/smoke-payments.js` estensione da 14 check (solo forfettario) a 24+ (4 scenari).

Setup: il seed deve avere 3 worker con 3 taxMode diversi + 1 worker con taxMode=unknown. Se il seed attuale ha tutti forfettari, lo smoke patcha via upsert `TaxProfile` senza toccare il seed globale (pattern locale, non modifica base dati shared).

### Scenario 1: forfettario
- `taxableEur=1000, fee=100`
- Asserzioni: invoice.withholdingAmountEur=0, invoice.totalDueEur=1000, invoice.netToWorkerEur=900, payout.payoutAmountEur=900, NO StripeEvent withholding.reported.

### Scenario 2: autonomo_occasionale
- `taxableEur=1000, fee=100`
- Asserzioni: invoice.withholdingAmountEur=200, invoice.totalDueEur=800, invoice.netToWorkerEur=700, payout.withholdingAmountEur=200, payout.payoutAmountEur=700, StripeEvent withholding.reported presente, escrowLedger.count=4 (include withholding_reported).

### Scenario 3: partita_iva_ordinaria (senza IVA)
- `taxableEur=1000, fee=100`
- Asserzioni: come scenario 2 + `invoice.taxRegimeSnapshot === 'partita_iva_ordinaria'`.
- Commento nel codice smoke: "IVA 22% sarà testata in sub-6; per ora P.IVA si comporta come autonomo_occasionale".

### Scenario 4: unknown (negativo)
- Worker con taxMode=unknown
- `runMonthlyBillingCycle` ritorna `{ processed: [...], skipped: [{ milestoneId: X, reason: 'TAX_MODE_UNKNOWN', workerProfileId: Y }] }`
- milestone resta `planned`
- Nessuna invoice/paymentOrder creati per quel worker
- Nessuna eccezione propagata al caller

Output formato smoke-compliance (✓/✗), exit 0/1/2.

## Validazione compliance MCP

Prima di commit finale, `npm run mcp:smoke` deve continuare a passare 5/5. In più chiamare mentalmente `validate_marketplace_legal_docs` su:
- Messaggio `TaxModeUnknownError`: "Cannot bill worker X: taxMode is unknown" — terminologia fiscale, OK.
- Nuovi `entryType` escrow: `withholding_reported` — neutro, OK.
- Campi `taxRegimeSnapshot`: codici enum, OK.

Nessuna stringa user-facing in sub-2 (tutto tecnico). UX toccherà sub-2b.

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Rename `grossAmountEur → taxableAmountEur` rompe view EJS o JS pubblici che leggono API response | Task 1 dedicato al rename con grep esaustivo + smoke test dopo; 62 occorrenze in 18 file, tutte literal |
| Semantica "marketplace non sostituto" sbagliata se un domani Stripe Connect diventa MOR | `CLAUDE.md` e `memory/compliance_rules.md` aggiornati a chiarire che il modello è "intermediario puro"; il giorno che si passa a MOR serve sub dedicato |
| Contratti/milestone esistenti nel dev.db con `grossAmountEur` → migration deve rinominare la colonna | Prisma migrate gestisce il rename via @map se serve; altrimenti migration manuale ALTER TABLE ... RENAME COLUMN; sqlite supporta da 3.25+ |
| Seed esistente usa `grossAmountEur` | Task 1 lo rinomina in `prisma/seed.js`; `npm run db:seed` deve continuare a girare |
| `TaxMode` enum extension rompe invocazioni esistenti (switch exhaustive) | Grep `taxMode` per trovare punti che matchano — in sub-1 sono 4 occorrenze in contract-agent: sono solo letture, non switch |
| Ritenuta pensata sul netto IVA (realtà P.IVA) ma in sub-2 non c'è IVA → numero sbagliato in sub-6 se non attento | Sub-6 dovrà ricalcolare `withholdingAmountEur` sull'imponibile pre-IVA (che in quello schema sarà `taxableAmountEur`, già campo nostro — coerente); commento nel `tax-calculator` che documenta questo invariante |
| Worker in produzione tutti con `taxMode=unknown` → ciclo mensile salta tutto | Previsto in sub-2b (onboarding); per dev, smoke patcha i fixture |
| Calcolo fiscale sbagliato in edge case (importi minuscoli, arrotondamenti) | Unit test puri su `tax-calculator.js`: 4 scenari × input base + negativi + boundary (taxable=1, fee=0; taxable=1000000; fee=taxable) |

## Criteri di accettazione

1. `npx prisma migrate dev` applica migration additiva + rename su dev.db esistente senza errori e senza perdita dati.
2. `npm run smoke:payments` esce 0 con 24+ check passati sui 4 scenari.
3. `npm run mcp:smoke` continua a passare 5/5.
4. `grep -rn "grossAmountEur" --include="*.js" --include="*.prisma" --include="*.ejs" --include="*.md"` ritorna 0 occorrenze in code (solo in doc storica sub-1 è ammesso).
5. `grep -rn "0\\.20" lib/ scripts/ | grep -v tax-calculator.js | grep -v smoke-` ritorna 0 (aliquota solo in tax-calculator).
6. Unit test (via smoke-payments in-script) copre: 3 regimi happy path, 3 tipi di input invalido, 1 case unknown throw.
7. `CLAUDE.md` aggiornato con sezione "Calcolo fiscale ritenuta" + chiarimento marketplace ≠ sostituto d'imposta.
8. `memory/payments_architecture.md`, `memory/payments_roadmap.md`, `memory/compliance_rules.md` aggiornati con stato sub-2 done + nuovo sub-6 IVA.
9. Nessun regresso in compliance-agent, contract-agent, earnings-simulator (il rename tocca solo variabili di input, non logica).

## Files

**Create:**
- `prisma/migrations/<timestamp>_rename_taxable_and_add_withholding/migration.sql`
- `lib/tax-calculator.js`
- (eventuale) `lib/money.js` — solo se emerge duplicazione pulita da estrarre nel plan, altrimenti duplicare inline come adesso.

**Modify (rename + sub-2 logic):**
- `prisma/schema.prisma` — enum TaxMode, rename ContractMilestone.grossAmountEur, estensioni Invoice/Payout/PaymentOrder
- `prisma/seed.js` — rename field
- `lib/payment-agent.js` — precheck taxMode, integrazione tax-calculator, aggiornamento escrow entries, StripeEvent withholding.reported
- `lib/compliance-agent.js` — rename (leggere, non logica)
- `lib/contract-agent.js` — rename (leggere, non logica)
- `lib/stripe-mock.js` — eventualmente helper per scrivere eventi withholding.reported (o gestito da payment-agent, da decidere in plan)
- `routes/cameriere.js`, `routes/ristorante.js`, `routes/admin.js`, `routes/api.js` — rename field nei payload
- `views/pages/cameriere/contratti-lunghi.ejs`, `views/pages/ristorante/contratti-lunghi.ejs` — rename variabile template
- `public/js/long-contract-page.js`, `public/js/admin-legal-billing.js` — rename
- `mcp/tools/check-fornero-compliance.js` — rename
- `scripts/smoke-payments.js` — 3 nuovi scenari + scenario unknown skip
- `CLAUDE.md` — sezione calcolo fiscale ritenuta + nota marketplace non sostituto
- `memory/payments_architecture.md` — aggiornare stato
- `memory/payments_roadmap.md` — chiudere sub-2, apertura sub-6
- `memory/compliance_rules.md` — punto 6: "marketplace non è sostituto d'imposta"
- `docs/superpowers/plans/2026-04-17-payments-subproject-1.md` — NO modifica (doc storica)
- `docs/superpowers/specs/2026-04-18-payments-subproject-2-design.md` — questo file

## Prossimi passi

1. Piano di implementazione in `docs/superpowers/plans/2026-04-18-payments-subproject-2.md` (bite-sized tasks, Task 1 = rename atomico).
2. Esecuzione via `subagent-driven-development`, un task alla volta con spec compliance + code quality review.
3. Dopo merge sub-2: discussione priorità tra sub-2b (onboarding UI fiscale), sub-3 (webhook handler), sub-6 (IVA 22%).
