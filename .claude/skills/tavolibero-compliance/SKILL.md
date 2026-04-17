---
name: tavolibero-compliance
description: Use when editing matching logic (routes/*, lib/compliance-agent.js), payment flows (lib/payment-agent.js), contract generation (lib/contract-agent.js), EJS templates shown to users, or PDF generators in TavoloLibero. Enforces Riforma Fornero safety thresholds (200gg/70%), autonomous-work lexicon, split payment architecture. DAC7/GDPR coperti come check statico sui testi.
---

# TavoloLibero Compliance

Applica sempre queste 5 regole quando tocchi codice sensibile del marketplace.

## 1. Lessico autonomo obbligatorio
Mai "assunzione", "stipendio", "datore di lavoro", "turno fisso", "dipendente" nel codice, DB, EJS, PDF, messaggi UI. Usa "committente", "prestatore d'opera", "compenso", "pacchetto servizio", "incarico". La lista canonica FORBIDDEN_TERMS e' in `lib/contract-agent.js`.

## 2. Rotazione forzata anti-monocommittenza
Soglie operative (DEFAULT_POLICY in `lib/compliance-agent.js`): max 200gg/24m, max 70% concentrazione, warn 170gg/60%. Queste sono sotto i limiti legali (241gg/80%). Non alzarle senza override esplicito via policy injection.

## 3. Split payment via Stripe Connect
Il ristorante paga la piattaforma, che trattiene fee e versa netto al freelance. Mai flussi dove la piattaforma paga direttamente "come datore". Punto di estensione: `lib/payment-agent.js`.

## 4. DAC7
Raccogliere dati fiscali venditore (codice_fiscale, partita_iva) + IBAN per reporting EU. BankAccount model manca ancora nello schema; se aggiungi persistenza lato worker, proponi anche il modello.

## 5. GDPR
La piattaforma e' Titolare del Trattamento, non datore di lavoro. Consensi espliciti (Consent model), no logging di password/token/IBAN/codice fiscale in chiaro.

## Quando invocare gli MCP tool

Prima di committare, chiama:

- `validate_marketplace_legal_docs` con `kind` appropriato (`contract|ui|email|pdf|db_field`) per ogni stringa user-facing modificata, frammento EJS nuovo, testo PDF generato, nome campo DB nuovo. Verdict atteso: `pass`. Un `fail` blocca il commit.
- `check_fornero_compliance` dopo qualsiasi modifica al matching (query, filtri, route che cambiano il set restituito). Verifica che la decision sui fixture seed resti coerente.
- `simulate_tax_benefits` se tocchi `lib/earnings-simulator.js`, il simulatore UI, o introduci calcoli fiscali.

Se un tool torna `{ error: 'prisma_unavailable' }`, segnalalo all'utente prima di procedere: significa che il DB non e' configurato nell'ambiente corrente.
