// TavoloLibero client-side utilities

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('tl-theme', next);
  document.querySelectorAll('.theme-icon-light').forEach(el => el.style.display = next === 'light' ? '' : 'none');
  document.querySelectorAll('.theme-icon-dark').forEach(el => el.style.display = next === 'dark' ? '' : 'none');
  document.querySelectorAll('.theme-label-light').forEach(el => el.style.display = next === 'light' ? '' : 'none');
  document.querySelectorAll('.theme-label-dark').forEach(el => el.style.display = next === 'dark' ? '' : 'none');
}

(function restoreTheme() {
  const saved = localStorage.getItem('tl-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelectorAll('.theme-icon-light').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.theme-icon-dark').forEach(el => el.style.display = '');
    document.querySelectorAll('.theme-label-light').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.theme-label-dark').forEach(el => el.style.display = '');
  }
})();

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

function showToast(message) {
  let toast = document.getElementById('tl-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tl-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--espresso);color:var(--sand);padding:12px 24px;border-radius:var(--radius-md);font-size:var(--fs-small);font-weight:500;z-index:9999;box-shadow:var(--shadow-lg);transform:translateY(80px);opacity:0;transition:all 0.3s cubic-bezier(0.16,1,0.3,1)';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.transform = 'translateY(80px)';
    toast.style.opacity = '0';
  }, 3000);
}

let calcRequestToken = 0;

async function calcStipendio() {
  const stipendioEl = document.getElementById('calc-stipendio');
  if (!stipendioEl) return;

  const stipendio = parseFloat(stipendioEl.value) || 1500;
  const aliqEl = document.querySelector('input[name="calc-aliq"]:checked');
  const aliquota = aliqEl ? parseFloat(aliqEl.value) : 15;
  const requestId = ++calcRequestToken;

  try {
    const res = await fetch('/api/simulatore-guadagno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ruolo: 'cameriere',
        anni_esperienza: 3,
        stipendio_netto_mensile_attuale: stipendio,
        aliquota_forfettario: aliquota
      })
    });

    if (!res.ok) {
      throw new Error('Calcolo non disponibile');
    }

    const data = await res.json();
    if (requestId !== calcRequestToken) return;

    const nettoEl = document.getElementById('calc-netto');
    const diffEl = document.getElementById('calc-diff');
    if (nettoEl) nettoEl.textContent = 'EUR ' + currencyFormatter.format(data.freelance.nettoMensile);
    if (diffEl) {
      diffEl.textContent = (data.delta.guadagnoMensile >= 0 ? '+' : '') + 'EUR ' + currencyFormatter.format(data.delta.guadagnoMensile) + '/mese';
      diffEl.style.background = data.delta.guadagnoMensile >= 0 ? 'var(--olive)' : 'var(--red)';
    }
  } catch (error) {
    const nettoEl = document.getElementById('calc-netto');
    if (nettoEl) nettoEl.textContent = 'n.d.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const calcInput = document.getElementById('calc-stipendio');
  if (calcInput) {
    calcInput.addEventListener('input', calcStipendio);
    document.querySelectorAll('input[name="calc-aliq"]').forEach(radio => radio.addEventListener('change', calcStipendio));
    calcStipendio();
  }

  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
});

async function sendMessage(event, partnerId) {
  event.preventDefault();
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch('/api/messaggi/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: partnerId, text })
    });
    if (res.ok) {
      window.location.reload();
    }
  } catch (error) {
    showToast('Errore nell\'invio del messaggio');
  }
}

async function candidati(annuncioId) {
  try {
    const res = await fetch('/api/candidatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annuncioId })
    });
    if (res.ok) {
      showToast('Candidatura inviata con successo!');
    }
  } catch (error) {
    showToast('Errore nell\'invio della candidatura');
  }
}

async function firmaContratto(contrattoId) {
  const check = document.getElementById('sign-check');
  if (!check || !check.checked) {
    showToast('Devi accettare i termini per firmare');
    return;
  }

  try {
    const res = await fetch('/api/contratti/' + contrattoId + '/firma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      showToast('Contratto firmato digitalmente!');
      setTimeout(() => window.location.reload(), 1500);
    }
  } catch (error) {
    showToast('Errore nella firma');
  }
}

async function preleva() {
  try {
    const res = await fetch('/api/wallet/preleva', { method: 'POST' });
    const data = await res.json();
    showToast(data.message);
  } catch (error) {
    showToast('Errore nella richiesta di prelievo');
  }
}

async function adminAction(url, successMsg) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      showToast(successMsg);
      setTimeout(() => window.location.reload(), 1000);
    }
  } catch (error) {
    showToast('Errore nell\'operazione');
  }
}

async function saveCommissioni() {
  const form = document.getElementById('comm-form');
  if (!form) return;

  const data = {
    servizio: form.querySelector('[name="servizio"]').value,
    giornata: form.querySelector('[name="giornata"]').value,
    evento: form.querySelector('[name="evento"]').value
  };

  try {
    const res = await fetch('/api/admin/commissioni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      showToast('Commissioni aggiornate');
    }
  } catch (error) {
    showToast('Errore nel salvataggio');
  }
}
