---
name: Roadmap pagamenti TavoloLibero (sub-progetti 2-5)
description: Sub-progetti "soldi che si muovono" rimanenti dopo il completamento del Sub-progetto 1 il 2026-04-17
type: project
---

**Stato:** Sub-progetto 1 ✅ completato 2026-04-17 su branch `feat/compliance-mcp`. Commit finale `9c8510d`. Smoke `npm run smoke:payments` → 14/14, `npm run mcp:smoke` → 5/5.

**Decomposizione "soldi che si muovono" (presa in brainstorming):**

1. ✅ **Sub-progetto 1 — BankAccount + Stripe mockup + payment-agent idempotente.** Done. Vedi `payments_architecture.md` e `docs/superpowers/specs/2026-04-17-payments-subproject-1-design.md`.

2. ⏭ **Sub-progetto 2 — Ritenuta d'acconto 20% + IVA 22%** (PROSSIMO).
   - Ritenuta 20% su compensi a `autonomo_occasionale` (non forfettari). Trattenuta dal committente, versata all'Erario, certificata al prestatore.
   - IVA 22% su compensi a regimi non-forfettari (se raggiungono soglie IVA).
   - Tocca: `lib/payment-agent.js` (calcolo netto/lordo), schema `Invoice` (aggiungere `withholdingTaxEur`, `vatEur`, `vatRate`), `TaxProfile.taxMode` deve essere affidabile (oggi è `unknown` per quasi tutti → risolvere in questo sub-progetto o rimandare a un sub 2b).
   - Output atteso: invoice mostra imponibile / IVA / ritenuta / netto a pagare; `Payout.payoutAmountEur` = netto post-ritenuta; simulatore `earnings-simulator.js` deve restare allineato.
   - Workflow: brainstorming → spec → plan → subagent-driven-development, come fatto per Sub-progetto 1.

3. **Sub-progetto 3 — Webhook handler (simulato).** Consuma `StripeEvent.status='pending'` → `processed`. Route HTTP `/webhooks/stripe` + processor con retry/DLQ. Trigger manuale per test (non serve HTTP Stripe reale, basta un endpoint admin che "fires" gli eventi pending).

4. **Sub-progetto 4 — DAC7 reporting.** Flag `reportable` su `Invoice`, export JSON/XML annuo per Agenzia delle Entrate, soglia €2000/30 tx per seller. Richiede `TaxProfile` completo (codice fiscale, IBAN primary, residenza fiscale).

5. **Sub-progetto 5 — Split payment completo + Refund flow.** Modellare la quota ristorante-verso-piattaforma distinta dalla quota piattaforma-verso-worker. `Refund` model già in schema, serve il flusso (richiesta → approvazione → reversal payment intent → ledger).

**How to apply:** quando l'utente chiede "riprendi dal Sub-progetto 2", leggere prima:
- Questo file (roadmap).
- `memory/payments_architecture.md` (stato corrente).
- `memory/project_state.md` (gap generali).
- `CLAUDE.md` sezione "Pagamenti: Stripe mock vs live".

Poi avviare il flusso superpowers: `brainstorming` (scope/decisioni tasse+IVA) → `writing-plans` → `subagent-driven-development`. Branch dedicato (o continuare su `feat/compliance-mcp` se non ancora mergiato — verificare con `git log main..HEAD`). Riusare il pattern già collaudato: task piccoli, spec review + quality review, commit frequenti, smoke test finale.
