---
name: Architettura pagamenti TavoloLibero
description: Come funziona il flusso soldi oggi (Sub-progetto 1 + 2 completati), cosa manca, estensioni programmate
type: project
---

**Stato al 2026-04-18 (Sub-progetto 2 done):**

Il motore pagamenti calcola la ritenuta d'acconto 20% per regimi non-forfettari in modo fedele al modello giuridico: **marketplace intermediario puro, non sostituto d'imposta**. Il ristorante resta sostituto giuridico (art. 23 DPR 600/73), trattiene la ritenuta dal pagamento che fa alla piattaforma, e la versa con F24 cod. 1040.

**Punti chiave sub-1 + sub-2:**

- **Factory**: `lib/stripe.js` — `STRIPE_MODE=mock|live`, default mock. Importare sempre da qui, mai direttamente da `stripe-mock.js` o `stripe`.
- **Mock**: `lib/stripe-mock.js` — SDK-compatible + namespace virtuale `withholding.report()` per evento fiscale.
- **BankAccount**: multi-IBAN per owner (worker/restaurant), `isPrimary` uno solo per owner mantenuto in transaction. Soft-delete via `status='archived'`.
- **Tax-calculator**: `lib/tax-calculator.js` — funzione pura `computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode, workerProfileId })`. Ritorna imponibile, ritenuta, totalDue (ristorante→mkt), netToWorker (mkt→worker), snapshot regime. `TaxModeUnknownError` con code `TAX_MODE_UNKNOWN` se regime sconosciuto.
- **Payment-agent precheck**: `lib/payment-agent.js` legge `workerProfile.taxMode` FUORI dalla transazione. Se `unknown` → skip della milestone (status `planned`), ciclo mensile continua e ritorna `{ createdCount, skippedCount, skipped: [{ milestoneId, reason, workerProfileId }] }`.
- **Schema fiscale reale**: `taxMode` vive su `WorkerProfile`, NON su `TaxProfile` (TaxProfile ha solo metriche aggregate annualGrossYtdEur/riskBand).
- **StripeEvent**: tabella append-only, `status=pending`. Eventi nuovi sub-2: `withholding.reported` (virtuale, non-Stripe-native, con payload `{ invoiceId, workerProfileId, restaurantProfileId, amountEur, rate, taxRegime, sostitutoImposta: 'restaurant' }`).
- **Invoice sub-2 fields**: `taxableAmountEur`, `withholdingRate`, `withholdingAmountEur`, `totalDueEur`, `netToWorkerEur`, `taxRegimeSnapshot`. Back-compat: `amountEur` conservato = imponibile.
- **Payout sub-2**: aggiunto `withholdingAmountEur` (informativo, non cash del marketplace). `payoutAmountEur` continua a significare "netto al worker" ma ora il calcolo è post-ritenuta.
- **PaymentOrder sub-2**: aggiunto `totalDueEur` (quanto il ristorante paga effettivamente al marketplace). `amountTotalEur` resta = imponibile (semantica invariata).
- **Rename chirurgico**: `grossAmountEur → taxableAmountEur` in tutto il repo (ServiceContract, ContractMilestone, agents, routes, views, PDF Python). 62 occorrenze rinominate, migration data-preserving.

**Matrice fiscale** (taxable=1000, fee=100):

| regime                | withholding | totalDue | netToWorker | escrowEntries |
|-----------------------|-------------|----------|-------------|---------------|
| forfettario           | 0           | 1000     | 900         | 3             |
| autonomo_occasionale  | 200         | 800      | 700         | 4 (+wh_rep)   |
| partita_iva_ordinaria | 200         | 800      | 700         | 4 (+wh_rep)   |
| unknown               | SKIP        | —        | —           | —             |

**Cosa NON c'è ancora:**

- IVA 22% pass-through (Sub-progetto 6).
- Onboarding UI fiscale worker (Sub-progetto 2b) — oggi `taxMode` è settato solo da seed e lo smoke lo patcha runtime.
- Report F24 + CU aggregato per ristorante (Sub-progetto 2c).
- Webhook handler che consuma `StripeEvent.status=pending` → `processed` (Sub-progetto 3). Include consumption di `withholding.reported`.
- DAC7 `reportable` flag + export annuale (Sub-progetto 4).
- Refund flow completo con rimborso ritenuta/IVA pro-quota (Sub-progetto 5).

**Smoke tests:**

- `npm run smoke:payments` → 43/43 (4 scenari: forfettario, auth_occ, P.IVA ord, unknown skip).
- `npm run mcp:smoke` → 5/5 (compliance, invariato).

**How to apply:** quando tocchi codice payment:
- Importa Stripe da `lib/stripe`, mai da `stripe-mock` direttamente.
- Per calcolo fiscale, invoca `lib/tax-calculator` (funzione pura). Non replicare la matrice altrove.
- Se aggiungi un regime all'enum `TaxMode`, aggiorna `computeInvoiceTaxes` + smoke-payments.
- Il campo `taxMode` vive su `WorkerProfile`, non su `TaxProfile`.
- Nelle UI/PDF mai scrivere "la piattaforma trattiene la ritenuta" — il marketplace la evidenzia, il ristorante la versa.
- Prima di andare in produzione: validazione vincolante commercialista iscritto.

Ragionamento fiscale completo in skill `finance/commercialista-italiano`.
