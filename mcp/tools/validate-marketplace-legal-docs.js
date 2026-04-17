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
