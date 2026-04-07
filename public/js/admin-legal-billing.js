(function () {
  const billingButton = document.getElementById('billing-run-button');
  const billingDate = document.getElementById('billing-run-date');
  const billingResult = document.getElementById('billing-run-result');
  const complianceButton = document.getElementById('compliance-check-button');
  const complianceResult = document.getElementById('compliance-check-result');

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      throw new Error(data.details || data.error || 'Operazione non riuscita');
    }

    return data;
  }

  if (billingButton && billingDate && billingResult) {
    billingButton.addEventListener('click', async () => {
      try {
        billingButton.disabled = true;
        billingButton.textContent = 'Esecuzione...';

        const value = billingDate.value
          ? new Date(billingDate.value).toISOString()
          : (window.TL_ADMIN_LEGAL_BILLING?.defaultBillingAsOf || new Date().toISOString());

        const result = await postJson('/api/payments/billing/run', {
          asOfDate: value
        });

        billingResult.innerHTML = `
          <div class="detail-list">
            <div class="detail-row">
              <span class="text-sm text-muted">Milestone processate</span>
              <strong>${escapeHtml(result.billing.createdCount)}</strong>
            </div>
            <div class="detail-row">
              <span class="text-sm text-muted">Payment order catturati</span>
              <strong>${escapeHtml(result.captures.capturedCount)}</strong>
            </div>
            <div class="detail-row">
              <span class="text-sm text-muted">As of</span>
              <strong>${escapeHtml(result.billing.asOfDate)}</strong>
            </div>
          </div>
        `;
        showToast('Billing cycle eseguito');
      } catch (error) {
        showToast(error.message || 'Billing cycle non riuscito');
      } finally {
        billingButton.disabled = false;
        billingButton.textContent = 'Esegui billing cycle';
      }
    });
  }

  if (complianceButton && complianceResult) {
    complianceButton.addEventListener('click', async () => {
      const workerProfileId = parseInt(document.getElementById('compliance-worker').value, 10);
      const restaurantProfileId = parseInt(document.getElementById('compliance-restaurant').value, 10);
      const grossAmountEur = parseFloat(document.getElementById('compliance-gross').value);
      const estimatedServiceDays = parseInt(document.getElementById('compliance-days').value, 10);

      try {
        complianceButton.disabled = true;
        complianceButton.textContent = 'Check in corso...';

        const result = await postJson('/api/contracts/compliance-check', {
          workerProfileId,
          restaurantProfileId,
          grossAmountEur,
          estimatedServiceDays
        });

        const reasons = (result.reasons || [])
          .map(item => `<div class="sim-warning-item">${escapeHtml(item.message)}</div>`)
          .join('');

        complianceResult.innerHTML = `
          <div class="detail-list">
            <div class="detail-row">
              <span class="text-sm text-muted">Decisione</span>
              <strong><span class="badge ${result.decision === 'allow' ? 'badge-olive' : result.decision === 'manual_review' ? 'badge-yellow' : 'badge-red'}">${escapeHtml(result.decision)}</span></strong>
            </div>
            <div class="detail-row">
              <span class="text-sm text-muted">Giorni proiettati</span>
              <strong>${escapeHtml(result.projected.days24m)}</strong>
            </div>
            <div class="detail-row">
              <span class="text-sm text-muted">Share proiettata</span>
              <strong>${escapeHtml(Math.round(result.projected.share24m * 100))}%</strong>
            </div>
          </div>
          <div class="sim-warning-list mt-md">${reasons || '<div class="sim-warning-item">Nessun rilievo.</div>'}</div>
        `;
        showToast('Controllo compliance completato');
      } catch (error) {
        showToast(error.message || 'Check compliance non riuscito');
      } finally {
        complianceButton.disabled = false;
        complianceButton.textContent = 'Esegui check';
      }
    });
  }
})();
