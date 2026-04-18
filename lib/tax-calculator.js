// lib/tax-calculator.js
//
// Calcolo fiscale per emissione Invoice TavoloLibero (Sub-progetto 2).
// Marketplace e intermediario puro: NON e sostituto d imposta.
// La ritenuta 20% e trattenuta dal ristorante (sostituto giuridico
// ex art. 23 DPR 600/73) e versata con F24 cod. 1040. Il marketplace
// la REGISTRA (per audit, report F24 al ristorante, DAC7) ma non
// tocca cassa.
//
// IVA 22%: out of scope in sub-2, arrivera in sub-6 (pass-through).
//
// Vedi skill finance/commercialista-italiano per derivazione giuridica.

const WITHHOLDING_RATE = 0.20;

class TaxModeUnknownError extends Error {
  constructor(workerProfileId) {
    super(
      `Cannot bill worker ${workerProfileId}: taxMode is unknown or missing. ` +
      `Complete fiscal onboarding first (Sub-progetto 2b).`
    );
    this.code = 'TAX_MODE_UNKNOWN';
    this.workerProfileId = workerProfileId;
  }
}

function money(n) {
  return Math.round(n * 100) / 100;
}

function computeInvoiceTaxes({ taxableEur, platformFeeEur, taxMode, workerProfileId }) {
  if (typeof taxableEur !== 'number' || Number.isNaN(taxableEur)) {
    throw new TypeError(`taxableEur must be a number, got ${typeof taxableEur}`);
  }
  if (taxableEur <= 0) {
    throw new TypeError(`taxableEur must be positive, got ${taxableEur}`);
  }
  if (typeof platformFeeEur !== 'number' || Number.isNaN(platformFeeEur)) {
    throw new TypeError(`platformFeeEur must be a number, got ${typeof platformFeeEur}`);
  }
  if (platformFeeEur < 0) {
    throw new TypeError(`platformFeeEur cannot be negative, got ${platformFeeEur}`);
  }
  if (platformFeeEur > taxableEur) {
    throw new RangeError(`platformFeeEur (${platformFeeEur}) cannot exceed taxableEur (${taxableEur})`);
  }

  if (!taxMode || taxMode === 'unknown') {
    throw new TaxModeUnknownError(workerProfileId);
  }

  const ALLOWED = new Set(['forfettario', 'autonomo_occasionale', 'partita_iva_ordinaria']);
  if (!ALLOWED.has(taxMode)) {
    throw new TypeError(`Unknown taxMode: ${taxMode}. Expected one of: ${[...ALLOWED].join(', ')}`);
  }

  const taxable = money(taxableEur);
  const fee = money(platformFeeEur);

  let withholdingRate = 0;
  let withholdingAmountEur = 0;

  if (taxMode === 'autonomo_occasionale' || taxMode === 'partita_iva_ordinaria') {
    withholdingRate = WITHHOLDING_RATE;
    withholdingAmountEur = money(taxable * WITHHOLDING_RATE);
  }

  // forfettario: withholding = 0, il worker dichiara dicitura di esonero art. 1 c. 67 L. 190/2014

  const totalDueEur = money(taxable - withholdingAmountEur);   // ristorante -> marketplace
  const netToWorkerEur = money(totalDueEur - fee);              // marketplace -> worker

  return {
    taxableAmountEur: taxable,
    withholdingRate,
    withholdingAmountEur,
    totalDueEur,
    netToWorkerEur,
    platformFeeEur: fee,
    taxRegimeSnapshot: taxMode,
  };
}

module.exports = {
  computeInvoiceTaxes,
  WITHHOLDING_RATE,
  TaxModeUnknownError,
};
