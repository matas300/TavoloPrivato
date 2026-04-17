# Spec — Compliance MCP + Skill + Threshold Fornero

Data: 2026-04-17
Autore: Claude + rossima (brainstorming)
Status: approvato, pronto per piano di implementazione

## Obiettivo

Dotare Claude Code di tre tool MCP (`check_fornero_compliance`, `simulate_tax_benefits`, `validate_marketplace_legal_docs`) come thin wrapper sui moduli `lib/` già presenti nel repo TavoloLibero, più una skill che imponga di invocarli quando si tocca codice legalmente sensibile. Contestualmente abbassare le soglie Fornero al margine di sicurezza (200gg/24m, 70% concentrazione).

## Contesto e motivazione

Il repo contiene già `lib/compliance-agent.js` (motore Fornero maturo), `lib/earnings-simulator.js` (calcolatore forfettario vs dipendente) e `lib/contract-agent.js` (con lista forbidden-terms e validazione testi). Invece di duplicare queste regole in un MCP standalone — con rischio di drift — gli MCP tool importano i moduli esistenti. Una sola fonte di verità sulle regole legali, riusata sia dall'app a runtime sia da Claude a design-time. Le soglie attuali del motore (240gg/80%) coincidono con i limiti legali: vanno abbassate a 200/70% per avere un buffer operativo.

## Scope

### In scope
- MCP server Node.js unico con 3 tool.
- Skill Claude Code che vincola l'invocazione degli MCP prima di modificare codice sensibile.
- Abbassamento soglie default in `compliance-agent.js` a 200gg / 70%, con override possibile via policy injection esistente.
- Smoke script eseguibile manualmente per verificare i 3 tool.

### Out of scope (sub-progetti futuri separati)
- `BankAccount`/IBAN model + split payment reale verso ristorante.
- Webhook Stripe + flag `reportable` DAC7 su invoice.
- Sincronizzazione `TaxProfile.taxMode` con posizione fiscale reale.
- Auth reale (bcrypt, rate limit), Redis session store, switch SQLite → Postgres.
- Setup MemPalace come memory bank MCP (task separato, tracciato fuori da questa spec).

## Architettura

### File nuovi

```
mcp/
  server.js                                 entry point MCP stdio
  tools/
    check-fornero-compliance.js
    simulate-tax-benefits.js
    validate-marketplace-legal-docs.js
.mcp.json                                   registrazione server (root, committato)
.claude/skills/tavolibero-compliance/
  SKILL.md                                  regole + trigger invocazione
scripts/smoke-compliance.js                 smoke test dei tool
```

### File modificati

- `lib/compliance-agent.js` — default `dayLimit24m: 200`, `concentrationLimit: 0.70`. Le soglie legali (241, 0.80) restano disponibili via policy override.
- `package.json` — aggiunta devDep `@modelcontextprotocol/sdk` e script `"mcp:smoke": "node scripts/smoke-compliance.js"`.
- `CLAUDE.md` — sezione "MCP tools disponibili" con istruzione d'uso.

### Registrazione MCP

`.mcp.json` alla root del progetto:

```json
{
  "mcpServers": {
    "tavolibero-compliance": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp/server.js"]
    }
  }
}
```

### Contratti dei tool

**`check_fornero_compliance`**
- Input: `{ workerId: string, restaurantId: string, asOf?: string (ISO date) }`
- Output:
  ```json
  {
    "decision": "allow|warn|manual_review|soft_stop|hard_stop",
    "metrics": { "days24m": number, "concentration12m": number, "concentration24m": number },
    "thresholds": { "daysWarn": number, "daysStop": number, "concentrationWarn": number, "concentrationStop": number },
    "violations": [{ "code": string, "message": string }],
    "exEmployerMatch": boolean,
    "safeHarbor": boolean
  }
  ```
- Implementazione: delega a `compliance-agent.evaluatePair()`. Il `compliance-agent` dipende da `PairMetric` e `FormerEmployer` (Prisma models): il tool richiede quindi che Prisma sia configurato (`DATABASE_URL` + `prisma generate` eseguito). Se Prisma non è disponibile, ritorna `{ error: "prisma_unavailable" }`. Il tool si limita ad adattare I/O, non duplica business logic.

**`simulate_tax_benefits`**
- Input: `{ ralEur: number, roleProfile: "cameriere"|"sommelier"|"barman", experienceBand: "junior"|"mid"|"senior" }`
- Output:
  ```json
  {
    "companyCost": number,
    "employeeNet": number,
    "freelance": { "gross": number, "inps": number, "tax": number, "net": number },
    "deltaAnnualNet": number,
    "warnings": string[]
  }
  ```
- Implementazione: invoca `calculateEarningsSimulation()` con audience `worker`, mappa l'output sullo schema qui sopra. Nessuna logica fiscale duplicata.

**`validate_marketplace_legal_docs`**
- Input: `{ text: string, kind: "contract"|"ui"|"email"|"pdf"|"db_field" }`
- Output:
  ```json
  {
    "verdict": "pass|warn|fail",
    "forbiddenTerms": [{ "term": string, "index": number }],
    "missingRequiredTerms": string[],
    "dac7": { "requiredFieldsPresent": boolean, "missing": string[] },
    "gdpr": { "flags": string[] }
  }
  ```
