# Compliance MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a TavoloLibero un MCP server Node con 3 tool (`check_fornero_compliance`, `simulate_tax_benefits`, `validate_marketplace_legal_docs`) come thin wrapper sui moduli `lib/` esistenti, piu' una skill Claude Code che ne impone l'uso, piu' il restringimento delle soglie Fornero al margine di sicurezza operativo.

**Architecture:** Un processo Node stdio-based registrato in `.mcp.json` di progetto. Ogni tool e' un file in `mcp/tools/` che importa direttamente `lib/compliance-agent.js`, `lib/earnings-simulator.js`, `lib/contract-agent.js`. Nessuna business logic duplicata. Verifica via `scripts/smoke-compliance.js` che e' l'unico test vehicle (niente framework).

**Tech Stack:** Node.js, `@modelcontextprotocol/sdk` (devDep), Prisma (gia' presente).

**Spec di riferimento:** `docs/superpowers/specs/2026-04-17-compliance-mcp-design.md`.

**Decisione di planning sulle soglie Fornero**: il `DEFAULT_POLICY` attuale e' `{ maxPairDays24m: 240, maxPairShare24m: 0.8, warnPairDays24m: 200, warnPairShare24m: 0.7 }`. Obiettivo: portare max (hard stop) a 200/0.70 e warn a 170/0.60, cosi' che le soglie del codice restino sotto i limiti legali (241/0.80).

---

### Task 1: Esportare FORBIDDEN_TERMS da contract-agent.js

**Files:**
- Modify: `lib/contract-agent.js` (aggiungere `FORBIDDEN_TERMS` all'oggetto `module.exports` intorno a riga 377-381)

- [ ] **Step 1: Verificare che la costante `FORBIDDEN_TERMS` esista in `lib/contract-agent.js` righe 13-19**

Attesa: array di RegExp `[ /assunzion/i, /datore di lavoro/i, /dipendent/i, /stipendi/i, /orario di lavoro fisso/i ]`.

- [ ] **Step 2: Aggiungere `FORBIDDEN_TERMS` all'oggetto `module.exports`**

Sostituire:
```javascript
module.exports = {
  LEGAL_CONTRACT_TITLE,
  createLongTermContract,
  generateContractPdf
};
```
con:
```javascript
module.exports = {
  LEGAL_CONTRACT_TITLE,
  FORBIDDEN_TERMS,
  createLongTermContract,
  generateContractPdf
};
```

- [ ] **Step 3: Verificare require funziona**

Run: `node -e "console.log(require('./lib/contract-agent').FORBIDDEN_TERMS.length)"`
Expected: `5`

- [ ] **Step 4: Commit**

```bash
git add lib/contract-agent.js
git commit -m "feat(contract-agent): export FORBIDDEN_TERMS for MCP reuse"
```

---

### Task 2: Abbassare soglie Fornero in DEFAULT_POLICY

**Files:**
- Modify: `lib/compliance-agent.js:1-7`

- [ ] **Step 1: Aprire `lib/compliance-agent.js` alle righe 1-7**

- [ ] **Step 2: Sostituire `DEFAULT_POLICY`**

Sostituire:
```javascript
const DEFAULT_POLICY = {
  maxPairDays24m: 240,
  maxPairShare24m: 0.8,
  warnPairDays24m: 200,
  warnPairShare24m: 0.7,
  exEmployerLookbackMonths: 24
};
```
con:
```javascript
// Soglie operative (safety margin sotto i limiti legali 241gg/80%).
// Override via policy injection in evaluatePairCompliance(prisma, { ..., policy }).
const DEFAULT_POLICY = {
  maxPairDays24m: 200,
  maxPairShare24m: 0.70,
  warnPairDays24m: 170,
  warnPairShare24m: 0.60,
  exEmployerLookbackMonths: 24
};
```

- [ ] **Step 3: Verificare import**

Run: `node -e "console.log(require('./lib/compliance-agent').DEFAULT_POLICY)"`
Expected: output con `maxPairDays24m: 200, maxPairShare24m: 0.7, warnPairDays24m: 170, warnPairShare24m: 0.6`.

- [ ] **Step 4: Avvio rapido server**

Run: `npm run dev`
Expected: `TavoloLibero running at http://localhost:3000` senza errori. Chiudere con Ctrl+C dopo la conferma.

- [ ] **Step 5: Commit**

```bash
git add lib/compliance-agent.js
git commit -m "feat(compliance): lower Fornero thresholds to safety margin 200/70%"
```

---

### Task 3: Aggiungere @modelcontextprotocol/sdk come devDep

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installare la dep**

Run: `npm install --save-dev @modelcontextprotocol/sdk`
Expected: `package.json` aggiornato e `node_modules/@modelcontextprotocol/sdk/` presente.

- [ ] **Step 2: Aggiungere script `mcp:smoke` in `package.json`**

Sostituire il blocco `"scripts"` con:
```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js",
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:migrate": "prisma migrate dev --name init",
  "db:seed": "node prisma/seed.js",
  "db:studio": "prisma studio",
  "db:validate": "prisma validate",
  "payments:run": "node scripts/run-monthly-billing.js",
  "mcp:smoke": "node scripts/smoke-compliance.js"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @modelcontextprotocol/sdk devDep and mcp:smoke script"
```

---

### Task 4: Creare smoke script con scenari fixture (test-first)

**Files:**
- Create: `scripts/smoke-compliance.js`

Lo smoke script definisce gli scenari che i 3 tool dovranno superare. Viene scritto prima dei tool (equivalente a test-first). Inizialmente fallisce perche' i tool non esistono ancora.

- [ ] **Step 1: Creare `scripts/smoke-compliance.js`**

```javascript
#!/usr/bin/env node
// Smoke test dei 3 tool MCP. Non e' un framework: script standalone.
// Uso: node scripts/smoke-compliance.js
// Exit code 0 se tutti i casi passano, 1 altrimenti.

const path = require('path');
require('dotenv').config();

const check = require(path.resolve(__dirname, '..', 'mcp', 'tools', 'check-fornero-compliance'));
const simulate = require(path.resolve(__dirname, '..', 'mcp', 'tools', 'simulate-tax-benefits'));
const validate = require(path.resolve(__dirname, '..', 'mcp', 'tools', 'validate-marketplace-legal-docs'));

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const icon = pass ? '\u2713' : '\u2717';
  console.log(`${icon} ${name}${detail ? ' -- ' + detail : ''}`);
}

async function runFornero() {
  try {
    const out = await check.run({ workerProfileId: 'seed-worker-1', restaurantProfileId: 'seed-restaurant-1' });
    const ok = out && (out.decision || out.error);
    record('check_fornero_compliance: risposta valida', ok, out.error ? `error=${out.error}` : `decision=${out.decision}`);
  } catch (err) {
    record('check_fornero_compliance: risposta valida', false, err.message);
  }
}

function runSimulator() {
  try {
    const out = simulate.run({
      ruolo: 'cameriere',
      anni_esperienza: 5,
      stipendio_netto_mensile_attuale: 1400,
      aliquota_forfettario: 0.05,
      coefficiente_redditivita: 0.67
    });
    const ok = out && out.freelance && typeof out.freelance.nettoAnnuo === 'number' && out.freelance.nettoAnnuo > 0;
    record('simulate_tax_benefits: netto annuo forfettario > 0', ok, `netto=${out && out.freelance && out.freelance.nettoAnnuo}`);
  } catch (err) {
    record('simulate_tax_benefits: netto annuo forfettario > 0', false, err.message);
  }
}

function runValidator() {
  const cases = [
    { text: 'Il prestatore emettera fattura al committente ex art. 2222.', kind: 'contract', expected: 'pass' },
    { text: 'Contratto di assunzione con il datore di lavoro.', kind: 'contract', expected: 'fail' },
    { text: 'Versamento dello stipendio mensile.', kind: 'ui', expected: 'fail' }
  ];
  for (const c of cases) {
    try {
      const out = validate.run({ text: c.text, kind: c.kind });
      const ok = out && out.verdict === c.expected;
      record(`validate_marketplace_legal_docs: "${c.text.slice(0, 40)}..." -> ${c.expected}`, ok, `verdict=${out && out.verdict}`);
    } catch (err) {
      record(`validate_marketplace_legal_docs: "${c.text.slice(0, 40)}..."`, false, err.message);
    }
  }
}

async function main() {
  await runFornero();
  runSimulator();
  runValidator();
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passati`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Errore fatale:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Lanciare smoke (deve fallire)**

Run: `npm run mcp:smoke`
Expected: fallisce con `Cannot find module '.../mcp/tools/check-fornero-compliance'`.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-compliance.js
git commit -m "test(mcp): add smoke script with fixture scenarios (tools TBD)"
```

---

### Task 5: Tool `check-fornero-compliance`

**Files:**
- Create: `mcp/tools/check-fornero-compliance.js`

- [ ] **Step 1: Creare directory**

Run: `mkdir -p mcp/tools`

- [ ] **Step 2: Scrivere il tool**

Contenuto di `mcp/tools/check-fornero-compliance.js`:

```javascript
// Thin-wrapper su lib/compliance-agent.evaluatePairCompliance.
// Richiede Prisma configurato: se non disponibile, ritorna { error: 'prisma_unavailable' }.

const { evaluatePairCompliance } = require('../../lib/compliance-agent');
const { getPrismaClient } = require('../../lib/prisma');

const schema = {
  name: 'check_fornero_compliance',
  description: 'Valuta la Riforma Fornero per una coppia worker/restaurant: giorni/concentrazione 12-24m, ex-datori, decision a 5 livelli.',
  inputSchema: {
    type: 'object',
    required: ['workerProfileId', 'restaurantProfileId'],
    properties: {
      workerProfileId: { type: 'string' },
      restaurantProfileId: { type: 'string' },
      asOf: { type: 'string', description: 'Data ISO, default oggi' },
      proposal: {
        type: 'object',
        properties: {
          grossAmountEur: { type: 'number' },
          estimatedServiceDays: { type: 'number' }
        }
      }
    }
  }
};

async function run(args) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return { error: 'prisma_unavailable', message: 'DATABASE_URL o @prisma/client mancanti' };
  }

  const { workerProfileId, restaurantProfileId, asOf, proposal } = args || {};
  if (!workerProfileId || !restaurantProfileId) {
    return { error: 'invalid_input', field: !workerProfileId ? 'workerProfileId' : 'restaurantProfileId' };
  }

  try {
    const options = { workerProfileId, restaurantProfileId };
    if (asOf) options.now = new Date(asOf);
    if (proposal) options.proposal = proposal;

    const raw = await evaluatePairCompliance(prisma, options);
    return {
      decision: raw.decision,
      controlScore: raw.controlScore,
      seniorExempt: raw.seniorExempt,
      exEmployerMatch: raw.formerEmployerMatch,
      metrics: {
        days24m: raw.current && raw.current.days24m,
        share12m: raw.current && raw.current.share12m,
        share24m: raw.current && raw.current.share24m
      },
      thresholds: {
        maxDays: raw.policy.maxPairDays24m,
        warnDays: raw.policy.warnPairDays24m,
        maxShare: raw.policy.maxPairShare24m,
        warnShare: raw.policy.warnPairShare24m
      },
      reasons: raw.reasons || []
    };
  } catch (err) {
    return { error: 'internal', message: err.message };
  }
}

