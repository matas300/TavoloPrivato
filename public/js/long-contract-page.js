(function () {
  const form = document.getElementById('long-contract-form');
  const complianceBox = document.getElementById('long-contract-compliance');
  const resultBox = document.getElementById('long-contract-result');
  const checkButton = document.getElementById('long-contract-check');

  if (!form || !complianceBox || !resultBox) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toDateLabel(value) {
    if (!value) return 'n/d';
    return new Date(value).toLocaleDateString('it-IT');
  }

  function toMoney(value) {
    return new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function buildPayload() {
    const data = new FormData(form);
    const scopeOfWork = String(data.get('scopeOfWork') || '')
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);

    return {
      workerProfileId: parseInt(data.get('workerProfileId'), 10),
      startDate: data.get('startDate'),
      endDate: data.get('endDate'),
      estimatedServiceDays: parseInt(data.get('estimatedServiceDays'), 10),
      monthlyGrossAmountEur: parseFloat(data.get('monthlyGrossAmountEur')),
      paymentTermsDays: data.get('paymentTermsDays'),
      paymentTermsBase: data.get('paymentTermsBase'),
      objectiveSummary: data.get('objectiveSummary'),
      scopeOfWorkJson: scopeOfWork,
      serviceType: data.get('serviceType')
    };
  }

  function renderCompliance(state) {
    if (!state) {
      complianceBox.innerHTML = '<p class="text-sm text-muted">Compila il form e lancia il controllo. Qui vedrai blocchi 240 giorni, 80% concentrazione, ex-datore e safe harbor.</p>';
      return;
    }

    const badgeClass = state.decision === 'allow'
      ? 'badge-olive'
      : state.decision === 'manual_review'
        ? 'badge-yellow'
        : 'badge-red';

    const reasons = (state.reasons || [])
      .map(reason => `<div class="sim-warning-item">${escapeHtml(reason.message)}</div>`)
      .join('');

    complianceBox.innerHTML = `
      <div class="detail-list">
        <div class="detail-row">
          <span class="text-sm text-muted">Decisione</span>
          <strong><span class="badge ${badgeClass}">${escapeHtml(state.decision)}</span></strong>
        </div>
        <div class="detail-row">
          <span class="text-sm text-muted">Giorni proiettati 24 mesi</span>
          <strong>${escapeHtml(state.projected.days24m)}</strong>
        </div>
        <div class="detail-row">
          <span class="text-sm text-muted">Concentrazione proiettata</span>
          <strong>${escapeHtml(Math.round(state.projected.share24m * 100))}%</strong>
        </div>
        <div class="detail-row">
          <span class="text-sm text-muted">Safe harbor</span>
          <strong>${state.seniorExempt ? 'attivo' : 'no'}</strong>
        </div>
      </div>
      <div class="sim-warning-list mt-md">${reasons || '<div class="sim-warning-item">Nessun rilievo bloccante.</div>'}</div>
    `;
  }

  function renderResult(result) {
    const milestoneRows = (result.milestones || [])
      .map(item => `
        <tr>
          <td>${escapeHtml(item.milestoneLabel)}</td>
          <td>${toDateLabel(item.invoiceDate)}</td>
          <td>${toDateLabel(item.dueDate)}</td>
          <td>EUR ${toMoney(item.grossAmountEur)}</td>
          <td>EUR ${toMoney(item.workerNetEur)}</td>
        </tr>
      `)
      .join('');

    resultBox.innerHTML = `
      <div class="alert-box alert-info">
        <i data-lucide="file-check-2" style="width:20px;height:20px;flex-shrink:0;color:var(--olive)"></i>
        <div>
          <strong class="text-sm">Contratto lungo generato</strong>
          <p class="text-sm text-muted mt-sm">Il PDF e disponibile subito e il piano milestone e stato salvato nel database.</p>
        </div>
      </div>
      <div class="sim-action-buttons mb-md">
        <a class="btn btn-primary" href="${escapeHtml(result.pdfUrl)}" target="_blank" rel="noreferrer">Apri PDF contratto</a>
        <button type="button" class="btn btn-ghost" id="long-contract-refresh">Aggiorna archivio</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Fattura</th>
              <th>Scadenza</th>
              <th>Lordo</th>
              <th>Netto</th>
            </tr>
          </thead>
          <tbody>${milestoneRows}</tbody>
        </table>
      </div>
    `;

    const refreshButton = document.getElementById('long-contract-refresh');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => window.location.reload());
    }

    if (window.lucide) window.lucide.createIcons();
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.details || data.error || 'Richiesta non riuscita');
    }
    return data;
  }

  async function runComplianceCheck() {
    const payload = buildPayload();
    const state = await postJson('/api/contracts/compliance-check', payload);
    renderCompliance(state);
    return state;
  }

  checkButton.addEventListener('click', async () => {
    try {
      checkButton.disabled = true;
      checkButton.textContent = 'Controllo in corso...';
      await runComplianceCheck();
    } catch (error) {
      showToast(error.message || 'Controllo compliance non riuscito');
    } finally {
      checkButton.disabled = false;
      checkButton.textContent = 'Controlla compliance';
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');

    try {
      submitButton.disabled = true;
      submitButton.textContent = 'Generazione in corso...';
      const compliance = await runComplianceCheck();
      if (compliance.decision === 'hard_stop') {
        throw new Error('Il motore compliance ha bloccato questo contratto. Correggi i parametri o ruota il professionista.');
      }

      const result = await postJson('/api/contracts/long-term', buildPayload());
      renderCompliance(result.compliance);
      renderResult(result);
      showToast('Contratto lungo generato con successo');
    } catch (error) {
      showToast(error.message || 'Generazione contratto non riuscita');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Genera contratto lungo';
    }
  });
})();
