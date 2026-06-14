import HashSearch from './hash-search.js';
import Timelines from './timelines.js';
import MapView from './map-view.js';
import state from './state.js';
import { routeTo, setRouterState, getState, _searchShow, _searchClose, nearestYear, _showError, _fmtYear, _ric, setPageMeta } from './router.js';

let _homeEvents = [];
let _onEventSelected = null;

function _renderEventList(year, yearData) {
  const body = document.getElementById('home-event-list');
  const events = yearData.v;
  _homeEvents = events;
  if (!body) return;
  if (!events || events.length === 0) { body.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;padding:8px;">该年份暂无记录事件</p>'; return; }
  const groups = {};
  events.forEach(e => { const co = e.o || '其他', r = e.r || '其他'; if (!groups[co]) groups[co] = {}; if (!groups[co][r]) groups[co][r] = []; groups[co][r].push(e); });
  const coOrder = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '美洲', '南极洲', '世界', '全球', '其他'];
  let html = '';
  coOrder.forEach(co => { if (!groups[co]) return; html += `<div class="event-continent-group"><div class="event-continent-title">${co}</div>`;
    Object.keys(groups[co]).sort().forEach(r => {
      html += `<div class="event-region-group"><div class="event-region-title">${r}</div><div class="event-region-items">`;
      groups[co][r].forEach(e => { html += `<div class="event-item" data-title="${e.t.replace(/"/g, '&quot;')}"><span class="event-item-dot"></span><span class="event-item-cat">${e.c || '事件'}</span><span class="event-item-title">${e.t}</span></div>`; });
      html += '</div></div>';
    }); html += '</div>'; });
  body.innerHTML = html;
}

function _showDetail(evt) {
  const ids = ['event-detail-title', 'event-detail-category', 'event-detail-continent', 'event-detail-region'];
  const vals = [evt.t, evt.c || '历史事件', evt.o || '', evt.r || ''];
  ids.forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = vals[i]; });
  const descEl = document.getElementById('event-detail-description');
  if (descEl) descEl.innerHTML = (evt.s || '暂无描述') + '<br><small class="disclaimer">⚠️免责声明：内容源自互联网公开信息整理，不保证准确完整，仅供科普参考，不构成任何建议。</small>';
  const panel = document.getElementById('event-detail-panel');
  if (panel) panel.classList.remove('hidden');
}

function _hideDetail() { const p = document.getElementById('event-detail-panel'); if (p) p.classList.add('hidden'); }

async function _loadAndShowEvents(year) {
  try {
    const yd = await HashSearch.getYearData(year);
    const rq = document.getElementById('rule-quote');
    if (rq) { const dd = yd.d; if (dd && dd.length > 0) { const parts = [dd[0].n, dd[0].u, dd[0].e].filter(Boolean); rq.innerHTML = `<span class="rule-year">${_fmtYear(year)}，</span>${parts.join('，')}`; } else rq.innerHTML = `<span class="rule-year">${_fmtYear(year)}</span>`; }
    const md = document.getElementById('mob-year-display');
    if (md) md.textContent = _fmtYear(year);
    MapView.showEvents(yd.v);
    _renderEventList(year, yd);
  } catch (_) {
    _showError('数据加载失败');
    const h = document.getElementById('map-empty-hint');
    if (h) h.classList.remove('hidden');
    MapView.clearMarkers();
    const body = document.getElementById('home-event-list');
    if (body) {
      body.innerHTML = `<div style="text-align:center;padding:12px;color:var(--color-text-muted);font-size:12px;">
        加载失败
        <button id="retry-load-btn" style="margin-left:8px;background:var(--color-accent);color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;">重试</button>
      </div>`;
      const btn = document.getElementById('retry-load-btn');
      if (btn) btn.addEventListener('click', () => _loadAndShowEvents(year));
    }
    _renderEventList(year, { d: [], v: [] });
  }
}

async function _navigateToYear(year) {
  state.currentYear = year; state.selectedDynasty = null;
  const ad = HashSearch.dynasties.find(d => year >= d.start && year <= d.end);
  if (ad) state.selectedDynasty = ad.id;
  Timelines.dynastyDraw(); Timelines.calendarDraw();
  await _loadAndShowEvents(year);
}

