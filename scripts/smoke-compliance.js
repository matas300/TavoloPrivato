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
