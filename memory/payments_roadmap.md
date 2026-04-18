---
name: Roadmap pagamenti TavoloLibero (sub-progetti 2-6)
description: Sub-progetti "soldi che si muovono" aggiornata 2026-04-18 con sub-6 IVA e sub-2b onboarding
type: project
---

**Stato:** Sub-progetto 1 ✅ completato 2026-04-17. Sub-progetto 2 ✅ completato 2026-04-18 su branch `feat/compliance-mcp`. Smoke `npm run smoke:payments` → 43/43 (4 scenari), `npm run mcp:smoke` → 5/5.

**Decomposizione "soldi che si muovono" aggiornata:**

1. ✅ **Sub-progetto 1 — BankAccount + Stripe mockup + payment-agent idempotente.** Done 2026-04-17. Vedi `payments_architecture.md` e `docs/superpowers/specs/2026-04-17-payments-subproject-1-design.md`.

2. ✅ **Sub-progetto 2 — Ritenuta d'acconto 20%.** Done 2026-04-18.
   - Rename semantico `grossAmountEur → taxableAmountEur` completato (62 occorrenze, 18 file, migration data-preserving).
   - Ritenuta 20% su `autonomo_occasionale` e `partita_iva_ordinaria` via `lib/tax-calculator.js` puro.
   - Marketplace = intermediario puro, NON sostituto d'imposta. Il ristorante è sostituto giuridico (art. 23 DPR 600/73). La ritenuta viene registrata per audit/F24-report/DAC7 ma nessun cash della ritenuta passa dalla piattaforma.
   - Enum `TaxMode` esteso con `partita_iva_ordinaria`. **Scoperta**: `taxMode` vive su `WorkerProfile`, non su `TaxProfile`.
   - Nuovi campi Invoice: `taxableAmountEur, withholdingRate, withholdingAmountEur, totalDueEur, netToWorkerEur, taxRegimeSnapshot`.
   - Nuovi campi Payout: `withholdingAmountEur`.
   - Nuovi campi PaymentOrder: `totalDueEur`.
   - Evento virtuale `stripe.withholding.report()` → StripeEvent(eventType='withholding.reported').
   - EscrowLedger: nuova entry `withholding_reported` quando ritenuta > 0.
   - Precheck `taxMode === 'unknown'` → hard-skip milestone (status=planned), report nel ciclo mensile. `TaxModeUnknownError` con code TAX_MODE_UNKNOWN.
   - Spec: `docs/superpowers/specs/2026-04-18-payments-subproject-2-design.md`.
   - Plan: `docs/superpowers/plans/2026-04-18-payments-subproject-2.md`.

2b. ⏸ **Sub-progetto 2b — Onboarding fiscale worker UI.**
    - Form cameriere per dichiarare regime fiscale (forfettario / autonomo_occasionale / partita_iva_ordinaria).
    - Validazione codice fiscale + P.IVA (algoritmi pubblici).
    - Scrittura su `TaxProfile` (oggi quasi sempre `unknown` in dev).
    - Senza questo, il sub-2 skippa tutto in produzione.
    - Trigger naturale: dopo sub-2 merge.

2c. ⏸ **Sub-progetto 2c — Report F24 + CU aggregato per ristorante.**
    - Aggregazione mensile/annuale della ritenuta trattenuta dal ristorante per ogni worker.
    - Export CSV/PDF con codice tributo 1040, importi, dati worker.
    - Entro il 16 del mese successivo (per F24), entro 16 marzo anno successivo (per CU).
    - Il ristorante deve effettuare il versamento F24 da solo; il marketplace fornisce solo il dato aggregato.

3. **Sub-progetto 3 — Webhook handler (simulato).** Consuma `StripeEvent.status='pending'` → `processed`. Route HTTP `/webhooks/stripe` + processor con retry/DLQ. Trigger manuale per test (non serve HTTP Stripe reale, basta un endpoint admin che "fires" gli eventi pending). Include eventi `withholding.reported` che sub-2 genera.

4. **Sub-progetto 4 — DAC7 reporting.** Flag `reportable` su `Invoice`, export JSON/XML annuo per Agenzia delle Entrate, soglia €2000/30 tx per seller. Richiede `TaxProfile` completo (codice fiscale, IBAN primary, residenza fiscale). Dipende da sub-2b.

5. **Sub-progetto 5 — Split payment completo + Refund flow.** Modellare la quota ristorante-verso-piattaforma distinta dalla quota piattaforma-verso-worker. `Refund` model già in schema, serve il flusso (richiesta → approvazione → reversal payment intent → ledger). Include refund con rimborso ritenuta/IVA pro-quota.

6. ⏸ **Sub-progetto 6 — IVA 22% (NUOVO).**
   - IVA 22% su compensi a `partita_iva_ordinaria`.
   - Modello pass-through puro: ristorante paga `imponibile + IVA − ritenuta` al marketplace; marketplace gira `IVA + netto − fee` al worker; worker versa IVA in LIPE/dichiarazione.
   - Tocca: estensione `tax-calculator.js` con `VAT_RATE_ORDINARY=0.22`, nuovi campi `Invoice.vatRate`, `vatAmountEur`, aggiornamento `totalDueEur` per P.IVA ord.
   - Eventuali edge case: reverse charge (fuori scope — servizi di cameriere non rientrano), aliquote ridotte (fuori scope).
   - Out of scope: fattura elettronica XML FatturaPA, LIPE generation, interazione SdI.

**How to apply:** quando l'utente chiede "riprendi dal Sub-progetto X", leggere prima:
- Questo file (roadmap).
- `memory/payments_architecture.md` (stato corrente).
- `memory/project_state.md` (gap generali).
- `memory/compliance_rules.md` (vincoli giuridici inviolabili).
- `CLAUDE.md` sezione "Pagamenti: Stripe mock vs live".
- Skill `finance/commercialista-italiano` per decisioni fiscali.

Poi avviare il flusso superpowers: `brainstorming` (scope/decisioni) → `writing-plans` → `subagent-driven-development`. Branch dedicato (o continuare su `feat/compliance-mcp` se non ancora mergiato — verificare con `git log main..HEAD`). Riusare il pattern già collaudato: task piccoli, spec review + quality review, commit frequenti, smoke test finale.

**Ordine suggerito di merge (post sub-2):**
1. sub-2b (onboarding) — sblocca sub-2 in produzione.
2. sub-6 (IVA) — completa la fiscalità base.
3. sub-3 (webhook) — consuma StripeEvent.
4. sub-2c (report F24/CU) — dà al ristorante gli strumenti operativi.
5. sub-4 (DAC7) — compliance reporting annuale.
6. sub-5 (refund) — ultimo perché i refund coinvolgono tutti gli altri flussi.