async function _buildSearchIndex(onProgress) {
  const SK = 'shilu_search_index';
  const SI_VERSION = 2;
  try {
    const c = sessionStorage.getItem(SK);
    if (c) { const p = JSON.parse(c); if (p && p._version === SI_VERSION && p._events && p._events.length > 7000) { state.searchIndex = p; state.searchIndexReady = true; return; } }
  } catch (_) {}

  const all = [];
  const files = HashSearch.getAllFileNames();

  const CHUNK = 4;
  for (let i = 0; i < files.length; i += CHUNK) {
    await new Promise(resolve => {
      const doWork = () => {
        const chunk = files.slice(i, i + CHUNK);
        for (const f of chunk) {
          const d = HashSearch.getCached(f);
          if (d) { for (const e of d) { if (e && e.v) { for (const evt of e.v) all.push({ y: e.y, ...evt }); } } }
        }
        if (onProgress) onProgress(Math.min(i + CHUNK, files.length), files.length);
        resolve();
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(doWork, { timeout: 2000 });
      } else {
        setTimeout(doWork, 0);
      }
    });
  }

  all.sort((a, b) => a.y - b.y);
  state.searchIndex = { _version: SI_VERSION, _events: all };
  state.searchIndexReady = true;

  const serialized = JSON.stringify(state.searchIndex);
  try { sessionStorage.setItem(SK, serialized); } catch (_) { console.warn('[实录] 搜索索引缓存失败，sessionStorage 可能已满'); }
}

let _allEventsCache = [];
let _activeFilters = { category: new Set() };

function _buildFilterChips() {
  const cats = new Set();
  for (const e of _allEventsCache) { if (e.c) cats.add(e.c); }
  const catSorted = [...cats].sort();
  const fcCat = document.getElementById('fc-category');
  if (fcCat) {
    fcCat.innerHTML = catSorted.map(c => `<button class="filter-chip" data-group="category" data-val="${c.replace(/"/g, '&quot;')}">${c}</button>`).join('');
  }
  document.querySelectorAll('#events-filter-bar .filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      const group = this.dataset.group, val = this.dataset.val;
      const set = _activeFilters[group];
      if (set.has(val)) { set.delete(val); this.classList.remove('active'); }
      else { set.add(val); this.classList.add('active'); }
      _applyAllFilters();
    });
  });
}

function _renderAllEvents(events) {
  const list = document.getElementById('events-list');
  if (!list) return;
  if (events.length === 0) { list.innerHTML = '<div class="no-match">未找到匹配事件</div>'; return; }
  let html = '';
  for (const e of events) {
    const d = (e.s || '').substring(0, 80) + ((e.s || '').length > 80 ? '…' : '');
    html += `<div class="event-item" data-year="${e.y}" data-title="${e.t.replace(/"/g, '&quot;')}">
      <div class="event-year">${_fmtYear(e.y)}</div>
      <div class="event-body">
        <div class="event-title">${e.t}</div>
        <div class="event-meta">${['c','r','o'].filter(k => e[k]).map(k => `<span class="event-tag${k==='r'?' region':k==='o'?' continent':''}">${e[k]}</span>`).join('')}</div>
        <div class="event-desc">${d}</div>
      </div>
    </div>`;
  }
  list.innerHTML = html;
}

function _applyAllFilters() {
  const q = (document.getElementById('events-filter')?.value || '').trim().toLowerCase();
  let filtered = _allEventsCache;
  if (q) {
    filtered = filtered.filter(e => (e.t||'').toLowerCase().includes(q)||(e.r||'').toLowerCase().includes(q)||(e.s||'').toLowerCase().includes(q)||(e.o||'').toLowerCase().includes(q)||(e.c||'').toLowerCase().includes(q));
  }
  if (_activeFilters.category.size > 0) {
    filtered = filtered.filter(e => _activeFilters.category.has(e.c));
  }
  const ct = document.getElementById('events-count');
  if (ct) ct.textContent = `共 ${_allEventsCache.length} 条记录，显示 ${filtered.length} 条`;
  _renderAllEvents(filtered);
}

