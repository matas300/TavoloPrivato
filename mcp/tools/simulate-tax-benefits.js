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
