# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TavoloLibero** — Italian B2B2C marketplace connecting freelance waiters (`cameriere`) with restaurants (`ristorante`), plus an `admin` role. Server-rendered Express + EJS app with a Prisma/SQLite persistence layer and an in-memory mock fallback. UI copy, routes, and domain terms are in Italian — preserve Italian naming when editing.

## Commands

```bash
npm run dev              # node --watch server.js (hot reload)
npm start                # production run
npm run db:generate      # prisma generate (after schema.prisma changes)
npm run db:push          # push schema to SQLite without migration history
npm run db:migrate       # prisma migrate dev --name init
npm run db:seed          # node prisma/seed.js
npm run db:studio        # Prisma Studio GUI
npm run db:validate      # validate schema.prisma
npm run payments:run     # scripts/run-monthly-billing.js — monthly commission billing job
```

No test runner or linter is configured. Default `PORT=3000`. `DATABASE_URL` in `.env` (defaults to `file:./dev.db`).

## Architecture

**Dual persistence.** `data/mock.js` is the source of truth the routes talk to. On boot it attempts to hydrate from Prisma via `lib/prisma.js` (`getPrismaClient()` returns `null` if `@prisma/client` isn't generated or `DATABASE_URL` is missing). If Prisma is unavailable it falls back to `data/mock-seed.js`. This means **routes should not call Prisma directly** — go through `data/mock.js` / `data/marketplace-service.js` so both backends behave the same. `lib/earnings-scenarios.js` and `lib/payment-agent.js` are the current exceptions (Prisma-first with session fallback).

**Routing layers** (mounted in `server.js`):
- `routes/auth.js` → `/` (login, register, logout)
- `routes/api.js` → `/api` (JSON endpoints, including simulator)
- `routes/cameriere.js`, `ristorante.js`, `admin.js` → role-gated dashboards under `/cameriere`, `/ristorante`, `/admin`
- Role gating via `middleware/auth.js` (`requireAuth`, `requireRole(...roles)`); session user is revalidated against `db.getUser` on every request and suspended users are logged out.

**Views.** EJS under `views/pages/{public,cameriere,ristorante,admin}/` with shared `views/partials/`. `res.locals.currentUser` and `res.locals.path` are set globally — use them in templates instead of passing user through every render call.

**Domain agents** in `lib/` encapsulate cross-cutting logic — treat them as the business-rule boundary. Questi file sono il cuore del dominio: estendere, non riscrivere.

- `compliance-agent.js` (~410 LOC, maturo) — motore **Riforma Fornero**. Calcola per ogni coppia `(worker, restaurant)` metriche a 12/24 mesi (giorni lavorati, fatturato, quota concentrazione), consulta `FormerEmployer` per ex-rapporti di dipendenza, applica policy configurabili e ritorna `MatchDecision`. **Soglie attuali: 240 gg/24m, 80% fatturato — da abbassare a 200/70% come safety margin** rispetto ai limiti legali (241gg/80%). Emette `ComplianceAlert` e `ComplianceSnapshot`.
- `contract-agent.js` (~380 LOC, maturo) — contratti ex art. 2222 C.c. Validazione "forbidden terms" (lessico da lavoro dipendente vietato), snapshot PDF via `scripts/generate_contract_pdf.py`, gating pre-firma tramite `compliance-agent`.
- `earnings-simulator.js` + `earnings-scenarios.js` + `earnings-prefill.js` + `earnings-pdf.js` — simulatore dual-audience (`worker` vs `restaurant`). Profili per ruolo (cameriere/sommelier/barman), scenari persistiti per `userId` o `simulatorVisitorKey` di sessione. **Solo marketing/educativo**: non sincronizza con `TaxProfile` reale.
- `payment-agent.js` (~430 LOC, **prototipale**) — genera milestone mensili, `PaymentOrder`, payout. Scheduler è un semplice `setInterval` (manca idempotenza e DLQ). Stripe Connect dichiarato ma non integrato; nessun webhook handler; split payment verso ristorante non modellato.
- `earnings-pdf.js` / `generate_*_pdf.py` — generazione PDF via script Python invocato da Node.

**Prisma schema** (`prisma/schema.prisma`, 26 model) copre: identità (`User`, `WorkerProfile`, `RestaurantProfile`, `Organization`), marketplace (`ServiceRequest`, `Match`, `ServiceContract`, `ContractMilestone`), pagamenti (`PaymentOrder`, `Payout`, `Invoice`, `EscrowLedger`, `Refund`), compliance (`TaxProfile`, `FormerEmployer`, `PairMetric`, `ComplianceAlert`, `ComplianceSnapshot`), reputazione (`Review`, `ReviewAggregate`, `NonRenewal`), infrastruttura (`AuditLog`, `OutboxEvent`, `Consent`).

Enum chiave: `MatchDecision` (allow/warn/manual_review/soft_stop/hard_stop), `RequestStatus`, `TaxMode` (forfettario/autonomo_occasionale/unknown), `PaymentStatus`, `MilestoneStatus`. Il mock layer mappa alcuni a stringhe italiane legacy (es. request `open`→`aperto`, contract `signed`→`confermato`) — vedi `data/mock.js` prima di cambiare valori di stato.

**Gap noti da chiudere per MVP compliant** (priorità alta):
- Manca `BankAccount`/IBAN model → blocca split payment reale e payout compliant.
- Manca flag `reportable` su invoice/transaction → blocca reporting **DAC7** (obbligo EU sopra €2000/30 tx annue per seller).
- Manca handler webhook Stripe → payment status sono hardcoded lato app.
- `TaxProfile.taxMode` non è mai sincronizzato con la dichiarazione reale del professionista.
- Auth in `routes/auth.js` è demo (login hardcoded, niente bcrypt, niente rate limiting).
- Session store in-memory e secret hardcoded in `server.js` → non scala oltre 1 istanza.
- Nessuna test suite configurata.

**Python scripts** in `scripts/` are invoked by Node for PDF generation — require a working `python` on PATH. Output lands in `output/` (served at `/output`).

## Stack e scalabilità

Decisione presa: **restare su Express + Prisma/SQLite**, non migrare a Next.js+Supabase. Motivo: i 3.300 LOC applicativi e lo schema Prisma a 26 model sono già allineati al dominio (Fornero, tax, pagamenti); una migrazione costerebbe ~70% refactor senza gain reali sulla compliance. Percorso di scala quando serve: (a) cambiare `provider` in `schema.prisma` da `sqlite` a `postgresql` (una riga, Prisma astrae tutto), (b) spostare session store su Redis, (c) aggiungere index Prisma mirati, (d) caching HTTP su pagine pubbliche. Il collo di bottiglia di un marketplace è Stripe/webhook, non il framework.

## Compliance legale — regole inviolabili

Queste valgono in codice, DB, EJS, PDF, risposte all'utente. Dettaglio completo in `memory/compliance_rules.md`:

1. **Lessico autonomo.** Mai "assunzione", "stipendio", "datore di lavoro", "turno fisso". Usare "committente", "prestatore d'opera", "compenso", "pacchetto servizio". La lista forbidden-terms vive in `contract-agent.js`: riusarla, non duplicarla.
2. **Rotazione forzata anti-monocommittenza.** Matching deve filtrare (non solo avvisare) quando una coppia worker-restaurant supera le soglie safety (200gg/24m, 70% fatturato). `compliance-agent.js` è l'unico punto in cui vivono queste regole.
3. **Split payment via Stripe Connect.** Il ristorante paga la piattaforma, che trattiene fee e versa netto al freelance. Mai flussi in cui la piattaforma paga direttamente "come datore".
4. **DAC7.** Raccogliere dati fiscali completi del venditore + IBAN per reporting Agenzia delle Entrate.
5. **GDPR.** La piattaforma è Titolare del Trattamento, non datore di lavoro — conseguenze su informative, consensi (`Consent` model esiste, è minimale), retention.

## Conventions

- Cookie jar files (`cookies-*.txt`) and per-port logs (`server-<port>.log`) are local dev artefacts — don't commit generated variants.
- Sessions use a hardcoded dev secret in `server.js`; treat as dev-only.
- When adding a public page, register the route in `server.js` (not in a `routes/` module) to match existing patterns for `/per-ristoranti`, `/pricing`, `/simulatore-*`, `/faq`.
- Design reference for the simulator lives in `docs/simulatore-guadagno-react.jsx` and `design-test.html` — not wired into the app, use as visual spec only.
