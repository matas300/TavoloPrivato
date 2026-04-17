---
name: Stato progetto TavoloLibero al 2026-04-17
description: Cosa è già implementato, cosa manca, priorità per MVP compliant
type: project
---

**Fatto (maturo):**
- Schema Prisma con 26 model: User/WorkerProfile/RestaurantProfile, ServiceRequest/Match/ServiceContract, PaymentOrder/Payout/Invoice/EscrowLedger, TaxProfile, FormerEmployer, PairMetric, ComplianceAlert/Snapshot, Review, EarningsScenario, AuditLog, OutboxEvent.
- `lib/compliance-agent.js` (~410 LOC): motore Fornero con policy injection, look-back 24m, MatchDecision a 5 livelli, safe-harbor senior.
- `lib/contract-agent.js` (~380 LOC): generazione contratti ex art. 2222 C.c. con forbidden-terms validation, snapshot PDF via script Python.
- `lib/earnings-simulator.js` (~310 LOC): simulatore forfettario vs dipendente per cameriere/sommelier/barman.
- 35 view EJS (cameriere 7, ristorante 7, admin 8, public 7, partials 5).
- BankAccount multi-IBAN per worker/ristorante con holder fiscale (DAC7-ready).
- Stripe mockup SDK-compatible (lib/stripe-mock.js), factory selettiva via STRIPE_MODE (lib/stripe.js).
- StripeEvent persistito append-only per tutti i side-effect del mock.
- payment-agent.js refactored: prisma.$transaction + idempotency key per milestone.

**Prototipale (da consolidare):**
- `lib/payment-agent.js`: milestone + PaymentOrder OK, ma scheduler è `setInterval` senza idempotenza né DLQ. Stripe Connect dichiarato ma non integrato.
- Auth: login demo hardcoded in `routes/auth.js`. Manca password hashing reale (bcrypt), rate limiting, email verification.
- Session: secret hardcoded in `server.js`, store in-memory (non scala oltre 1 istanza).

**Mancante (gap critici per MVP compliant):**
- **DAC7**: nessun flag `reportable` su invoice/transaction, TaxProfile incompleto per export EU.
- **Split payment verso ristorante**: il modello attuale ha solo % platform vs worker.
- **Stripe webhook handler**: base persistita (StripeEvent), handler arriverà nel Sub-progetto 3.
- **Tax mode sync**: `TaxProfile.taxMode` esiste ma non è mai sincronizzato con dichiarazione reale del worker.
- **Test automatizzati**: zero test suite configurata.
- **CRUD ServiceRequest/Match da UI**: route mancanti.

**Soglie Fornero attuali vs target:**
- Codice attuale: 240gg/24m, 80% concentrazione.
- Target utente (safety margin): **200gg/24m, 70% concentrazione**. Modifica richiesta in `compliance-agent.js` (rendere configurabili con default safety).

How to apply: quando l'utente chiede una nuova feature, verificare prima se tocca uno dei gap critici — se sì, proporre di chiuderlo contestualmente. Per compliance Fornero: esiste già, non riscrivere, estendere.