module.exports = { schema, run };
```

- [ ] **Step 3: Lanciare smoke**

Run: `npm run mcp:smoke`
Expected: `check_fornero_compliance` risponde con `decision` oppure `error`. Gli altri due test falliscono ancora (moduli mancanti).

- [ ] **Step 4: Commit**

```bash
git add mcp/tools/check-fornero-compliance.js
git commit -m "feat(mcp): check_fornero_compliance tool wrapping compliance-agent"
```

---

### Task 6: Tool `simulate-tax-benefits`

**Files:**
- Create: `mcp/tools/simulate-tax-benefits.js`

- [ ] **Step 1: Scrivere il tool**

Contenuto di `mcp/tools/simulate-tax-benefits.js`:

```javascript
// Thin-wrapper su lib/earnings-simulator.calculateEarningsSimulation.
// Input sincrono (no DB).

const { calculateEarningsSimulation } = require('../../lib/earnings-simulator');

const schema = {
  name: 'simulate_tax_benefits',
  description: 'Calcola netto forfettario vs netto dipendente e costo azienda. Basato su CCNL Turismo + forfettario.',
  inputSchema: {
    type: 'object',
    required: ['ruolo', 'anni_esperienza', 'stipendio_netto_mensile_attuale'],
    properties: {
      ruolo: { type: 'string', enum: ['cameriere', 'sommelier', 'barman'] },
      anni_esperienza: { type: 'number' },
      stipendio_netto_mensile_attuale: { type: 'number' },
      aliquota_forfettario: { type: 'number', description: '0.05 o 0.15; default 0.05' },
      coefficiente_redditivita: { type: 'number', description: 'Default 0.67' },
      audience: { type: 'string', enum: ['worker', 'restaurant'] }
    }
  }
};