let _eventsInitialized = false;

async function initEventsPage() {
  _activeFilters = { category: new Set() };
  const loading = document.getElementById('events-loading'), inp = document.getElementById('events-filter');
  if (loading) loading.classList.remove('hidden');
  if (state.searchIndex && state.searchIndex._version === 2 && state.searchIndex._events && state.searchIndex._events.length > 7000) {
    _allEventsCache = state.searchIndex._events;
  } else {
    try {
      const c = sessionStorage.getItem('shilu_search_index');
      if (c) { const p = JSON.parse(c); if (p && p._version === 2 && p._events && p._events.length > 7000) { _allEventsCache = p._events; state.searchIndex = p; state.searchIndexReady = true; } }
    } catch (_) {}
  }
  if (!_allEventsCache.length) {
    _allEventsCache = await HashSearch.getAllEvents();
  }
  if (loading) loading.classList.add('hidden');
  _buildFilterChips();
  if (inp && !_eventsInitialized) { inp.addEventListener('input', () => _applyAllFilters()); _eventsInitialized = true; }
  if (inp) inp.value = '';
  if (!document.getElementById('events-list').dataset.delegated) {
    document.getElementById('events-list').dataset.delegated = '1';
    document.getElementById('events-list').addEventListener('click', e => {
      const item = e.target.closest('.event-item');
      if (item) routeTo('detail', { year: item.dataset.year, title: item.dataset.title });
    });
  }
  _applyAllFilters();
}

async function initDetailPage(params) {
  const year = parseInt(params.year, 10), title = params.title;
  const loading = document.getElementById('detail-loading'), error = document.getElementById('detail-error'), content = document.getElementById('detail-content');
  if (!year || !title) { if (loading) loading.classList.add('hidden'); if (error) error.classList.remove('hidden'); return; }
  try {
    const data = await HashSearch.get(HashSearch.getFileName(year));
    const entry = Array.isArray(data) ? data.find(d => d && d.y === year) : null;
    if (!entry) throw Error('NY');
    const evt = entry.v.find(e => e.t === title);
    if (!evt) throw Error('NE');
    if (loading) loading.classList.add('hidden'); if (content) content.classList.remove('hidden');
    document.getElementById('detail-year-display').textContent = _fmtYear(year);
    document.getElementById('detail-title-display').textContent = evt.t;
    document.getElementById('detail-tags').innerHTML = ['c','r','o'].filter(k => evt[k]).map(k => `<span class="event-tag${k==='r'?' region':k==='o'?' continent':''}">${evt[k]}</span>`).join('');
    document.getElementById('detail-desc-text').innerHTML = (evt.s || '暂无描述') + '<br><small class="disclaimer">⚠️免责声明：内容源自互联网公开信息整理，不保证准确完整，仅供科普参考，不构成任何建议。</small>';
    if (entry.d && entry.d.length > 0) {
      const de = document.getElementById('detail-dynasty'); if (de) de.classList.remove('hidden');
      const dt = document.getElementById('detail-dynasty-text'); if (dt) { const d = entry.d[0]; const parts = [d.u, d.e].filter(Boolean); dt.textContent = `${d.n}${parts.length > 0 ? '（' + parts.join('，') + '）' : ''}`; }
    }
    const metaTitle = `${evt.t} (${_fmtYear(year)}) - 实录 shilu.org`;
    const desc = evt.s ? evt.s.substring(0, 160) : `${evt.t} - ${evt.r || ''} ${evt.c || '历史事件'}`;
    const url = `https://shilu.org/?page=detail&year=${year}&title=${encodeURIComponent(evt.t)}`;
    const img = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'.9em\' font-size=\'90\'%3E📜%3C/text%3E%3C/svg%3E';
    setPageMeta(metaTitle, desc, url, img);
    const twc = document.querySelector('meta[name="twitter:card"]'); if (twc) twc.setAttribute('content', 'summary');
  } catch (_) { if (loading) loading.classList.add('hidden'); if (error) error.classList.remove('hidden'); }
}

