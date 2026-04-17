---
name: Decisione stack TavoloLibero
description: Stack tecnologico confermato — Express+Prisma, non migrare a Next.js+Supabase
type: project
---

Restare su **Express 4 + EJS + Prisma/SQLite**. Upgrade path a scala: SQLite → PostgreSQL cambiando `provider` in `schema.prisma` (una riga, nessun refactor app).

Why: 3.300 LOC applicativi già scritti, schema Prisma con 26 model ben modellato, `compliance-agent.js` implementa già Fornero (240gg/80% — da stringere a 200/70%), `payment-agent.js` ha ciclo fatturazione funzionante. Migrare a Next.js+Supabase costa ~70% refactor senza gain reali: la compliance Fornero non si semplifica su Next, Vercel+Supabase aumenta TCO vs self-host Express+Postgres. Next.js ha senso solo se in futuro serviranno SSR/real-time massivi, non per un MVP marketplace B2B2C.

How to apply: quando l'utente parla di "scalabilità" o "velocità", non proporre rewrite. Proporre: (a) switch Postgres per write throughput, (b) Redis per session store, (c) index Prisma mirati, (d) caching HTTP su pagine pubbliche. Il collo di bottiglia reale sarà Stripe/webhook, non il framework.

Decisione presa il 2026-04-17 dopo analisi maturità della codebase; utente ha delegato la scelta.