function run(args) {
  if (!args || typeof args !== 'object') {
    return { error: 'invalid_input', field: 'args' };
  }
  try {
    const sim = calculateEarningsSimulation(args);
    return {
      audience: sim.audience,
      dipendente: {
        nettoMensile: sim.dipendente.nettoMensile,
        nettoAnnuo: sim.dipendente.nettoAnnuo,
        ralStimata: sim.dipendente.ralStimata
      },
      azienda: { costoTotale: sim.azienda.costoTotale },
      freelance: {
        fatturatoAnnuo: sim.freelance.fatturatoAnnuo,
        nettoAnnuo: sim.freelance.nettoAnnuo,
        nettoMensile: sim.freelance.nettoMensile,
        withinForfettarioLimit: sim.freelance.withinForfettarioLimit
      },
      delta: {
        guadagnoAnnuo: sim.delta.guadagnoAnnuo,
        guadagnoMensile: sim.delta.guadagnoMensile
      },
      warnings: sim.warnings || []
    };
  } catch (err) {
    return { error: 'internal', message: err.message };
  }
}

module.exports = { schema, run };
```

- [ ] **Step 2: Lanciare smoke**

Run: `npm run mcp:smoke`
Expected: `simulate_tax_benefits: netto annuo forfettario > 0` passa. Validator ancora fallisce.

- [ ] **Step 3: Commit**

```bash
git add mcp/tools/simulate-tax-benefits.js
git commit -m "feat(mcp): simulate_tax_benefits tool wrapping earnings-simulator"
```

---

### Task 7: Tool `validate-marketplace-legal-docs`

**Files:**
- Create: `mcp/tools/validate-marketplace-legal-docs.js`

- [ ] **Step 1: Scrivere il tool**

Contenuto di `mcp/tools/validate-marketplace-legal-docs.js`:

```javascript
// Controlla testi user-facing (contratti, UI, PDF) contro lessico da lavoro dipendente
// e fa un check statico su DAC7 e GDPR. Forbidden terms riusati da contract-agent.js.

