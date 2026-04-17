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
