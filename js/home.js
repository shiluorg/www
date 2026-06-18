import HashSearch from './hash-search.js';
import Timelines from './timelines.js';
import MapView from './map-view.js';
import state from './state.js';
import { routeTo, setRouterState, getState, _searchShow, _searchClose, nearestYear, _showError, _fmtYear, setPageMeta } from './router.js';
import { t9n, t } from './i18n.js';
import { showPreview } from './share-card.js';
import { ensureL, getTileConfigSync } from './map-libs.js';

let _homeEvents = [];
let _dynastyYearMap = null;
let _currentDetailEvent = null;
let _detailPageEvent = null;
let _detailMap = null;
let _detailMapLayers = { satellite: null, street: null, historic: null };
let _detailMapCurrent = 'satellite';
let _detailHistoricYear = null;
const SI_VERSION = 3;

function _getDynastyId(year) {
  if (!_dynastyYearMap) {
    _dynastyYearMap = new Map();
  }
  if (_dynastyYearMap.has(year)) {
    return _dynastyYearMap.get(year);
  }
  const eras = state.lang === 'en' ? HashSearch.worldEras : HashSearch.dynasties;
  const ad = eras.find(d => year >= d.start && year <= d.end);
  const id = ad ? ad.id : null;
  _dynastyYearMap.set(year, id);
  if (_dynastyYearMap.size > 1000) {
    _dynastyYearMap.delete(_dynastyYearMap.keys().next().value);
  }
  return id;
}

function _renderEventList(yearData) {
  const body = document.getElementById('home-event-list');
  const events = yearData.v;
  _homeEvents = events;
  if (!body) return;
  const dict = t9n();
  if (!events || events.length === 0) { body.innerHTML = `<p class="home-events__empty">${dict.mapEmpty}</p>`; return; }
  const groups = {};
  events.forEach(e => { const co = e.o || dict.fallbackContinent, r = e.r || dict.fallbackRegion; if (!groups[co]) groups[co] = {}; if (!groups[co][r]) groups[co][r] = []; groups[co][r].push(e); });
  const coOrder = dict.continentOrder;
  let html = '';
  coOrder.forEach(co => { if (!groups[co]) return; html += `<div class="event-continent-group"><div class="event-continent-title">${co}</div>`;
    Object.keys(groups[co]).sort().forEach(r => {
      html += `<div class="event-region-group"><div class="event-region-title">${r}</div><div class="event-region-items">`;
      groups[co][r].forEach(e => { html += `<div class="event-item" data-title="${e.t.replace(/"/g, '&quot;')}"><span class="event-item-dot"></span><span class="event-item-cat">${e.c || t('fallbackCategory')}</span><span class="event-item-title">${e.t}</span></div>`; });
      html += '</div></div>';
    }); html += '</div>'; });
  body.innerHTML = html;
}

function _showDetail(evt) {
  _currentDetailEvent = { ...evt, y: state.currentYear };
  const dict = t9n();
  const ids = ['event-detail-title', 'event-detail-category', 'event-detail-continent', 'event-detail-region'];
  const vals = [evt.t, evt.c || dict.fallbackCategory, evt.o || '', evt.r || ''];
  ids.forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = vals[i]; });
  const descEl = document.getElementById('event-detail-description');
  if (descEl) descEl.innerHTML = (evt.s || dict.noDescription) + `<br><small>${dict.disclaimer}</small>`;
  const shareBtn = document.getElementById('share-detail-btn');
  if (shareBtn) shareBtn.title = dict.shareTitle;
  const panel = document.getElementById('event-detail-panel');
  if (panel) panel.classList.remove('hidden');
}

function _hideDetail() { const p = document.getElementById('event-detail-panel'); if (p) p.classList.add('hidden'); }