const { FORBIDDEN_TERMS } = require('../../lib/contract-agent');

const REQUIRED_TERMS_BY_KIND = {
  contract: [/art(icolo)?\.?\s*2222/i, /prestatore/i, /committente/i],
  ui: [],
  email: [],
  pdf: [/committente/i],
  db_field: []
};

const DAC7_KEYWORDS = ['codice_fiscale', 'partita_iva', 'iban', 'indirizzo_residenza'];
const GDPR_SENSITIVE = [/password/i, /token/i, /codice\s*fiscale/i, /iban/i, /carta\s*di\s*credito/i];

const schema = {
  name: 'validate_marketplace_legal_docs',
  description: 'Valida testi marketplace: termini da subordinazione vietati, termini richiesti, copertura DAC7, segnali GDPR.',
  inputSchema: {
    type: 'object',
    required: ['text', 'kind'],
    properties: {
      text: { type: 'string' },
      kind: { type: 'string', enum: ['contract', 'ui', 'email', 'pdf', 'db_field'] }
    }
  }
};

function findForbidden(text) {
  const hits = [];
  for (const re of FORBIDDEN_TERMS) {
    const match = re.exec(text);
    if (match) hits.push({ term: match[0], index: match.index });
  }
  return hits;
}

function findMissingRequired(text, kind) {
  const required = REQUIRED_TERMS_BY_KIND[kind] || [];
  return required.filter(re => !re.test(text)).map(re => re.source);
}

function computeDac7(text, kind) {
  if (kind !== 'db_field') return { requiredFieldsPresent: true, missing: [] };
  const missing = DAC7_KEYWORDS.filter(kw => !text.toLowerCase().includes(kw));
  return { requiredFieldsPresent: missing.length === 0, missing };
}

function computeGdprFlags(text) {
  return GDPR_SENSITIVE.filter(re => re.test(text)).map(re => re.source);
}

function run(args) {
  if (!args || typeof args.text !== 'string' || !args.kind) {
    return { error: 'invalid_input', field: !args || !args.text ? 'text' : 'kind' };
  }
  const forbiddenTerms = findForbidden(args.text);
  const missingRequiredTerms = findMissingRequired(args.text, args.kind);
  const dac7 = computeDac7(args.text, args.kind);
  const gdprFlags = computeGdprFlags(args.text);

  let verdict = 'pass';
  if (forbiddenTerms.length > 0) verdict = 'fail';
  else if (missingRequiredTerms.length > 0 || !dac7.requiredFieldsPresent) verdict = 'warn';

  return { verdict, forbiddenTerms, missingRequiredTerms, dac7, gdpr: { flags: gdprFlags } };
}