- Implementazione: riusa la forbidden-terms list di `contract-agent.js` (esportarla se non già esportata). DAC7 e GDPR: keyword/regex check statico su stringa, logica definita nel file del tool (non nel compliance-agent, che resta focalizzato su Fornero).

### Skill

`.claude/skills/tavolibero-compliance/SKILL.md`

Frontmatter:
```yaml
---
name: tavolibero-compliance
description: Use when editing matching logic (routes/*, lib/compliance-agent.js), payment flows (lib/payment-agent.js), contract generation (lib/contract-agent.js), EJS templates shown to users, or PDF generators. Enforces Riforma Fornero safety thresholds (200gg/70%), autonomous-work lexicon, split payment architecture. DAC7/GDPR sono coperti a livello di check statico sui testi (non come implementazione completa di reporting).
---
```

Corpo: le 5 regole inviolabili (sintesi operativa da `memory/compliance_rules.md`) più istruzione esplicita di invocare:
- `validate_marketplace_legal_docs` prima di committare modifiche a EJS/PDF/contratti/stringhe UI.
- `check_fornero_compliance` dopo modifiche al matching (query, filtri, route che cambiano il set di risultati).
- `simulate_tax_benefits` quando si toccano calcoli fiscali o il simulatore.

### Threshold fix

In `lib/compliance-agent.js` cambiare i default della policy:
- `dayLimit24m`: 240 → 200
- `concentrationLimit`: 0.80 → 0.70

Le soglie legali restano disponibili come override esplicito (`policy.legalLimits = true` oppure policy custom) — il meccanismo di policy injection esiste già, non va ricostruito.

### Smoke script

`scripts/smoke-compliance.js` è uno script Node eseguibile standalone (non framework di test). Gira i 3 tool su 3-4 scenari fixture definiti inline:
1. Worker sotto soglia — atteso `allow`.
2. Worker al 68% concentrazione — atteso `warn`.
3. Worker oltre 200gg — atteso `soft_stop` o `hard_stop`.
4. Testo contrattuale con termine vietato "assunzione" — atteso `validate_marketplace_legal_docs.verdict: "fail"`.

Output: ogni scenario stampa `✓` o `✗` con il motivo. Exit code non-zero se almeno uno fallisce.

## Data flow

```
Claude Code → MCP stdio → mcp/server.js → tools/*.js → lib/{compliance,earnings,contract}-agent.js
                                                      ↓
                                              data/mock.js (→ Prisma se configurato)
```

Nessun nuovo accesso al DB, nessun nuovo modello Prisma, nessuna nuova dipendenza runtime dell'app (solo `@modelcontextprotocol/sdk` come devDep per il server MCP).

## Error handling

- Se l'MCP tool riceve un `workerId`/`restaurantId` inesistente, ritorna `{ error: "not_found", entity: ... }` senza lanciare.
- Se `compliance-agent` lancia un'eccezione interna, viene catturata e restituita come `{ error: "internal", message: string }` — mai propagare stack trace al client MCP.
- Input malformato: validazione leggera (tipo/enum dei campi), ritorno `{ error: "invalid_input", field: ... }`.

## Testing

Solo lo smoke script. Rationale KISS: niente test framework in questo repo oggi, introdurne uno per 3 tool è overkill. Lo smoke script è eseguibile manualmente e in CI futura.

## Rollout

1. Cambio soglie in `compliance-agent.js` + regressione manuale via smoke script.
2. Creazione directory `mcp/`, `server.js`, i 3 tool.
3. `.mcp.json`, installazione devDep, smoke run.
4. Skill file.
5. Aggiornamento `CLAUDE.md` con sezione "MCP tools disponibili" e riferimento alla skill.

## Criteri di accettazione

- `npm run mcp:smoke` esce con codice 0 su tutti gli scenari fixture.
- Claude Code, all'avvio nel repo, carica `tavolibero-compliance` come MCP server attivo.
- Invocando `check_fornero_compliance` su un worker noto del seed, ritorna una decision coerente con i dati di `data/mock-seed.js`.
- La skill `tavolibero-compliance` appare nella lista skill disponibili ed è invocabile via `Skill` tool.
- Grep su `lib/compliance-agent.js` mostra `dayLimit24m: 200` e `concentrationLimit: 0.70` come default.

## Rischi e mitigazioni

- **Rischio**: il cambio soglie rompe scenari seed esistenti (qualche match demo che era `allow` diventa `warn`). **Mitigazione**: accettato, è l'intento. Aggiornare il seed se necessario.
- **Rischio**: `@modelcontextprotocol/sdk` aggiunge 10-20 MB di node_modules per un devDep usato solo a design-time. **Mitigazione**: nessuna. Costo accettabile.
- **Rischio**: la forbidden-terms list di `contract-agent.js` non è esportata al momento. **Mitigazione**: esporla con un export nominato dedicato, senza toccare la logica del contract-agent.