let _searchTimer = null;

function _searchInit() {
  const btn = document.getElementById('search-btn'), panel = document.getElementById('search-panel');
  const inp = document.getElementById('search-input'), clear = document.getElementById('search-clear');

  if (btn && panel) {
    btn.addEventListener('click', () => {
      const h = panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      if (!h) { const r = document.getElementById('search-results'), s = document.getElementById('search-status'); if (inp) inp.value = ''; if (r) r.innerHTML = ''; if (s) s.textContent = ''; }
      else if (inp) setTimeout(() => inp.focus(), 100);
    });
  }
  if (inp) {
    inp.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      const q = inp.value.trim();
      if (q.length < 2) { const r = document.getElementById('search-results'), s = document.getElementById('search-status'); if (r) r.innerHTML = ''; if (s) s.textContent = ''; return; }
      if (!state.searchIndexReady) HashSearch.preloadAll();
      _searchTimer = setTimeout(() => _searchShow(q), 150);
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') _searchClose(); if (e.key === 'Enter') { clearTimeout(_searchTimer); const q = inp.value.trim(); if (q.length >= 2) _searchShow(q); } });
  }
  if (clear) clear.addEventListener('click', () => { if (inp) { inp.value = ''; inp.focus(); } const r = document.getElementById('search-results'), s = document.getElementById('search-status'); if (r) r.innerHTML = ''; if (s) s.textContent = ''; });
  const sr = document.getElementById('search-results');
  if (sr) sr.addEventListener('click', async e => {
    const item = e.target.closest('.search-result-item');
    if (item) {
      _searchClose();
      const y = parseInt(item.dataset.year, 10), t = item.dataset.title;
      await _navigateToYear(y);
      const fn = HashSearch.getFileName(y), cd = HashSearch.getCached(fn);
      const evt = Array.isArray(cd) ? cd.find(d => d && d.y === y)?.v?.find(e => e.t === t) : null;
      if (evt) document.dispatchEvent(new CustomEvent('shilu:selectEvent', { detail: evt }));
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel && !panel.classList.contains('hidden')) _searchClose();
    if ((e.key === 'f' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !e.shiftKey && !e.ctrlKey)) {
      e.preventDefault(); if (panel && inp) { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) setTimeout(() => inp.focus(), 100); else { inp.value = ''; const r = document.getElementById('search-results'), s = document.getElementById('search-status'); if (r) r.innerHTML = ''; if (s) s.textContent = ''; } }
    }
  });
  document.addEventListener('click', e => { if (panel && !panel.classList.contains('hidden')) { if (!panel.contains(e.target) && !btn?.contains(e.target)) _searchClose(); } });
}

