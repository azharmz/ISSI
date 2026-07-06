const els = {
  rawInput: document.getElementById('rawInput'),
  btnParse: document.getElementById('btnParse'),
  parseStatus: document.getElementById('parseStatus'),
  btnRefresh: document.getElementById('btnRefresh'),
  signalsGrid: document.getElementById('signalsGrid'),
  signalCount: document.getElementById('signalCount'),
  emptyState: document.getElementById('emptyState'),
  filterHalal: document.getElementById('filterHalal'),
  btnManageIssi: document.getElementById('btnManageIssi'),
  issiModal: document.getElementById('issiModal'),
  issiInput: document.getElementById('issiInput'),
  btnSaveIssi: document.getElementById('btnSaveIssi'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  issiStatus: document.getElementById('issiStatus'),
};

let currentSignals = [];
let currentFilter = 'all';
let issiListEmpty = false;

const ADMIN_KEY_STORAGE = 'idx_issi_admin_key';

// Admin key cuma diminta sekali (lewat prompt), lalu disimpan di localStorage browser
// device ini. Dipakai sebagai header x-admin-key untuk endpoint yang bisa nulis data
// (parse-signal, issi-list). Kalau salah, backend akan balas 401.
function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || '';
}

function ensureAdminKey() {
  let key = getAdminKey();
  if (!key) {
    key = window.prompt('Masukkan admin key (sekali saja, akan disimpan di browser ini):') || '';
    if (key) localStorage.setItem(ADMIN_KEY_STORAGE, key);
  }
  return key;
}

function formatRupiah(n) {
  if (n === null || n === undefined) return '-';
  return 'Rp' + n.toLocaleString('id-ID');
}

function pctClass(pct) {
  if (!pct) return '';
  return pct.trim().startsWith('-') ? 'pct-neg' : 'pct-pos';
}

function bandarColor(bandarmology) {
  const label = bandarmology?.sinyalBandar?.label?.toUpperCase();
  if (label === 'BUY') return 'var(--accent-halal)';
  if (label === 'SELL') return 'var(--accent-red)';
  return 'var(--accent-neutral)';
}

function renderCard(signal) {
  const barColor = bandarColor(signal.bandarmology);
  const halalBadge = signal.isHalal
    ? '<span class="badge-halal">HALAL</span>'
    : '<span class="badge-nonhalal">NON-HALAL</span>';

  const confidenceText = signal.confidence
    ? `${signal.confidence.emoji} ${signal.confidence.score}/10 · ${signal.confidence.label}`
    : 'belum ada skor';

  const bandarText = signal.bandarmology?.status
    ? signal.bandarmology.status
    : signal.bandarmology?.sinyalBandar
    ? `${signal.bandarmology.sinyalBandar.emoji} ${signal.bandarmology.sinyalBandar.label} · net ${signal.bandarmology.smartMoneyNet || '-'} lot`
    : 'data bandarmology tidak tersedia';

  const detailId = `detail-${signal.id}`;

  const technicalRows = signal.technical
    ? Object.entries(signal.technical)
        .map(([key, val]) => {
          if (key === 'bb') return `<div><dt>BB</dt> Rp${val.lower?.toLocaleString('id-ID')} - Rp${val.upper?.toLocaleString('id-ID')}</div>`;
          if (key === 'atr') return `<div><dt>ATR</dt> Rp${val?.toLocaleString('id-ID')}</div>`;
          if (val && typeof val === 'object') {
            const parts = Object.entries(val)
              .filter(([k]) => !['emoji'].includes(k))
              .map(([k, v]) => `${k}: ${v ?? '-'}`)
              .join(' · ');
            return `<div><dt>${key.toUpperCase()}</dt> ${parts}</div>`;
          }
          return '';
        })
        .join('')
    : '<div>Tidak ada data teknikal</div>';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.setProperty('--bar-color', barColor);
  card.innerHTML = `
    <div class="card__head">
      <div class="card__ticker">${signal.ticker} ${halalBadge}</div>
      <div class="card__confidence">${confidenceText}</div>
    </div>
    <div class="card__prices">
      <div class="price-block">
        <div class="price-block__label">Entry</div>
        <div class="price-block__value">${formatRupiah(signal.entryPrice)}</div>
      </div>
      <div class="price-block">
        <div class="price-block__label">TP1</div>
        <div class="price-block__value">${formatRupiah(signal.tp1?.price)}</div>
        <div class="price-block__pct ${pctClass(signal.tp1?.pct)}">${signal.tp1?.pct || '-'}</div>
      </div>
      <div class="price-block">
        <div class="price-block__label">SL Default</div>
        <div class="price-block__value">${formatRupiah(signal.stopLoss?.default?.price)}</div>
        <div class="price-block__pct ${pctClass(signal.stopLoss?.default?.pct)}">${signal.stopLoss?.default?.pct || '-'}</div>
      </div>
    </div>
    <div class="card__bandar">
      <span>${bandarText}</span>
      <button class="card__toggle" data-target="${detailId}">Detail</button>
    </div>
    <dl class="card__detail" id="${detailId}" hidden>
      ${technicalRows}
      ${signal.pattern ? `<div><dt>Chart</dt> ${signal.pattern.chart || '-'}</div><div><dt>Candle</dt> ${signal.pattern.candle || '-'}</div>` : ''}
      ${signal.confidence?.reasons?.length ? `<div><dt>Alasan Skor</dt> ${signal.confidence.reasons.map((r) => `${r.delta > 0 ? '+' : ''}${r.delta} ${r.reason}`).join(', ')}</div>` : ''}
      ${signal.analystOpinion ? `<div><dt>Analisis</dt> ${signal.analystOpinion}</div>` : ''}
      ${signal.news?.length ? `<div><dt>Berita</dt> ${signal.news.join(' · ')}</div>` : ''}
    </dl>
  `;
  card.querySelector('.card__toggle').addEventListener('click', (e) => {
    const target = document.getElementById(e.target.dataset.target);
    target.hidden = !target.hidden;
    e.target.textContent = target.hidden ? 'Detail' : 'Tutup';
  });
  return card;
}

