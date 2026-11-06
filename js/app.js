(() => {
  const TYPES = { repo: 'リポジトリ', artifact: 'Artifact', local: 'ローカル' };
  const STATUS = { active: '作業中', done: '完成', paused: '休止' };
  const state = { items: [], type: 'all', category: 'all', q: '', sort: 'updated', view: 'list' };
  const $ = (s) => document.querySelector(s);

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lastLog = (it) => (it.log || []).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const updatedOf = (it) => (lastLog(it)?.date || it.created || '');

  fetch('data/records.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => {
      state.items = data.items || [];
      if (data.updated) $('#updated').textContent = `最終更新: ${data.updated}`;
      setup();
      render();
    })
    .catch(() => { $('#empty').hidden = false; $('#empty').textContent = 'data/records.json を読み込めませんでした。'; });

  function setup() {
    const types = ['all', ...Object.keys(TYPES)];
    $('#typeChips').innerHTML = types.map((t) =>
      `<button class="chip${t === 'all' ? ' is-active' : ''}" data-type="${t}">${t === 'all' ? 'すべて' : TYPES[t]}</button>`).join('');
    $('#typeChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      state.type = b.dataset.type;
      document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === b));
      render();
    });
    const cats = [...new Set(state.items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
    $('#category').innerHTML = `<option value="all">カテゴリ: すべて</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join('');
    $('#category').addEventListener('change', (e) => { state.category = e.target.value; render(); });
    $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
    $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      state.view = t.dataset.view;
      document.querySelectorAll('.tab').forEach((x) => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', x === t); });
      render();
    }));
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-open]'); if (el) openDetail(el.dataset.open);
    });
    const id = location.hash.slice(1);
    if (id) setTimeout(() => openDetail(decodeURIComponent(id)), 0);
  }

  function filtered() {
    return state.items.filter((it) => {
      if (state.type !== 'all' && it.type !== state.type) return false;
      if (state.category !== 'all' && it.category !== state.category) return false;
      if (!state.q) return true;
      const hay = [it.name, it.purpose, it.category, ...(it.tags || []), ...(it.log || []).map((l) => l.summary)].join(' ').toLowerCase();
      return hay.includes(state.q);
    });
  }

  function render() {
    const items = filtered();
    renderStats();
    $('#list').hidden = state.view !== 'list';
    $('#timeline').hidden = state.view !== 'timeline';
    if (state.view === 'list') renderList(items); else renderTimeline(items);
    $('#empty').hidden = items.length > 0;
  }

  function renderStats() {
    const all = state.items;
    const logs = all.reduce((n, i) => n + (i.log || []).length, 0);
    const box = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
    $('#stats').innerHTML = box(all.length, '記録した作品')
      + Object.entries(TYPES).map(([k, v]) => box(all.filter((i) => i.type === k).length, v)).join('')
      + box(logs, '作業ログ');
  }

  function meta(it) {
    return `<div class="meta"><span class="badge ${it.type}">${TYPES[it.type] || it.type}</span>`
      + (it.category ? `<span class="tag">${esc(it.category)}</span>` : '')
      + (it.status ? `<span class="status">${STATUS[it.status] || esc(it.status)}</span>` : '')
      + `</div>`;
  }

  function renderList(items) {
    const s = state.sort;
    items = items.slice().sort((a, b) =>
      s === 'name' ? a.name.localeCompare(b.name, 'ja')
      : s === 'created' ? (b.created || '').localeCompare(a.created || '')
      : updatedOf(b).localeCompare(updatedOf(a)));
    $('#list').innerHTML = items.map((it) => {
      const l = lastLog(it);
      return `<button class="card" data-open="${esc(it.id)}">
        ${meta(it)}
        <h2>${esc(it.name)}</h2>
        <p class="purpose">${esc(it.purpose)}</p>
        ${l ? `<div class="last"><time>${esc(l.date)}</time>${esc(l.summary)}</div>` : ''}
      </button>`;
    }).join('');
  }

  function renderTimeline(items) {
    const rows = items.flatMap((it) => (it.log || []).map((l) => ({ it, ...l })));
    const byDay = {};
    rows.forEach((r) => (byDay[r.date] ||= []).push(r));
    $('#timeline').innerHTML = Object.keys(byDay).sort().reverse().map((d) => `
      <div class="tl-day"><h3>${esc(d)}</h3>
        ${byDay[d].map((r) => `<div class="tl-item"><button data-open="${esc(r.it.id)}">${esc(r.it.name)}</button><span>${esc(r.summary)}</span></div>`).join('')}
      </div>`).join('');
  }

  function openDetail(id) {
    const it = state.items.find((i) => i.id === id); if (!it) return;
    const L = it.links || {};
    const links = [
      L.site && `<a href="${esc(L.site)}" target="_blank" rel="noopener">サイトを開く</a>`,
      L.repo && `<a href="${esc(L.repo)}" target="_blank" rel="noopener">GitHub</a>`,
      L.artifact && `<a href="${esc(L.artifact)}" target="_blank" rel="noopener">Artifact を開く</a>`,
      L.path && `<span>場所: <code>${esc(L.path)}</code></span>`,
    ].filter(Boolean).join('');
    const logs = (it.log || []).slice().sort((a, b) => b.date.localeCompare(a.date));
    $('#detailBody').innerHTML = `
      ${meta(it)}
      <h2>${esc(it.name)}</h2>
      <div class="links">${links}</div>
      <h3>目的</h3><p>${esc(it.purpose)}</p>
      ${it.notes ? `<h3>メモ</h3><p>${esc(it.notes)}</p>` : ''}
      ${(it.tags || []).length ? `<div class="meta">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <h3>作業記録（${logs.length}件）</h3>
      <ol>${logs.map((l) => `<li><time>${esc(l.date)}${l.source ? ' · ' + esc(l.source) : ''}</time>${esc(l.summary)}</li>`).join('')}</ol>`;
    history.replaceState(null, '', '#' + encodeURIComponent(id));
    $('#detail').showModal();
  }
  $('#detail').addEventListener('close', () => history.replaceState(null, '', location.pathname));
})();
