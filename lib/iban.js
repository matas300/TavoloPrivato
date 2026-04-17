// Validazione IBAN italiani (IT + 2 check + 23 alfanumerici = 27 char).
// Algoritmo mod-97 standard ISO 13616. Niente libreria esterna.

const IBAN_IT_REGEX = /^IT\d{2}[A-Z0-9]{23}$/;

function normalizeIban(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, '').toUpperCase();
}

function mod97(str) {
  // Converti ogni lettera in due cifre (A=10, B=11, ..., Z=35) poi mod 97.
  let expanded = '';
  for (const ch of str) {
    if (ch >= '0' && ch <= '9') expanded += ch;
    else expanded += (ch.charCodeAt(0) - 55).toString();
  }
  // Mod 97 a blocchi per evitare overflow.
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    const chunk = String(remainder) + expanded.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder;
}

function isValidIban(input) {
  const iban = normalizeIban(input);
  if (!IBAN_IT_REGEX.test(iban)) return false;
  // Sposta i primi 4 char in coda e applica mod 97: deve dare 1.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  return mod97(rearranged) === 1;
}

module.exports = { normalizeIban, isValidIban };
