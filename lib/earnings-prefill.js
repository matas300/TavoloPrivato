function roundToNearestTen(value) {
  return Math.max(10, Math.round(Number(value || 0) / 10) * 10);
}

function getNextServiceDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date.toISOString().slice(0, 10);
}

function buildWorkerProfileDraft(result) {
  const roleLabel = result.input.ruoloLabel;
  return {
    role: 'cameriere',
    roleLabel,
    headline: `${roleLabel} freelance per servizi premium a giornata`,
    targetDayRateEur: roundToNearestTen(result.freelance.nettoMensile / 18),
    targetAnnualGainEur: result.delta.guadagnoAnnuo,
    summary: `Scenario importato: ${roleLabel} ${result.input.seniorityLabel.toLowerCase()}, netto attuale EUR ${result.input.stipendioNettoMensileAttuale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mese, differenziale annuo EUR ${Math.abs(result.delta.guadagnoAnnuo).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
  };
}

function buildRestaurantRequestDraft(result) {
  const roleKey = result.input.ruolo;
  const serviceType = roleKey === 'barman' ? 'evento' : 'cena';
  const roleLabel = result.input.ruoloLabel;

  return {
    role: 'ristorante',
    roleLabel,
    tipo: serviceType,
    data: getNextServiceDate(),
    budget: roundToNearestTen(result.azienda.costoTotale / 220),
    desc: `Prestazione ${roleLabel.toLowerCase()} a risultato, con setup operativo, delivery del servizio e chiusura ordinata. Fee flat coerente al budget simulato.`,
    summary: `Scenario importato: ${roleLabel} ${result.input.seniorityLabel.toLowerCase()}, costo azienda annuo EUR ${result.azienda.costoTotale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, valore netto professionista EUR ${result.freelance.nettoAnnuo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
  };
}

module.exports = {
  buildWorkerProfileDraft,
  buildRestaurantRequestDraft
};