async function _loadAndShowEvents(year) {
  try {
    const yd = await HashSearch.getYearData(year, state.lang);
    const rq = document.getElementById('rule-quote');
    if (rq) { const dd = yd.d; if (dd && dd.length > 0) { const parts = [dd[0].n, dd[0].u, dd[0].e].filter(Boolean); rq.innerHTML = `<span class="rule-year">${_fmtYear(year)}，</span>${parts.join('，')}`; } else rq.innerHTML = `<span class="rule-year">${_fmtYear(year)}</span>`; }
    const md = document.getElementById('mob-year-display');
    if (md) md.textContent = _fmtYear(year);
    MapView.showEvents(yd.v);
    _renderEventList(yd);
  } catch (_) {
    _showError(t('dataLoadError'));
    const h = document.getElementById('map-empty-hint');
    if (h) h.classList.remove('hidden');
    MapView.clearMarkers();
    const body = document.getElementById('home-event-list');
    if (body) {
      body.innerHTML = `<div style="padding:8px;text-align:center;color:var(--color-text-muted);font-size:12px;">
        ${t('loadFailed')}
        <button id="retry-load-btn" style="margin:4px 0 0;padding:8px 20px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-accent);color:#fff;font-family:inherit;font-size:12px;cursor:pointer;">${t('retry')}</button>
      </div>`;
      const btn = document.getElementById('retry-load-btn');
      if (btn) btn.addEventListener('click', () => _loadAndShowEvents(year));
    }
    _homeEvents = [];
  }
}

async function _navigateToYear(year) {
  state.currentYear = year; state.selectedDynasty = null;
  const ad = _getDynastyId(year);
  if (ad) state.selectedDynasty = ad;
  Timelines.dynastyDraw(); Timelines.calendarDraw();
  MapView.setHistoricDate(year);
  await _loadAndShowEvents(year);
}

// Shared helper to load search index from sessionStorage cache
function _loadSearchIndexFromCache() {
  const SK = 'shilu_search_index_' + state.lang;
  try {
    const c = sessionStorage.getItem(SK);
    if (c) {
      const p = JSON.parse(c);
      if (p && p._version === SI_VERSION && p._events && p._events.length > 7000) {
        state.searchIndex = p;
        state.searchIndexReady = true;
        return p;
      }
    }
  } catch (_) {}
  return null;
}

async function _buildSearchIndex(onProgress) {
  const SK = 'shilu_search_index_' + state.lang;

  // Try loading from sessionStorage cache
  if (_loadSearchIndexFromCache()) return;

  const all = [];
  const prefix = state.lang + '/';
  const files = HashSearch.getAllFileNames().map(f => prefix + f);

  const CHUNK = 8;
  for (let i = 0; i < files.length; i += CHUNK) {
    await new Promise(resolve => {
      const doWork = () => {
        const chunk = files.slice(i, i + CHUNK);
        for (const f of chunk) {
          const d = HashSearch.getCached(f);
          if (d) { for (const e of d) { if (e && e.v) { e.v.forEach((evt, i) => all.push({ y: e.y, _i: i, ...evt })); } } }
        }
        if (onProgress) onProgress(Math.min(i + CHUNK, files.length), files.length);
        resolve();
      };
      window.requestIdleCallback(doWork, { timeout: 2000 });
    });
  }

  all.sort((a, b) => a.y - b.y);
  state.searchIndex = { _version: SI_VERSION, _events: all };
  state.searchIndexReady = true;

  const serialized = JSON.stringify(state.searchIndex);
  try { sessionStorage.setItem(SK, serialized); } catch (_) { console.warn('[Shilu] Search index cache failed, sessionStorage may be full'); }
}

let _allEventsCache = [];
let _activeFilters = { category: new Set() };
let _filterTimer = 0;

function _buildFilterChips() {
  const cats = new Set();
  for (const e of _allEventsCache) { if (e.c) cats.add(e.c); }
  const catSorted = [...cats].sort();
  const dict = t9n();
  const fcCat = document.getElementById('fc-category');
  if (fcCat) {
    const allHtml = `<button class="filter-chip filter-all" data-group="category" data-val="__ALL__">${dict.filterAll || '全部'}</button>`;
    fcCat.innerHTML = allHtml + catSorted.map(c => `<button class="filter-chip" data-group="category" data-val="${c.replace(/"/g, '&quot;')}">${c}</button>`).join('');
  }
  document.querySelectorAll('#events-filter-bar .filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      const group = this.dataset.group, val = this.dataset.val;
      const set = _activeFilters[group];
      if (val === '__ALL__') {
        // Clear all filters when "All" is clicked
        set.clear();
        document.querySelectorAll('#events-filter-bar .filter-chip[data-group="category"]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
      } else {
        if (set.has('__ALL__')) set.delete('__ALL__');
        document.querySelector('.filter-chip.filter-all').classList.remove('active');
        if (set.has(val)) { set.delete(val); this.classList.remove('active'); }
        else { set.add(val); this.classList.add('active'); }
      }
      _applyAllFilters();
    });
  });
  // Start with "All" selected by default
  _activeFilters.category.add('__ALL__');
  document.querySelector('.filter-chip.filter-all').classList.add('active');
}

