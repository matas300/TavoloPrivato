(function () {
  const form = document.getElementById('earnings-simulator-form');
  if (!form) return;

  const meta = window.TL_SIMULATOR_META || {};
  const initialState = window.TL_SIMULATOR_INITIAL || null;
  const page = window.TL_SIMULATOR_PAGE || {};
  let savedScenarios = Array.isArray(window.TL_SIMULATOR_SAVED) ? window.TL_SIMULATOR_SAVED.slice() : [];
  const currencyFormatter = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  let requestToken = 0;
  let lastResult = initialState;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(value) {
    return `EUR ${currencyFormatter.format(Number(value || 0))}`;
  }

  function formatSignedCurrency(value) {
    const numericValue = Number(value || 0);
    return `${numericValue >= 0 ? '+' : '-'}EUR ${currencyFormatter.format(Math.abs(numericValue))}`;
  }

  function formatNumber(value) {
    return currencyFormatter.format(Number(value || 0));
  }

  function formatRange(range) {
    if (!Array.isArray(range) || !range.length) return 'n.d.';
    if (range[0] === range[1]) return formatCurrency(range[0]);
    return `${formatCurrency(range[0])} - ${formatCurrency(range[1])}`;
  }

  function getExperienceBandKey(years) {
    const numericYears = Number(years) || 0;
    if (numericYears <= 2) return 'junior';
    if (numericYears <= 5) return 'mid';
    return 'senior';
  }

  function getRoleMeta(roleKey) {
    return (meta.roles || []).find(item => item.key === roleKey) || (meta.roles || [])[0];
  }

  function getSuggestedBenchmark(roleKey, years) {
    const roleMeta = getRoleMeta(roleKey);
    if (!roleMeta) return null;
    return roleMeta.suggestedNetMonthlyByBand[getExperienceBandKey(years)];
  }

  function updateBenchmarkLabel() {
    const role = form.querySelector('[name="ruolo"]').value;
    const years = form.querySelector('[name="anni_esperienza"]').value;
    const benchmark = getSuggestedBenchmark(role, years);
    const label = document.getElementById('sim-benchmark-label');
    if (label && benchmark) {
      label.textContent = `Benchmark ruolo: ${formatCurrency(benchmark)}/mese`;
    }
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setSaveStatus(message, isError) {
    const node = document.getElementById('sim-save-status');
    if (!node) return;
    node.textContent = message;
    node.style.color = isError ? 'var(--red)' : 'var(--text-secondary)';
  }

  function buildExportUrl() {
    const payload = collectPayload();
    const params = new URLSearchParams({
      audience: payload.audience,
      ruolo: payload.ruolo,
      anni_esperienza: String(payload.anni_esperienza),
      stipendio_netto_mensile_attuale: String(payload.stipendio_netto_mensile_attuale),
      aliquota_forfettario: String(payload.aliquota_forfettario)
    });
    return `/api/simulatore-guadagno/export?${params.toString()}`;
  }

  function renderWarnings(warnings) {
    const list = document.getElementById('sim-warning-list');
    if (!list) return;
    list.innerHTML = '';
    (warnings || []).forEach(item => {
      const node = document.createElement('div');
      node.className = 'sim-warning-item';
      node.textContent = item;
      list.appendChild(node);
    });
  }

  function renderNotes(notes) {
    const box = document.getElementById('sim-role-notes');
    if (!box) return;
    box.innerHTML = '';
    (notes || []).forEach(item => {
      const paragraph = document.createElement('p');
      paragraph.className = 'text-sm text-muted';
      paragraph.textContent = item;
      box.appendChild(paragraph);
    });
  }

  function renderSavedScenarios() {
    const grid = document.getElementById('sim-saved-grid');
    if (!grid) return;

    if (!savedScenarios.length) {
      grid.innerHTML = `
        <div class="sim-empty-state" id="sim-empty-state">
          <strong>${escapeHtml(page.savedEmptyTitle || 'Nessuno scenario salvato')}</strong>
          <p class="text-sm text-muted">${escapeHtml(page.savedEmptyText || '')}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = savedScenarios.map(item => `
      <button
        type="button"
        class="sim-saved-card"
        data-scenario-role="${escapeHtml(item.snapshot.input.ruolo)}"
        data-scenario-years="${escapeHtml(item.snapshot.input.anniEsperienza)}"
        data-scenario-net="${escapeHtml(item.snapshot.input.stipendioNettoMensileAttuale)}"
        data-scenario-rate="${escapeHtml(item.snapshot.input.aliquotaForfettario)}"
      >
        <span class="sim-saved-date">${new Intl.DateTimeFormat('it-IT').format(new Date(item.createdAt))}</span>
        <strong>${escapeHtml(item.snapshot.input.ruoloLabel)} · ${escapeHtml(item.snapshot.input.seniorityLabel)}</strong>
        <p class="text-sm text-muted">Netto attuale ${currencyFormatter.format(item.snapshot.input.stipendioNettoMensileAttuale)} EUR/mese</p>
        <div class="sim-saved-metrics">
          <span>${currencyFormatter.format(item.companyCostAnnual)} EUR costo azienda</span>
          <span>${item.annualGain >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(item.annualGain))} EUR annui</span>
        </div>
      </button>
    `).join('');
  }

  function renderSimulation(result) {
    if (!result) return;
    lastResult = result;

    const banner = document.getElementById('sim-banner');
    if (banner) {
      banner.textContent = result.banner;
      banner.classList.toggle('sim-banner-negative', result.delta.guadagnoAnnuo < 0);
    }

    setText('sim-employee-month', formatNumber(result.dipendente.nettoMensile));
    setText('sim-employee-year', `${formatCurrency(result.dipendente.nettoAnnuo)} annui`);
    setText('sim-company-cost', formatNumber(result.azienda.costoTotale));
    setText('sim-estimated-ral', formatCurrency(result.dipendente.ralStimata));
    setText('sim-freelance-month', formatNumber(result.freelance.nettoMensile));
    setText('sim-freelance-year', `${formatCurrency(result.freelance.nettoAnnuo)} annui`);
    setText('sim-delta-month', formatSignedCurrency(result.delta.guadagnoMensile));
    setText('sim-delta-year', formatSignedCurrency(result.delta.guadagnoAnnuo));
    setText('sim-forfettario-limit', result.freelance.withinForfettarioLimit ? 'Entro 85.000 EUR' : 'Oltre 85.000 EUR');

    setText('sim-breakdown-employee-net', formatCurrency(result.dipendente.nettoAnnuo));
    setText('sim-breakdown-ral', formatCurrency(result.dipendente.ralStimata));
    setText('sim-breakdown-employer-inps', formatCurrency(result.azienda.contributiInps));
    setText('sim-breakdown-inail', formatCurrency(result.azienda.premioInail));
    setText('sim-breakdown-tfr', formatCurrency(result.azienda.tfr));
    setText('sim-breakdown-company-cost', formatCurrency(result.azienda.costoTotale));
    setText('sim-breakdown-revenue', formatCurrency(result.freelance.fatturatoAnnuo));
    setText('sim-breakdown-coefficient', `${Math.round(result.freelance.coefficienteRedditivita * 100)}%`);
    setText('sim-breakdown-taxable-gross', formatCurrency(result.freelance.redditoImponibileLordo));
    setText('sim-breakdown-freelance-inps', formatCurrency(result.freelance.contributiInps));
    setText('sim-breakdown-tax', formatCurrency(result.freelance.tasseSostitutive));
    setText('sim-breakdown-freelance-net', formatCurrency(result.freelance.nettoAnnuo));

    setText('sim-role-label', `${result.input.ruoloLabel} · ${result.input.seniorityLabel}`);
    setText('sim-level-pill', result.input.ccnlLevel);
    setText('sim-market-net', formatRange(result.referenceSnapshot.marketNetMonthlyRange));
    setText('sim-market-ral', formatRange(result.referenceSnapshot.marketRalRange));
    setText('sim-market-cost', formatRange(result.referenceSnapshot.marketCompanyCostRange));

    renderWarnings(result.warnings);
    renderNotes(result.referenceSnapshot.notes);
    updateBenchmarkLabel();
  }

  function collectPayload() {
    const checkedRate = form.querySelector('input[name="aliquota_forfettario"]:checked');
    return {
      audience: page.audience || 'worker',
      ruolo: form.querySelector('[name="ruolo"]').value,
      anni_esperienza: Number(form.querySelector('[name="anni_esperienza"]').value || 0),
      stipendio_netto_mensile_attuale: Number(form.querySelector('[name="stipendio_netto_mensile_attuale"]').value || 0),
      aliquota_forfettario: checkedRate ? Number(checkedRate.value) : 15
    };
  }

  async function refreshSimulation() {
    const token = ++requestToken;
    try {
      const response = await fetch('/api/simulatore-guadagno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectPayload())
      });

      if (!response.ok) throw new Error('Errore di calcolo');

      const result = await response.json();
      if (token === requestToken) renderSimulation(result);
    } catch (error) {
      if (window.showToast) window.showToast('Errore nel calcolo del simulatore');
    }
  }

  async function saveScenario() {
    const button = document.getElementById('sim-save-scenario');
    if (!button) return;
    button.disabled = true;
    setSaveStatus('Salvataggio in corso...', false);

    try {
      const response = await fetch('/api/simulatore-guadagno/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectPayload())
      });

      if (!response.ok) throw new Error('Errore di salvataggio');

      const payload = await response.json();
      if (payload.scenario) {
        savedScenarios = [payload.scenario].concat(savedScenarios.filter(item => item.id !== payload.scenario.id)).slice(0, 4);
        renderSavedScenarios();
      }

      setSaveStatus(page.saveSuccessMessage || 'Scenario salvato.', false);
      if (window.showToast) window.showToast(page.saveSuccessMessage || 'Scenario salvato');
    } catch (error) {
      setSaveStatus('Impossibile salvare lo scenario in questo momento.', true);
      if (window.showToast) window.showToast('Errore nel salvataggio dello scenario');
    } finally {
      button.disabled = false;
    }
  }

  async function useScenario() {
    const button = document.getElementById('sim-use-scenario');
    if (!button) return;
    button.disabled = true;
    setSaveStatus('Precompilazione del prossimo step...', false);

    try {
      const response = await fetch('/api/simulatore-guadagno/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectPayload())
      });

      if (!response.ok) throw new Error('Errore di precompilazione');

      const payload = await response.json();
      window.location.href = payload.nextUrl;
    } catch (error) {
      setSaveStatus('Impossibile usare questo scenario adesso.', true);
      if (window.showToast) window.showToast('Errore nella precompilazione');
      button.disabled = false;
    }
  }

  function hydrateScenarioFromCard(target) {
    const card = target.closest('.sim-saved-card');
    if (!card) return;

    form.querySelector('[name="ruolo"]').value = card.dataset.scenarioRole;
    form.querySelector('[name="anni_esperienza"]').value = card.dataset.scenarioYears;
    form.querySelector('[name="stipendio_netto_mensile_attuale"]').value = card.dataset.scenarioNet;
    const rateInput = form.querySelector(`input[name="aliquota_forfettario"][value="${card.dataset.scenarioRate}"]`);
    if (rateInput) rateInput.checked = true;

    updateBenchmarkLabel();
    refreshSimulation();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('input', updateBenchmarkLabel);
  form.addEventListener('change', refreshSimulation);

  let debounceTimer = null;
  form.addEventListener('input', event => {
    if (event.target.matches('[name="stipendio_netto_mensile_attuale"], [name="anni_esperienza"]')) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshSimulation, 180);
    }
    if (event.target.matches('[name="ruolo"]')) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshSimulation, 20);
    }
  });

  const benchmarkButton = document.getElementById('sim-use-benchmark');
  if (benchmarkButton) {
    benchmarkButton.addEventListener('click', () => {
      const role = form.querySelector('[name="ruolo"]').value;
      const years = form.querySelector('[name="anni_esperienza"]').value;
      const benchmark = getSuggestedBenchmark(role, years);
      if (benchmark) {
        form.querySelector('[name="stipendio_netto_mensile_attuale"]').value = benchmark;
        refreshSimulation();
      }
    });
  }

  const saveButton = document.getElementById('sim-save-scenario');
  if (saveButton) {
    saveButton.addEventListener('click', saveScenario);
  }

  const exportButton = document.getElementById('sim-export-pdf');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      window.location.href = buildExportUrl();
    });
  }

  const useButton = document.getElementById('sim-use-scenario');
  if (useButton) {
    useButton.addEventListener('click', useScenario);
  }

  const savedGrid = document.getElementById('sim-saved-grid');
  if (savedGrid) {
    savedGrid.addEventListener('click', event => {
      if (event.target.closest('.sim-saved-card')) {
        hydrateScenarioFromCard(event.target);
      }
    });
  }

  updateBenchmarkLabel();
  renderSavedScenarios();
  renderSimulation(initialState);
})();