function renderSignals() {
  const filtered = currentSignals.filter((s) => {
    if (currentFilter === 'halal') return s.isHalal;
    if (currentFilter === 'non-halal') return !s.isHalal;
    return true;
  });

  els.signalsGrid.innerHTML = '';
  filtered.forEach((s) => els.signalsGrid.appendChild(renderCard(s)));
  els.signalCount.textContent = `${filtered.length} sinyal`;
  els.emptyState.hidden = filtered.length > 0;

  if (issiListEmpty && currentSignals.length > 0) {
    els.signalCount.textContent += ' — ⚠️ daftar ISSI belum diisi, semua status "NON-HALAL" sementara default';
  }
}

async function loadSignals() {
  const res = await fetch('/api/signals');
  const data = await res.json();
  currentSignals = data.signals || [];
  renderSignals();
}

els.btnParse.addEventListener('click', async () => {
  const rawText = els.rawInput.value.trim();
  if (!rawText) return;
  const adminKey = ensureAdminKey();
  if (!adminKey) return;
  els.btnParse.disabled = true;
  els.parseStatus.textContent = 'Memproses...';
  try {
    const res = await fetch('/api/parse-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ rawText }),
    });
    const data = await res.json();
    if (res.status === 401) {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      throw new Error('Admin key salah, coba lagi (akan diminta ulang).');
    }
    if (!res.ok) throw new Error(data.error || 'Gagal parsing');
    issiListEmpty = !!data.issiListEmpty;
    els.parseStatus.textContent = `${data.saved.length} sinyal tersimpan.`;
    els.rawInput.value = '';
    await loadSignals();
  } catch (err) {
    els.parseStatus.textContent = `Error: ${err.message}`;
  } finally {
    els.btnParse.disabled = false;
  }
});

els.btnRefresh.addEventListener('click', loadSignals);

els.filterHalal.addEventListener('click', (e) => {
  if (!e.target.dataset.filter) return;
  currentFilter = e.target.dataset.filter;
  [...els.filterHalal.children].forEach((c) => c.classList.remove('filter-chip--active'));
  e.target.classList.add('filter-chip--active');
  renderSignals();
});

els.btnManageIssi.addEventListener('click', async () => {
  els.issiModal.hidden = false;
  const res = await fetch('/api/issi-list');
  const data = await res.json();
  els.issiInput.value = (data.tickers || []).join('\n');
});
els.btnCloseModal.addEventListener('click', () => { els.issiModal.hidden = true; });
els.btnSaveIssi.addEventListener('click', async () => {
  const adminKey = ensureAdminKey();
  if (!adminKey) return;
  const tickers = els.issiInput.value.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
  els.issiStatus.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/issi-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ tickers }),
    });
    const data = await res.json();
    if (res.status === 401) {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      throw new Error('Admin key salah, coba lagi (akan diminta ulang).');
    }
    if (!res.ok) throw new Error(data.error);
    issiListEmpty = data.tickers.length === 0;
    els.issiStatus.textContent = `Tersimpan: ${data.tickers.length} ticker.`;
    await loadSignals();
  } catch (err) {
    els.issiStatus.textContent = `Error: ${err.message}`;
  }
});

loadSignals();