function _renderAllEvents(events) {
  const list = document.getElementById('events-list');
  if (!list) return;
  if (events.length === 0) { list.innerHTML = `<div class="no-match">${t('noMatch')}</div>`; return; }
  let html = '';
  for (const e of events) {
    const s = e.s || '';
    const d = s.substring(0, 80) + (s.length > 80 ? '…' : '');
    html += `<div class="event-item" data-year="${e.y}" data-title="${e.t.replace(/"/g, '&quot;')}" data-idx="${e._i}">
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
  if (_activeFilters.category.size > 0 && !_activeFilters.category.has('__ALL__')) {
    filtered = filtered.filter(e => _activeFilters.category.has(e.c));
  }
  const ct = document.getElementById('events-count');
  if (ct) ct.textContent = t('eventsCount', _allEventsCache.length, filtered.length);
  _renderAllEvents(filtered);
}

let _eventsInitialized = false;

async function initEventsPage() {
  _activeFilters = { category: new Set() };
  const loading = document.getElementById('events-loading'), inp = document.getElementById('events-filter');
  if (loading) { loading.classList.remove('hidden'); }
  if (state.searchIndex && state.searchIndex._events && state.searchIndex._events.length > 7000) {
    _allEventsCache = state.searchIndex._events;
  } else {
    const cached = _loadSearchIndexFromCache();
    if (cached) _allEventsCache = cached._events;
  }
  if (!_allEventsCache.length) {
    _allEventsCache = await HashSearch.getAllEvents(null, state.lang);
  }
  if (_allEventsCache.length === 0) {
    if (loading) loading.classList.add('hidden');
    return;
  }
  const fc = document.getElementById('footer-count');
  if (fc) fc.textContent = _allEventsCache.length;
  if (loading) loading.classList.add('hidden');
  _buildFilterChips();
  if (inp && !_eventsInitialized) { inp.addEventListener('input', () => { clearTimeout(_filterTimer); _filterTimer = setTimeout(_applyAllFilters, 200); }); _eventsInitialized = true; }
  if (inp) inp.value = '';
  const eventsList = document.getElementById('events-list');
  if (!eventsList.dataset.delegated) {
    eventsList.dataset.delegated = '1';
    eventsList.addEventListener('click', e => {
      const item = e.target.closest('.event-item');
      if (item) routeTo('detail', { year: item.dataset.year, title: item.dataset.title, idx: item.dataset.idx });
    });
  }
  _applyAllFilters();
}

async function _initDetailMap(evt, year) {
  await ensureL();
  if (_detailMap) { _detailMap.remove(); _detailMap = null; }
  _detailMapLayers = { satellite: null, street: null, historic: null };
  _detailMapCurrent = 'satellite';
  _detailHistoricYear = year;

  const mapEl = document.getElementById('detail-map');
  if (!mapEl) return;

  const hasCoords = evt.a != null && evt.l != null;
  const lat = hasCoords ? Number(evt.a) : 30;
  const lon = hasCoords ? Number(evt.l) : 20;
  const zoom = hasCoords ? 5 : 2;

  _detailMap = L.map(mapEl, {
    center: [lat, lon],
    zoom: zoom,
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false
  });

  const tiles = getTileConfigSync();

  _detailMapLayers.satellite = L.tileLayer(tiles.satellite, {
    maxZoom: 18,
    attribution: tiles.attr,
    updateWhenIdle: false, updateWhenZooming: false
  });

  _detailMapLayers.street = L.tileLayer(tiles.street, {
    maxZoom: 18,
    attribution: tiles.streetAttr || tiles.attr,
    updateWhenIdle: false, updateWhenZooming: false
  });

  try {
    _detailMapLayers.historic = L.maplibreGL({
      style: 'https://www.openhistoricalmap.org/map-styles/main/main.json',
      attributionControl: false
    });
  } catch (e) {
    _detailMapLayers.historic = null;
  }

  _detailMapLayers.satellite.addTo(_detailMap);
  _detailMap.attributionControl.setPrefix('');

  if (hasCoords) {
    const marker = L.marker([lat, lon]).addTo(_detailMap);
    const popupText = evt.r ? `${evt.t}<br><small>${evt.r}</small>` : evt.t;
    marker.bindPopup(popupText).openPopup();
  }

  // Layer toggle buttons
  const satBtn = document.getElementById('dl-satellite');
  const strBtn = document.getElementById('dl-street');
  const histBtn = document.getElementById('dl-historic');
  const HISTORIC_ATTR = '&copy; OpenHistoricalMap';

  const switchDetailLayer = (type) => {
    if (!_detailMap || _detailMapCurrent === type) return;
    if (type === 'historic' && !_detailMapLayers.historic) return;
    const attr = _detailMap.attributionControl;

    if (_detailMapCurrent === 'satellite') _detailMap.removeLayer(_detailMapLayers.satellite);
    else if (_detailMapCurrent === 'street') _detailMap.removeLayer(_detailMapLayers.street);
    else if (_detailMapLayers.historic) {
      _detailMap.removeLayer(_detailMapLayers.historic);
      if (attr) attr.removeAttribution(HISTORIC_ATTR);
    }

    _detailMapCurrent = type;
    if (type === 'satellite') _detailMapLayers.satellite.addTo(_detailMap);
    else if (type === 'street') _detailMapLayers.street.addTo(_detailMap);
    else if (_detailMapLayers.historic) {
      _detailMapLayers.historic.addTo(_detailMap);
      if (attr) attr.addAttribution(HISTORIC_ATTR);
      try {
        const mlMap = _detailMapLayers.historic.getMaplibreMap();
        if (mlMap && mlMap.filterByDate && _detailHistoricYear) {
          const applyDate = () => {
            const y = Math.abs(_detailHistoricYear);
            mlMap.filterByDate((_detailHistoricYear < 0 ? '-' : '') + String(y).padStart(4, '0') + '-01-01');
          };
          if (mlMap.isStyleLoaded()) applyDate();
          else mlMap.once('styledata', applyDate);
        }
      } catch (_) {}
    }

    if (satBtn) satBtn.classList.toggle('active', type === 'satellite');
    if (strBtn) strBtn.classList.toggle('active', type === 'street');
    if (histBtn) histBtn.classList.toggle('active', type === 'historic');
  };

  if (satBtn && !satBtn.dataset.linked) { satBtn.dataset.linked = '1'; satBtn.addEventListener('click', () => switchDetailLayer('satellite')); }
  if (strBtn && !strBtn.dataset.linked) { strBtn.dataset.linked = '1'; strBtn.addEventListener('click', () => switchDetailLayer('street')); }
  if (histBtn && !histBtn.dataset.linked) {
    histBtn.dataset.linked = '1';
    if (!_detailMapLayers.historic) {
      histBtn.disabled = true;
      histBtn.title = '加载中...';
    }
    histBtn.addEventListener('click', () => switchDetailLayer('historic'));
  }

  // Deferred load MapLibre for historic layer
  if (!_detailMapLayers.historic && typeof L.maplibreGL === 'undefined') {
    import('./map-libs.js').then(m => m.loadMaplibre()).then(() => {
      if (_detailMapLayers.historic) return;
      try {
        _detailMapLayers.historic = L.maplibreGL({
          style: 'https://www.openhistoricalmap.org/map-styles/main/main.json',
          attributionControl: false
        });
        if (histBtn) {
          histBtn.disabled = false;
          histBtn.title = '';
        }
      } catch (_) {}
    });
  }
}

async function initDetailPage(params) {
  const year = parseInt(params.year, 10), idx = parseInt(params.idx, 10), title = params.title;
  const dict = t9n();
  const loading = document.getElementById('detail-loading'), error = document.getElementById('detail-error'), content = document.getElementById('detail-content');
  if (!year || (!title && isNaN(idx))) { if (loading) loading.classList.add('hidden'); if (error) error.classList.remove('hidden'); return null; }
  try {
    const data = await HashSearch.get(HashSearch.getDataPath(year, state.lang));
    const entry = Array.isArray(data) ? data.find(d => d && d.y === year) : null;
    if (!entry) throw Error('NY');
    const evt = (!isNaN(idx) && entry.v[idx]) ? entry.v[idx] : entry.v.find(e => e.t === title);
    if (!evt) throw Error('NE');
    _detailPageEvent = { ...evt, y: year };
    const dspBtn = document.getElementById('detail-page-share-btn');
    if (dspBtn) {
      dspBtn.title = dict.shareTitle;
      dspBtn.addEventListener('click', () => showPreview(_detailPageEvent));
    }

    // Initialize detail page map
    _initDetailMap(evt, year);

    if (loading) loading.classList.add('hidden'); if (content) content.classList.remove('hidden');

    // Ensure map renders correctly after content becomes visible
    setTimeout(() => { if (_detailMap) _detailMap.invalidateSize(); }, 100);
    {
      const el = document.getElementById('detail-year-display'); if (el) el.textContent = _fmtYear(year);
    }
    {
      const el = document.getElementById('detail-title-display'); if (el) el.textContent = evt.t;
    }
    {
      const el = document.getElementById('detail-tags'); if (el) el.innerHTML = ['c','r','o'].filter(k => evt[k]).map(k => `<span class="event-tag${k==='r'?' region':k==='o'?' continent':''}">${evt[k]}</span>`).join('');
    }
    {
      const el = document.getElementById('detail-desc-text'); if (el) el.innerHTML = (evt.s || dict.noDescription) + `<br><small>${dict.disclaimer}</small>`;
    }
    if (entry.d && entry.d.length > 0) {
      const de = document.getElementById('detail-dynasty'); if (de) de.classList.remove('hidden');
      const dh = document.getElementById('detail-dynasty-heading'); if (dh) dh.textContent = dict.dynastySection;
      const dt = document.getElementById('detail-dynasty-text');
      if (dt) {
        if (state.lang === 'en') {
          // Find matching era from world eras timeline
          const era = HashSearch.worldEras.find(e => year >= e.start && year <= e.end);
          dt.textContent = era ? era.nameEn : '';
        } else {
          const d = entry.d[0]; const parts = [d.u, d.e].filter(Boolean);
          dt.textContent = `${d.n}${parts.length > 0 ? '（' + parts.join('，') + '）' : ''}`;
        }
      }
    }
    const metaTitle = `${evt.t} (${_fmtYear(year)}) - Shilu`;
    const desc = evt.s ? evt.s.substring(0, 160) : `${evt.t} - ${evt.r || ''} ${evt.c || 'Historical Event'}`;
    const url = `https://shilu.org/?page=detail&year=${year}&title=${encodeURIComponent(evt.t)}${state.lang !== 'zh' ? '&lang=' + state.lang : ''}`;
    const hasLoc = evt.a != null && evt.l != null;
    const img = hasLoc
      ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${evt.l - 10},${evt.a - 10},${evt.l + 10},${evt.a + 10}&size=1200,630&format=png32&f=image`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-180,-85,180,85&size=1200,630&format=png32&f=image';
    setPageMeta(metaTitle, desc, url, img);
    const twc = document.querySelector('meta[name="twitter:card"]'); if (twc) twc.setAttribute('content', 'summary_large_image');
    return evt;
  } catch (_) { if (loading) loading.classList.add('hidden'); if (error) error.classList.remove('hidden'); return null; }
}

let _searchTimer = null;
let _searchMode = 'combined';
let _searchInitDone = false;
let _initHomeListenersDone = false;

function _searchInit() {
  if (_searchInitDone) return;
  _searchInitDone = true;
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
      if (!state.searchIndexReady) _buildSearchIndex();
      _searchTimer = setTimeout(() => _searchShow(q, _searchMode), 150);
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') _searchClose(); if (e.key === 'Enter') { clearTimeout(_searchTimer); const q = inp.value.trim(); if (q.length >= 2) _searchShow(q, _searchMode); } });
  }
  if (clear) clear.addEventListener('click', () => { if (inp) { inp.value = ''; inp.focus(); } const r = document.getElementById('search-results'), s = document.getElementById('search-status'); if (r) r.innerHTML = ''; if (s) s.textContent = ''; });
  const modeBtns2 = document.querySelectorAll('.search-mode-btn');
  modeBtns2.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns2.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _searchMode = btn.dataset.mode;
      const q = inp.value.trim();
      if (q.length >= 2) _searchShow(q, _searchMode);
    });
  });
  const sr = document.getElementById('search-results');
  if (sr) sr.addEventListener('click', async e => {
    const item = e.target.closest('.search-result-item');
    if (item) {
      _searchClose();
      const y = parseInt(item.dataset.year, 10), t = item.dataset.title;
      await _navigateToYear(y);
      const fn = HashSearch.getFileName(y), cd = HashSearch.getCached(HashSearch.getDataPath(y, state.lang));
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
  setRouterState('_homeInitialized', true);

  if (!_initHomeListenersDone) {
    _initHomeListenersDone = true;
    const closeBtn = document.getElementById('event-detail-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { _hideDetail(); if (state.activeMarker) { const el = state.activeMarker.getElement(); if (el) el.classList.remove('active'); state.activeMarker = null; } });
    const shareDetailBtn = document.getElementById('share-detail-btn');
    if (shareDetailBtn) shareDetailBtn.addEventListener('click', () => {
      if (_currentDetailEvent) showPreview(_currentDetailEvent);
    });
    const homeList = document.getElementById('home-event-list');
    if (homeList) homeList.addEventListener('click', e => {
      const item = e.target.closest('.event-item');
      if (item) {
        const t = item.dataset.title, evt = _homeEvents.find(ev => ev.t === t);
        if (evt) {
          _showDetail(evt);
          const m = state.markers.find(m => m._eventData && m._eventData.t === t);
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
        const dict = t9n();
        const ys = prompt(dict.yearPrompt, state.currentYear);
        if (ys !== null) { const y = parseInt(ys, 10); if (!isNaN(y) && y !== 0 && y >= HashSearch.YEAR_MIN && y <= HashSearch.YEAR_MAX) { state.currentYear = y; state.selectedDynasty = null; _navigateToYear(y); } else if (y === 0) _showError(dict.yearZeroError); else _showError(dict.yearOutOfRange); }
      }
    });

    const shortcutBtn = document.getElementById('shortcut-btn'), shortcutPanel = document.getElementById('shortcut-panel');
    if (shortcutBtn && shortcutPanel) { shortcutBtn.addEventListener('click', () => shortcutPanel.classList.toggle('hidden')); document.addEventListener('click', e => { if (!shortcutPanel.contains(e.target) && e.target !== shortcutBtn) shortcutPanel.classList.add('hidden'); }); }

    window.addEventListener('resize', Timelines.resize);
    document.addEventListener('shilu:selectEvent', e => _showDetail(e.detail));
  }

  try {
    const idx = await HashSearch.getContentYearIndex();
    state.contentYears = idx.years;
    state.contentYearIndex = idx.yearIndex;
    Timelines.dynastyDraw();
    Timelines.calendarDraw();

    const pb = document.getElementById('bg-progress');
    const bgPreload = HashSearch.preloadAll((l, t) => {
      if (pb) pb.style.width = `${(l / t) * 100}%`;
    }, state.lang).then(() => _buildSearchIndex().then(() => {
      if (pb) pb.classList.add('complete');
      const fc = document.getElementById('footer-count');
      if (fc && state.searchIndex && state.searchIndex._events) fc.textContent = state.searchIndex._events.length;
    }));

    await _loadAndShowEvents(state.currentYear);
    MapView.setHistoricDate(state.currentYear);
    bgPreload.catch(() => {});
  } catch (e) {
    console.error('[Shilu] Home data load failed:', e);
    setRouterState('_homeInitialized', false);
    _showError(t('dataLoadError'));
  }
}

export { initEventsPage, initDetailPage, _searchInit as searchInit };