module.exports = { schema, run };
```

- [ ] **Step 2: Lanciare smoke completo**

Run: `npm run mcp:smoke`
Expected: tutti e 3 i casi del validator passano. Exit code 0 se anche simulator ha passato. `check_fornero_compliance` puo' uscire con `decision` o `error` (accettabili entrambi).

- [ ] **Step 3: Commit**

```bash
git add mcp/tools/validate-marketplace-legal-docs.js
git commit -m "feat(mcp): validate_marketplace_legal_docs tool (forbidden terms, DAC7, GDPR)"
```

---

### Task 8: MCP server entry point

**Files:**
- Create: `mcp/server.js`

- [ ] **Step 1: Scrivere `mcp/server.js`**

Contenuto:

```javascript
#!/usr/bin/env node
// MCP server stdio per TavoloLibero: espone i 3 tool compliance.
// Registrato in .mcp.json alla root del progetto.

require('dotenv').config();

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const tools = [
  require('./tools/check-fornero-compliance'),
  require('./tools/simulate-tax-benefits'),
  require('./tools/validate-marketplace-legal-docs')
];

const registry = new Map(tools.map(t => [t.schema.name, t]));

const server = new Server(
  { name: 'tavolibero-compliance', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => t.schema)
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = registry.get(request.params.name);
  if (!tool) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: 'unknown_tool', name: request.params.name }) }], isError: true };
  }
  const result = await tool.run(request.params.arguments || {});
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('tavolibero-compliance MCP server connesso (stdio)');
}

main().catch(err => {
  console.error('MCP server fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Sanity check sintassi**

Run: `node -c mcp/server.js`
Expected: nessun output (sintassi valida).

- [ ] **Step 3: Commit**

```bash
git add mcp/server.js
git commit -m "feat(mcp): stdio server exposing 3 compliance tools"
```

---

### Task 9: Registrazione `.mcp.json`

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Scrivere `.mcp.json` alla root**

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

- [ ] **Step 2: Commit**

```bash
git add .mcp.json
git commit -m "chore: register tavolibero-compliance MCP server"
```

---

### Task 10: Skill Claude Code

**Files:**
- Create: `.claude/skills/tavolibero-compliance/SKILL.md`

- [ ] **Step 1: Creare directory**

Run: `mkdir -p .claude/skills/tavolibero-compliance`

- [ ] **Step 2: Scrivere `SKILL.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/tavolibero-compliance/SKILL.md
git commit -m "feat(skill): tavolibero-compliance enforces Fornero/lexicon/split-payment"
```

---

### Task 11: Aggiornare CLAUDE.md con sezione MCP tools

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Aprire `CLAUDE.md` e localizzare la sezione "Compliance legale — regole inviolabili"**

- [ ] **Step 2: Inserire una nuova sezione subito dopo**

Aggiungere:

```markdown
## MCP tools disponibili

Il repo espone un MCP server `tavolibero-compliance` (registrato in `.mcp.json`) con tre tool da usare a design-time ogni volta che si modifica codice sensibile:

- `check_fornero_compliance({ workerProfileId, restaurantProfileId })` — valuta la coppia con le soglie operative (200gg/70%); usa `lib/compliance-agent.js`. Richiede Prisma configurato.
- `simulate_tax_benefits({ ruolo, anni_esperienza, stipendio_netto_mensile_attuale, ... })` — calcola netto forfettario vs dipendente; usa `lib/earnings-simulator.js`.
- `validate_marketplace_legal_docs({ text, kind })` — cerca termini da subordinazione, termini richiesti, copertura DAC7, flag GDPR; riusa FORBIDDEN_TERMS di `lib/contract-agent.js`.

La skill `.claude/skills/tavolibero-compliance/SKILL.md` impone di invocare questi tool prima di modificare matching, pagamenti, contratti, EJS, PDF. Smoke test: `npm run mcp:smoke`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document MCP compliance tools in CLAUDE.md"
```

---

## Verifica finale

Dopo tutti gli 11 task:

- [ ] **Run smoke completo**

Run: `npm run mcp:smoke`
Expected: exit code 0, almeno 4 checkmark su 5 (quello `check_fornero_compliance` puo' uscire con `error: prisma_unavailable` se il DB non e' popolato, e' accettabile).

- [ ] **Grep verifiche chiave**

Run: `grep -n "maxPairDays24m: 200" lib/compliance-agent.js`
Expected: la riga trovata.

Run: `grep -n "FORBIDDEN_TERMS" lib/contract-agent.js`
Expected: almeno 2 occorrenze (dichiarazione + export).

- [ ] **Restart Claude Code nel repo**

Al riavvio, Claude Code deve caricare l'MCP `tavolibero-compliance` tra gli MCP attivi e la skill `tavolibero-compliance` tra le skill disponibili.
