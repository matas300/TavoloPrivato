# TavoloLibero Marketplace Blueprint

Generated on 2026-04-04.

## Scope

This blueprint turns the current demo into a production-oriented architecture for a bilateral marketplace between restaurant venues and freelance floor staff in Italy.

## Product posture

- Sell service packages, never hourly labor.
- Keep the worker profile richer than the restaurant profile.
- Treat compliance as a first-class product flow, not an admin afterthought.
- Keep chat, trial service, contract, payment and review in one traceable workflow.

## Legal posture

- Historical false VAT indicators introduced by Law 92/2012 are still useful as internal guardrails, but they are not enough on their own.
- The platform must also control for hetero-organization risk under Article 2 of Legislative Decree 81/2015.
- The forfettario regime needs specific checks on work performed prevalently for current or former employers from the previous two tax periods, or related parties.
- Work under autonomous occasional services must be monitored with progressive alerts before 5000 EUR YTD.
- Before launch, the team must validate whether the marketplace requires labor intermediation authorization under Legislative Decree 276/2003.

## Database domains

1. Identity and access
2. Organizations and venues
3. Worker profiles
4. Demand and matching
5. Communication and workflow
6. Contracts and payments
7. Compliance and monitoring
8. Reputation

The relational schema is in `docs/marketplace-schema.sql`.

## Agent mesh

### Auth & Profilazione Agent

- Owns users, identities, tax profile and former employers.
- Emits profile lifecycle events.

### Matching Agent

- Owns requests, match suggestions and ranking results.
- Never bypasses compliance decisions.

### Contract Agent

- Generates the correct agreement template for forfettario or autonomous occasional work.
- Blocks signature if payment or compliance state is not green.

### Payments Agent

- Applies split rules and payout release logic.
- Maintains the ledger used by fiscal and business monitoring.

### Admin & Compliance Agent

- Executes deterministic rules.
- Opens manual review only when the decision ladder requires it.

### Notifications Agent

- Drives in-app, email and push notifications from outbox events.

### Rating Agent

- Already modeled for phase 2 and ready to publish bilateral reviews after service completion.

## Compliance engine

Decision states:

- allow
- warn
- manual_review
- soft_stop
- hard_stop

Core checks:

1. Tax mode normalization
2. Counterparty graph resolution
3. Pair metrics update on rolling windows
4. Revenue concentration scoring
5. Continuity scoring
6. Former employer block
7. Hetero-organization score
8. Admin case creation and override trace

## UX guardrails

- Mobile-first by default
- Dark mode available everywhere
- Social login first
- Restaurant UI must use the language of service outcomes
- Worker onboarding should feel like building a premium hospitality CV, not filling payroll fields

## Demo data

The demo data file is `data/marketplace-demo.json`.

It includes:

- 2 workers
- 2 restaurants
- service packages
- service requests
- engagement history
- bilateral reviews
- pair metrics
- compliance alerts