export async function initHome() {
  if (getState()._homeInitialized) return;

  _onEventSelected = _showDetail;
  const closeBtn = document.getElementById('event-detail-close');
  if (closeBtn) closeBtn.addEventListener('click', () => { _hideDetail(); if (state.activeMarker) { const el = state.activeMarker.getElement(); if (el) el.classList.remove('active'); state.activeMarker = null; } });
  const homeList = document.getElementById('home-event-list');
  if (homeList) homeList.addEventListener('click', e => {
    const item = e.target.closest('.event-item');
    if (item) {
      const t = item.dataset.title, evt = _homeEvents.find(ev => ev.t === t);
      if (evt) {
        if (_onEventSelected) _onEventSelected(evt);
        const m = state.markers.find(m => { const ll = m.getLatLng(); return Math.abs(ll.lat - evt.a) < 0.001 && Math.abs(ll.lng - evt.l) < 0.001; });
        if (m) { state.markers.forEach(x => { const el = x.getElement(); if (el) el.classList.remove('active'); }); const el = m.getElement(); if (el) el.classList.add('active'); state.activeMarker = m; MapView.setView(evt.a, evt.l, 5); }
      }
    }
  });

  document.addEventListener('shilu:dynastySelect', e => {
    const d = e.detail;
    const target = nearestYear(d.start);
    state.currentYear = target;
    Timelines.calendarDraw();
    _loadAndShowEvents(target);
  });
  document.addEventListener('shilu:yearSelect', e => {
    _navigateToYear(e.detail);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const ys = state.contentYears;
      if (ys.length < 1) return;
      let ny;
      if (e.shiftKey) {
        const targetYear = state.currentYear + (e.key === 'ArrowRight' ? 10 : -10);
        ny = nearestYear(targetYear);
      } else {
        const ci = state.contentYearIndex[state.currentYear];
        const ni = ci !== undefined ? ci + (e.key === 'ArrowRight' ? 1 : -1) : 0;
        ny = ys[Math.max(0, Math.min(ys.length - 1, ni))];
      }
      if (ny !== state.currentYear) _navigateToYear(ny);
    }
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); const p = document.getElementById('shortcut-panel'); if (p) p.classList.toggle('hidden'); }
    if (e.key === 'Escape') { const p = document.getElementById('shortcut-panel'); if (p) p.classList.add('hidden'); _hideDetail(); state.selectedDynasty = null; Timelines.dynastyDraw(); }
  });

  const nav = document.getElementById('mobile-year-nav');
  if (nav) nav.addEventListener('click', e => {
    const btn = e.target.closest('.mob-nav-btn');
    if (btn) { const step = parseInt(btn.dataset.step, 10); if (Math.abs(step) === 10) { const ny = nearestYear(state.currentYear + step); if (ny !== state.currentYear) _navigateToYear(ny); } else { const ys = state.contentYears; if (ys.length < 1) return; const ci = state.contentYearIndex[state.currentYear]; const ni = Math.max(0, Math.min(ys.length - 1, (ci !== undefined ? ci : 0) + step)); const ny = ys[ni]; if (ny !== state.currentYear) _navigateToYear(ny); } return; }
    if (e.target.id === 'mob-year-display') {
      const ys = prompt('请输入年份：\n公元前输入负数，公元直接输入数字', state.currentYear);
      if (ys !== null) { const y = parseInt(ys, 10); if (!isNaN(y) && y !== 0 && y >= HashSearch.YEAR_MIN && y <= HashSearch.YEAR_MAX) { state.currentYear = y; state.selectedDynasty = null; _navigateToYear(y); } else if (y === 0) _showError('公元0年不存在'); else _showError('年份超出范围'); }
    }
  });

  const shortcutBtn = document.getElementById('shortcut-btn'), shortcutPanel = document.getElementById('shortcut-panel');
  if (shortcutBtn && shortcutPanel) { shortcutBtn.addEventListener('click', () => shortcutPanel.classList.toggle('hidden')); document.addEventListener('click', e => { if (!shortcutPanel.contains(e.target) && e.target !== shortcutBtn) shortcutPanel.classList.add('hidden'); }); }

  window.addEventListener('resize', Timelines.resize);
  document.addEventListener('shilu:selectEvent', e => _showDetail(e.detail));

  try {
    console.log('[实录] 开始加载数据...');
    const idx = await HashSearch.getContentYearIndex();
    console.log('[实录] 年份索引加载完成，共', idx.years.length, '个年份');
    state.contentYears = idx.years;
    state.contentYearIndex = idx.yearIndex;
    Timelines.dynastyDraw();
    Timelines.calendarDraw();
    await _loadAndShowEvents(state.currentYear);
    console.log('[实录] 初始事件加载完成');

    setRouterState('_homeInitialized', true);

    const pb = document.getElementById('bg-progress');
    _ric(() => {
      if (pb) pb.classList.add('active');
      HashSearch.preloadAll((l, t) => {
        if (pb) pb.style.width = `${(l / t) * 100}%`;
      }).then(() => {
        _buildSearchIndex().then(() => {
          if (pb) pb.classList.add('complete');
        });
      });
    }, { timeout: 3000 });
  } catch (e) {
    console.error('[实录] 首页数据加载失败:', e);
    setRouterState('_homeInitialized', false);
    _showError('数据加载失败，请刷新页面重试');
  }
}

export { initEventsPage, initDetailPage, _searchInit as searchInit };
