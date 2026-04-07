import React, { useState } from 'react';

const ROLE_OPTIONS = [
  { value: 'cameriere', label: 'Cameriere' },
  { value: 'sommelier', label: 'Sommelier' },
  { value: 'barman', label: 'Barman' }
];

const BENCHMARKS = {
  cameriere: { junior: 1320, mid: 1381, senior: 1520 },
  sommelier: { junior: 1700, mid: 2050, senior: 2450 },
  barman: { junior: 1550, mid: 1850, senior: 2250 }
};

function getBand(years) {
  if (years <= 2) return 'junior';
  if (years <= 5) return 'mid';
  return 'senior';
}

export function calculateSimulatorScenario({
  ruolo,
  anni_esperienza,
  stipendio_netto_mensile_attuale,
  aliquota_forfettario
}) {
  const band = getBand(Number(anni_esperienza) || 0);
  const netMonthly = Number(stipendio_netto_mensile_attuale) || BENCHMARKS[ruolo][band];
  const forfettarioRate = Number(aliquota_forfettario) === 5 ? 0.05 : 0.15;

  // Step 1: ricostruzione semplificata del costo dipendente.
  const employeeNetAnnual = netMonthly * 14;
  const estimatedRal = employeeNetAnnual * 1.25;
  const employerInps = estimatedRal * 0.30;
  const employerInail = estimatedRal * 0.03;
  const tfr = estimatedRal * 0.074;
  const companyCost = estimatedRal + employerInps + employerInail + tfr;

  // Step 2: il costo azienda diventa fatturato lordo del freelance.
  const annualRevenue = companyCost;
  const taxableGross = annualRevenue * 0.67;
  const freelanceInps = taxableGross * 0.2607;
  const taxableNet = taxableGross - freelanceInps;
  const substituteTax = taxableNet * forfettarioRate;
  const freelanceAnnualNet = annualRevenue - freelanceInps - substituteTax;
  const freelanceMonthlyNet = freelanceAnnualNet / 12;

  return {
    dipendente: {
      nettoMensile: netMonthly,
      nettoAnnuo: employeeNetAnnual,
      ralStimata: estimatedRal
    },
    azienda: {
      costoTotale: companyCost,
      contributiInps: employerInps,
      premioInail: employerInail,
      tfr
    },
    freelance: {
      nettoMensile: freelanceMonthlyNet,
      nettoAnnuo: freelanceAnnualNet,
      fatturatoAnnuo: annualRevenue,
      contributiInps: freelanceInps,
      tasseSostitutive: substituteTax,
      withinForfettarioLimit: annualRevenue <= 85000
    },
    delta: {
      annuo: freelanceAnnualNet - employeeNetAnnual,
      mensile: freelanceMonthlyNet - netMonthly
    }
  };
}

function eur(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(value || 0);
}

export default function SimulatoreGuadagnoCard() {
  const [form, setForm] = useState({
    ruolo: 'cameriere',
    anni_esperienza: 3,
    stipendio_netto_mensile_attuale: 1381,
    aliquota_forfettario: 15
  });

  const result = calculateSimulatorScenario(form);

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
        <div style={{ padding: 24, borderRadius: 24, border: '1px solid #ddd', background: '#fffaf5' }}>
          <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c2633f', fontSize: 12 }}>
            Simulatore Ho.Re.Ca.
          </p>
          <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: '8px 0 16px' }}>
            Quanto cambia il tuo netto se il ristorante spende la stessa cifra?
          </h1>

          <label>
            Ruolo
            <select
              value={form.ruolo}
              onChange={event => setForm(current => ({ ...current, ruolo: event.target.value }))}
            >
              {ROLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Anni di esperienza
            <input
              type="number"
              min="0"
              max="40"
              value={form.anni_esperienza}
              onChange={event => setForm(current => ({ ...current, anni_esperienza: Number(event.target.value) }))}
            />
          </label>

          <label>
            Stipendio netto mensile attuale
            <input
              type="number"
              min="0"
              step="10"
              value={form.stipendio_netto_mensile_attuale}
              onChange={event => setForm(current => ({ ...current, stipendio_netto_mensile_attuale: Number(event.target.value) }))}
            />
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => setForm(current => ({ ...current, aliquota_forfettario: 5 }))}>
              5% nuova attivita
            </button>
            <button type="button" onClick={() => setForm(current => ({ ...current, aliquota_forfettario: 15 }))}>
              15% standard
            </button>
          </div>
        </div>

        <div style={{ padding: 24, borderRadius: 24, background: '#1f271b', color: '#f7f0e4' }}>
          <div style={{ padding: 18, borderRadius: 18, background: '#c2633f', fontSize: 28, fontWeight: 700 }}>
            Guadagni {eur(result.delta.annuo)} in piu all'anno con la nostra piattaforma!
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <div style={{ padding: 18, borderRadius: 18, background: 'rgba(255,255,255,0.08)' }}>
              <div>Netto dipendente</div>
              <strong style={{ fontSize: 36 }}>{eur(result.dipendente.nettoMensile)}</strong>
              <div>{eur(result.dipendente.nettoAnnuo)} annui</div>
            </div>

            <div style={{ padding: 18, borderRadius: 18, background: 'rgba(255,255,255,0.08)' }}>
              <div>Costo azienda totale</div>
              <strong style={{ fontSize: 36 }}>{eur(result.azienda.costoTotale)}</strong>
            </div>

            <div style={{ padding: 18, borderRadius: 18, background: 'rgba(90,122,58,0.35)' }}>
              <div>Netto forfettario</div>
              <strong style={{ fontSize: 36 }}>{eur(result.freelance.nettoMensile)}</strong>
              <div>{eur(result.freelance.nettoAnnuo)} annui</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
