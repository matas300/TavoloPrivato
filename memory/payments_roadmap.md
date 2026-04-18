---
name: Roadmap pagamenti TavoloLibero (sub-progetti 2-6)
description: Sub-progetti "soldi che si muovono" aggiornata 2026-04-18 con sub-6 IVA e sub-2b onboarding
type: project
---

**Stato:** Sub-progetto 1 ✅ completato 2026-04-17 su branch `feat/compliance-mcp`. Commit finale `9c8510d`. Smoke `npm run smoke:payments` → 14/14, `npm run mcp:smoke` → 5/5.

**Decomposizione "soldi che si muovono" aggiornata:**

1. ✅ **Sub-progetto 1 — BankAccount + Stripe mockup + payment-agent idempotente.** Done. Vedi `payments_architecture.md` e `docs/superpowers/specs/2026-04-17-payments-subproject-1-design.md`.

2. ⏭ **Sub-progetto 2 — Ritenuta d'acconto 20%** (IN CORSO).
   - **SCOPE RIDOTTO**: solo ritenuta 20%. IVA spostata a sub-6 per complessità.
   - **Rename semantico**: `grossAmountEur → taxableAmountEur` (62 occorrenze, task dedicato).
   - Ritenuta 20% su compensi a `autonomo_occasionale` e `partita_iva_ordinaria`.
   - **Ruolo marketplace**: intermediario puro, NON sostituto d'imposta. Il ristorante è sostituto (art. 23 DPR 600/73). Marketplace calcola e registra la ritenuta ma non la trattiene cash. Vedi skill `finance/commercialista-italiano`.
   - Enum `TaxMode` esteso con `partita_iva_ordinaria`.
   - Tocca: `lib/payment-agent.js`, `lib/tax-calculator.js` (nuovo), schema `Invoice`/`Payout`/`PaymentOrder` (colonne ritenuta + totalDue + snapshot regime + rename).
   - Precheck: `taxMode === 'unknown'` → hard-skip della milestone, report nel ciclo mensile.
   - Out of scope: IVA (sub-6), onboarding UI (sub-2b), INPS gestione separata, fattura elettronica SdI, CU annuale.
   - Spec: `docs/superpowers/specs/2026-04-18-payments-subproject-2-design.md`.

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
