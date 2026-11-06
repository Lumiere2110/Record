(() => {
  const REPO = 'Lumiere2110/Record';
  const DATA_PATH = 'data/records.json';
  const API = `https://api.github.com/repos/${REPO}/contents/${DATA_PATH}`;
  const TOKEN_KEY = 'record.githubToken';
  const TYPES = { repo: 'リポジトリ', artifact: 'Artifact', local: 'ローカル' };
  const STATUS = { active: '作業中', done: '完成', paused: '休止' };
  const state = { items: [], type: 'all', category: 'all', q: '', sort: 'updated', view: 'list', openId: null, editing: null };
  const $ = (s) => document.querySelector(s);

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lastLog = (it) => (it.log || []).slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const updatedOf = (it) => (lastLog(it)?.date || it.created || '');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---- token (stored only in this browser) ----
  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
  const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

  // ---- GitHub contents API ----
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const b64encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  async function gh(method, body) {
    const res = await fetch(API + (method === 'GET' ? `?ref=main&t=${Date.now()}` : ''), {
      method,
      headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const msg = res.status === 401 ? 'トークンが正しくないか、期限切れです'
        : res.status === 403 || res.status === 404 ? 'トークンに Record への書き込み権限がありません'
        : res.status === 409 ? '同時に更新されました。もう一度保存してください'
        : `GitHub エラー (${res.status})`;
      throw new Error(msg);
    }
    return res.json();
  }
  async function loadRemote() {
    const file = await gh('GET');
    return { sha: file.sha, data: JSON.parse(b64decode(file.content)) };
  }
  // Read the latest file, apply the change, and commit it.
  async function commit(mutate, message) {
    if (!getToken()) throw new Error('NO_TOKEN');
    const { sha, data } = await loadRemote();
    mutate(data);
    data.updated = today();
    await gh('PUT', { message, sha, branch: 'main', content: b64encode(JSON.stringify(data, null, 2) + '\n') });
    applyData(data);
  }

  // ---- load ----
  function applyData(data) {
    state.items = data.items || [];
    $('#updated').textContent = data.updated ? `最終更新: ${data.updated}` : '';
  }
  async function load() {
    if (getToken()) {
      try { applyData((await loadRemote()).data); return; } catch { /* fall back to the published file */ }
    }
    const r = await fetch(DATA_PATH, { cache: 'no-store' });
    applyData(await r.json());
  }
  load()
    .then(() => { setup(); render(); })
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
    fillCategories();
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
    $('#detailBody').addEventListener('click', onMemoClick);
    $('#detailBody').addEventListener('submit', onMemoSubmit);
    $('#detail').addEventListener('close', () => { state.openId = null; state.editing = null; history.replaceState(null, '', location.pathname); });
    setupSettings();
    const id = location.hash.slice(1);
    if (id) setTimeout(() => openDetail(decodeURIComponent(id)), 0);
  }

  function fillCategories() {
    const cats = [...new Set(state.items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
    $('#category').innerHTML = `<option value="all">カテゴリ: すべて</option>` + cats.map((c) => `<option${c === state.category ? ' selected' : ''}>${esc(c)}</option>`).join('');
  }

  function filtered() {
    return state.items.filter((it) => {
      if (state.type !== 'all' && it.type !== state.type) return false;
      if (state.category !== 'all' && it.category !== state.category) return false;
      if (!state.q) return true;
      const hay = [it.name, it.purpose, it.category, it.notes, ...(it.tags || []), ...(it.log || []).map((l) => l.summary), ...(it.memos || []).map((m) => m.text)].join(' ').toLowerCase();
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
    const count = (k) => all.reduce((n, i) => n + (i[k] || []).length, 0);
    const box = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
    $('#stats').innerHTML = box(all.length, '記録した作品')
      + Object.entries(TYPES).map(([k, v]) => box(all.filter((i) => i.type === k).length, v)).join('')
      + box(count('log'), '作業ログ') + box(count('memos'), 'メモ');
  }

  function meta(it) {
    return `<div class="meta"><span class="badge ${it.type}">${TYPES[it.type] || it.type}</span>`
      + (it.category ? `<span class="tag">${esc(it.category)}</span>` : '')
      + (it.status ? `<span class="status">${STATUS[it.status] || esc(it.status)}</span>` : '')
      + ((it.memos || []).length ? `<span class="memo-count">メモ ${it.memos.length}</span>` : '')
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

  // ---- detail ----
  function openDetail(id) {
    const it = state.items.find((i) => i.id === id); if (!it) return;
    if (state.openId !== id) state.editing = null;
    state.openId = id;
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
      ${it.notes ? `<p class="notes">${esc(it.notes)}</p>` : ''}
      ${(it.tags || []).length ? `<div class="meta">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <h3>メモ（${(it.memos || []).length}件）</h3>
      <div id="memoArea">${memoHtml(it)}</div>
      <h3>作業記録（${logs.length}件）</h3>
      <ol class="logs">${logs.map((l) => `<li><time>${esc(l.date)}${l.source ? ' · ' + esc(l.source) : ''}</time>${esc(l.summary)}</li>`).join('')}</ol>`;
    history.replaceState(null, '', '#' + encodeURIComponent(id));
    if (!$('#detail').open) $('#detail').showModal();
  }

  function memoHtml(it) {
    const memos = (it.memos || []).slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    const editing = memos.find((m) => m.id === state.editing);
    const hasToken = !!getToken();
    return `
      <ul class="memos">${memos.map((m) => `
        <li class="memo${m.id === state.editing ? ' is-editing' : ''}">
          <div class="memo-head"><time>${esc(m.date)}${m.edited ? `（${esc(m.edited)} 編集）` : ''}</time>
            ${hasToken ? `<span><button class="link" data-memo-edit="${esc(m.id)}">編集</button><button class="link danger" data-memo-del="${esc(m.id)}">削除</button></span>` : ''}
          </div>
          <div class="memo-text">${esc(m.text)}</div>
        </li>`).join('') || '<li class="memo-empty">まだメモはありません。</li>'}
      </ul>
      ${hasToken ? `
      <form class="memo-form" id="memoForm">
        <textarea id="memoText" rows="4" placeholder="メモを書く（Ctrl+Enter で保存）">${esc(editing?.text || '')}</textarea>
        <div class="memo-actions">
          <span class="memo-status" id="memoStatus" role="status"></span>
          ${editing ? '<button type="button" class="btn" data-memo-cancel>やめる</button>' : ''}
          <button type="submit" class="btn primary">${editing ? 'メモを更新' : 'メモを保存'}</button>
        </div>
      </form>` : `
      <p class="memo-hint">メモを書くには、右上の「メモの設定」で GitHub のトークンを登録してください。</p>`}`;
  }

  function setStatus(text, isError) {
    const el = $('#memoStatus'); if (!el) return;
    el.textContent = text; el.classList.toggle('error', !!isError);
  }
  async function run(fn, doneMsg) {
    const btns = $('#memoArea').querySelectorAll('button, textarea');
    btns.forEach((b) => (b.disabled = true));
    setStatus('保存中…');
    try {
      await fn();
      state.editing = null;
      openDetail(state.openId);
      fillCategories();
      render();
      setStatus(doneMsg);
    } catch (e) {
      btns.forEach((b) => (b.disabled = false));
      setStatus(e.message === 'NO_TOKEN' ? 'トークンが未設定です' : e.message, true);
    }
  }

  function onMemoSubmit(e) {
    if (e.target.id !== 'memoForm') return;
    e.preventDefault();
    const text = $('#memoText').value.trim();
    if (!text) { setStatus('メモが空です', true); return; }
    const id = state.openId;
    const editId = state.editing;
    const name = state.items.find((i) => i.id === id)?.name || id;
    run(() => commit((data) => {
      const it = data.items.find((i) => i.id === id);
      if (!it) throw new Error('この作品が見つかりません');
      it.memos ||= [];
      if (editId) {
        const m = it.memos.find((x) => x.id === editId);
        if (!m) throw new Error('このメモは削除されています');
        m.text = text; m.edited = today();
      } else {
        it.memos.push({ id: Date.now().toString(36), date: today(), text });
      }
    }, `メモ${editId ? 'を更新' : 'を追加'}: ${name}`), '保存しました（公開サイトへの反映は1〜2分後）');
  }

  function onMemoClick(e) {
    const edit = e.target.closest('[data-memo-edit]');
    const del = e.target.closest('[data-memo-del]');
    if (e.target.closest('[data-memo-cancel]')) { state.editing = null; openDetail(state.openId); return; }
    if (edit) {
      state.editing = edit.dataset.memoEdit;
      openDetail(state.openId);
      const ta = $('#memoText'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      return;
    }
    if (del) {
      if (!confirm('このメモを削除しますか？')) return;
      const id = state.openId, memoId = del.dataset.memoDel;
      const name = state.items.find((i) => i.id === id)?.name || id;
      run(() => commit((data) => {
        const it = data.items.find((i) => i.id === id);
        if (it) it.memos = (it.memos || []).filter((m) => m.id !== memoId);
      }, `メモを削除: ${name}`), '削除しました');
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'memoText') $('#memoForm').requestSubmit();
  });

  // ---- settings ----
  function setupSettings() {
    const dlg = $('#settings');
    const refresh = () => {
      $('#tokenState').textContent = getToken() ? 'この端末にトークンが登録されています。' : 'トークンは未登録です。';
      $('#tokenInput').value = '';
    };
    $('#openSettings').addEventListener('click', () => { refresh(); $('#settingsStatus').textContent = ''; dlg.showModal(); });
    $('#tokenSave').addEventListener('click', async () => {
      const t = $('#tokenInput').value.trim();
      if (!t) { $('#settingsStatus').textContent = 'トークンを入力してください'; return; }
      const prev = getToken();
      setToken(t);
      $('#settingsStatus').textContent = '確認中…';
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' } });
        const repo = res.ok ? await res.json() : null;
        if (!repo?.permissions?.push) throw new Error();
        $('#settingsStatus').textContent = '登録しました。';
        refresh(); afterTokenChange();
      } catch {
        setToken(prev);
        $('#settingsStatus').textContent = 'このトークンでは Record に書き込めません。権限を確認してください。';
      }
    });
    $('#tokenClear').addEventListener('click', () => { setToken(''); refresh(); $('#settingsStatus').textContent = '削除しました。'; afterTokenChange(); });
  }
  function afterTokenChange() { if (state.openId) openDetail(state.openId); }
})();
