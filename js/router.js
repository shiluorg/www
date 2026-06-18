import state, { themeInit } from './state.js';
import HashSearch from './hash-search.js';
import { t9n, t, getCurrentLang, setLanguage, onLangChange, ZH } from './i18n.js';

const _pages = ['home', 'events', 'detail', 'game'];
let _homeInitialized = false;
let _errorTimer = null;
const _regexCache = new Map();
let _homeOnlyEls = null;
let _routeInitCalled = false;

function _getHomeOnlyEls() {
  if (!_homeOnlyEls) _homeOnlyEls = document.querySelectorAll('.home-only');
  return _homeOnlyEls;
}

export function getState() {
  return { _homeInitialized };
}

export function setRouterState(key, value) {
  if (key === '_homeInitialized') _homeInitialized = value;
}

const _fmtYear = HashSearch.formatYear;

function _showError(msg) {
  const el = document.getElementById('err-message');
  const toast = document.getElementById('err-toast');
  if (el) el.textContent = msg;
  if (toast) {
    toast.classList.remove('hidden');
    if (_errorTimer) clearTimeout(_errorTimer);
    _errorTimer = setTimeout(() => {
      toast.classList.add('hidden');
      _errorTimer = null;
    }, 4000);
  }
}

function _showPage(name) {
  _homeOnlyEls = null;
  _pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('hidden', p !== name);
  });
  _getHomeOnlyEls().forEach(el => el.classList.toggle('hidden', name !== 'home'));
}

export function routeTo(name, params) {
  const qs = new URLSearchParams({ page: name, ...params });
  const lang = getCurrentLang();
  if (lang !== 'zh') qs.set('lang', lang);
  const url = `?${qs.toString()}`;
  history.pushState(null, '', url);
  handleRoute();
}

export function setPageMeta(title, description, url, imageUrl) {
  document.title = title;
  const md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', description);
  const ogt = document.querySelector('meta[property="og:title"]'); if (ogt) ogt.setAttribute('content', title);
  const ogd = document.querySelector('meta[property="og:description"]'); if (ogd) ogd.setAttribute('content', description);
  if (url) {
    const ogu = document.querySelector('meta[property="og:url"]'); if (ogu) ogu.setAttribute('content', url);
    const can = document.querySelector('link[rel="canonical"]'); if (can) can.setAttribute('href', url);
  }
  if (imageUrl) {
    const ogi = document.querySelector('meta[property="og:image"]'); if (ogi) ogi.setAttribute('content', imageUrl);
    const twi = document.querySelector('meta[name="twitter:image"]'); if (twi) twi.setAttribute('content', imageUrl);
  }
  const twt = document.querySelector('meta[name="twitter:title"]'); if (twt) twt.setAttribute('content', title);
  const twd = document.querySelector('meta[name="twitter:description"]'); if (twd) twd.setAttribute('content', description);
  // Update hreflang links
  const lang = getCurrentLang();
  const baseUrl = 'https://shilu.org';
  const qs = window.location.search;
  const zhPath = qs ? qs.replace(/[?&]lang=en/, '').replace('&&', '&').replace(/\?&/, '?') : '';
  const enPath = qs ? (qs.includes('lang=en') ? qs : (qs + (qs ? '&' : '?') + 'lang=en')) : '?lang=en';
  const hlZh = document.querySelector('link[hreflang="zh-CN"]');
  const hlEn = document.querySelector('link[hreflang="en"]');
  const hlXd = document.querySelector('link[hreflang="x-default"]');
  if (hlZh) hlZh.setAttribute('href', baseUrl + zhPath);
  if (hlEn) hlEn.setAttribute('href', baseUrl + enPath);
  if (hlXd) hlXd.setAttribute('href', baseUrl + zhPath);
}

const _canonicalMap = { home: 'https://shilu.org/', events: 'https://shilu.org/?page=events', game: 'https://shilu.org/?page=game' };

const _MAP_IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-180,-85,180,85&size=1200,630&format=png32&f=image';

// Update twitter:card type based on page
function _updateTwitterCard(isDetail) {
  const tc = document.querySelector('meta[name="twitter:card"]');
  if (tc) tc.setAttribute('content', isDetail ? 'summary_large_image' : 'summary');
}

function _genJsonLD(page, eventData) {
  const dict = t9n();
  const lang = getCurrentLang();
  const baseUrl = 'https://shilu.org';
  const qs = new URLSearchParams();
  if (page !== 'home') qs.set('page', page);
  if (lang === 'en') qs.set('lang', 'en');
  const pageUrl = baseUrl + (qs.toString() ? '?' + qs.toString() : '');
  const homeQs = new URLSearchParams();
  if (lang === 'en') homeQs.set('lang', 'en');
  const homeUrl = baseUrl + (homeQs.toString() ? '?' + homeQs.toString() : '');
  const eventsQs = new URLSearchParams();
  eventsQs.set('page', 'events');
  if (lang === 'en') eventsQs.set('lang', 'en');
  const eventsUrl = baseUrl + '?' + eventsQs.toString();
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': dict.siteName, 'item': homeUrl }
    ]
  };
  if (page === 'events') {
    breadcrumb.itemListElement.push({ '@type': 'ListItem', 'position': 2, 'name': dict.navEvents, 'item': pageUrl });
  } else if (eventData) {
    breadcrumb.itemListElement.push({ '@type': 'ListItem', 'position': 2, 'name': dict.navEvents, 'item': eventsUrl });
    breadcrumb.itemListElement.push({ '@type': 'ListItem', 'position': 3, 'name': eventData.t, 'item': pageUrl });
  } else if (page === 'game') {
    breadcrumb.itemListElement.push({ '@type': 'ListItem', 'position': 2, 'name': dict.navGames, 'item': pageUrl });
  }
  let mainEntity;
  if (eventData) {
    mainEntity = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': eventData.t,
      'description': dict.formatYear(eventData.y) + ' — ' + eventData.t,
      'datePublished': null,
      'author': { '@type': 'Organization', 'name': 'Shilu' },
      'about': { '@type': 'Event', 'name': eventData.t, 'startDate': String(eventData.y) },
      'inLanguage': lang === 'zh' ? 'zh-CN' : 'en'
    };
  } else if (page === 'game') {
    mainEntity = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': dict.pageTitle.game,
      'description': dict.pageDescription.game,
      'applicationCategory': 'EducationalApplication',
      'operatingSystem': 'All',
      'inLanguage': lang === 'zh' ? 'zh-CN' : 'en',
      'browserRequirements': 'Requires JavaScript'
    };
  } else if (page === 'events') {
    mainEntity = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': dict.pageTitle.events,
      'description': dict.pageDescription.events,
      'inLanguage': lang === 'zh' ? 'zh-CN' : 'en'
    };
  } else {
    mainEntity = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': dict.siteName,
      'url': homeUrl,
      'description': dict.pageDescription.home,
      'inLanguage': lang === 'zh' ? 'zh-CN' : 'en',
      'applicationCategory': 'EducationalApplication',
      'operatingSystem': 'All',
      'potentialAction': [{
        '@type': 'SearchAction',
        'target': { '@type': 'EntryPoint', 'urlTemplate': baseUrl + '/?page=home&q={search_term_string}' },
        'query-input': 'required name=search_term_string'
      }]
    };
  }
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  scripts.forEach(s => s.remove());
  const newScript = document.createElement('script');
  newScript.type = 'application/ld+json';
  newScript.textContent = JSON.stringify([mainEntity, breadcrumb]);
  document.head.appendChild(newScript);
}

function _updatePageMeta(page, eventData) {
  const dict = t9n();
  if (eventData) {
    // Detail page: event-specific meta already set by initDetailPage
    _updateTwitterCard(true);
    _genJsonLD(page, eventData);
    return;
  }
  const title = dict.pageTitle[page] || dict.pageTitle.home;
  const desc = dict.pageDescription[page] || dict.pageDescription.home;
  const url = _canonicalMap[page] || 'https://shilu.org/';
  setPageMeta(title, desc, url);
  _updateTwitterCard(false);
  _genJsonLD(page);
}

// Search functions
function _searchClose() {
  const p = document.getElementById('search-panel'), i = document.getElementById('search-input');
  if (p) p.classList.add('hidden'); if (i) i.value = '';
}

function _searchHL(text, q) {
  let r = _regexCache.get(q);
  if (!r) {
    r = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    if (_regexCache.size >= 20) _regexCache.delete(_regexCache.keys().next().value);
    _regexCache.set(q, r);
  }
  return text.replace(r, '<span class="search-highlight">$1</span>');
}

function _escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function _searchShow(q, mode) {
  const c = document.getElementById('search-results'), s = document.getElementById('search-status');
  if (!c) return;
  const idx = state.searchIndex;
  if (!idx || !idx._events) { c.innerHTML = `<div class="search-result-empty">${t('indexNotReady')}</div>`; return; }
  const results = HashSearch.search(idx._events, q, undefined, mode);
  if (results.length === 0) { c.innerHTML = `<div class="search-result-empty">${t('searchNoResult')}</div>`; if (s) s.textContent = state.searchIndexReady ? '' : `${t('searchBuilding')}`; return; }
  let html = '';
  for (const evt of results.slice(0, 100)) {
    const hlT = _searchHL(_escHtml(evt.t), q), hlR = evt.r ? _searchHL(_escHtml(evt.r), q) : '';
    const descText = evt.s || '';
    const dp = descText.length > 60 ? descText.substring(0, 60) + '…' : descText;
    html += `<div class="search-result-item" data-year="${evt.y}" data-title="${_escHtml(evt.t)}">
      <div class="search-result-year">${_fmtYear(evt.y)}</div>
      <div class="search-result-info">
        <div class="search-result-title">${hlT}</div>
        <div class="search-result-meta">
          <span class="search-result-tag">${_escHtml(evt.c || t('fallbackCategory'))}</span>
          ${evt.r ? `<span class="search-result-tag">${hlR}</span>` : ''}
          <span class="search-result-tag">${_escHtml(evt.o || '')}</span>
        </div>
        <div class="search-result-desc">${_searchHL(_escHtml(dp), q)}</div>
      </div>
    </div>`;
  }
  c.innerHTML = html;
  if (s) s.textContent = `${t('searchResultCount', results.length, results.length > 100)}${!state.searchIndexReady ? ` | ${t('searchBuilding')}` : ''}`;
}

export function nearestYear(year) {
  const ys = state.contentYears;
  if (!ys.length) return year;
  const i = HashSearch.findNearestIndex(year, ys);
  return i >= 0 ? ys[i] : year;
}

export { _searchClose, _showError, _fmtYear };

// Language switch button setup
function _initLangSwitch() {
  const btn = document.getElementById('lang-switch');
  if (!btn || btn.dataset.init) return;
  btn.dataset.init = '1';
  btn.addEventListener('click', () => {
    const cur = getCurrentLang();
    const next = cur === 'zh' ? 'en' : 'zh';
    setLanguage(next);
    window.location.reload();
  });
  onLangChange(() => {
    if (btn) {
      btn.textContent = getCurrentLang() === ZH ? 'EN' : '\u4e2d';
      btn.title = t9n().langSwitchLabel;
    }
  });
}

// Apply i18n to ALL static elements
function _applyI18n() {
  const dict = t9n();
  // Meta tags
  document.title = dict.htmlTitle;
  setAttr('meta[name="description"]', 'content', dict.htmlDescription);
  setAttr('meta[name="keywords"]', 'content', dict.htmlKeywords);
  setAttr('meta[property="og:title"]', 'content', dict.ogTitle);
  setAttr('meta[property="og:description"]', 'content', dict.ogDescription);
  setAttr('meta[property="og:locale"]', 'content', dict.ogLocale);
  setAttr('meta[property="og:site_name"]', 'content', dict.siteName);
  setAttr('meta[name="twitter:title"]', 'content', dict.ogTitle);
  setAttr('meta[name="twitter:description"]', 'content', dict.ogDescription);
  // Header
  setText('.header__title a', dict.homeLink);
  setAttr('.nav-link:nth-child(1)', 'title', dict.navEvents);
  setAttr('.nav-link:nth-child(2)', 'title', dict.navGames);
  setAttr('#search-btn', 'title', dict.searchTitle);
  setAttr('#theme-toggle', 'title', dict.themeTitle);
  setAttr('#shortcut-btn', 'title', dict.shortcutTitle);
  // Search panel
  setAttr('#search-input', 'placeholder', dict.searchPlaceholder);
  setAttr('#search-clear', 'title', dict.clearTitle);
  setText('.search-mode-btn[data-mode="combined"]', dict.modeCombined);
  setText('.search-mode-btn[data-mode="exact"]', dict.modeExact);
  setText('.search-mode-btn[data-mode="fuzzy"]', dict.modeFuzzy);
  setAttr('.search-mode-btn[data-mode="combined"]', 'title', dict.searchModeCombined);
  setAttr('.search-mode-btn[data-mode="exact"]', 'title', dict.searchModeExact);
  setAttr('.search-mode-btn[data-mode="fuzzy"]', 'title', dict.searchModeFuzzy);
  // Timeline ARIA
  setAttr('#dynasty-canvas', 'aria-label', dict.dynastyAria);
  setAttr('#calendar-canvas', 'aria-label', dict.calendarAria);
  // Map area
  setText('#map-empty-hint', dict.mapEmpty);
  setText('#layer-satellite', dict.layerSatellite);
  setText('#layer-street', dict.layerStreet);
  setText('#layer-historic', dict.layerHistoric);
  setText('#dl-satellite', dict.layerSatellite);
  setText('#dl-street', dict.layerStreet);
  setText('#dl-historic', dict.layerHistoric);
  // Shortcut panel
  setText('#shortcut-panel h3', dict.shortcutTitle);
  const shortList = document.querySelector('#shortcut-panel ul');
  if (shortList) {
    shortList.innerHTML = dict.shortcuts.map(s =>
      `<li>${s.keys.map(k => `<kbd>${k}</kbd>`).join(' ')} ${s.desc}</li>`
    ).join('');
  }
  // Events page
  setAttr('#events-filter', 'placeholder', dict.filterPlaceholder);
  setText('.filter-label', dict.filterLabel);
  setText('#events-loading span', dict.eventsLoading);
  // Detail page
  setText('.back-link', dict.backLink);
  setText('.detail-h1', dict.detailTitle);
  setText('#detail-loading span', dict.detailLoading);
  setText('#detail-error .no-match', dict.eventNotFound);
  setText('#detail-dynasty h3', dict.dynastySection);
  // Quiz page
  setText('#quiz-loading span', dict.quizLoading);
  setText('.quiz__level-title', dict.quizLevelTitle);
  setText('#quiz-next', dict.quizNext);
  setText('#quiz-reset', dict.quizReset);
  // Game Center
  setText('#game-loading span', dict.gameLoading);
  // Footer
  setText('.footer-prefix', dict.footerPrefix);
  setText('.footer-suffix', dict.footerSuffix);
  // Language switch button: short text, title shows target language
  const ls = document.getElementById('lang-switch');
  if (ls) {
    ls.textContent = getCurrentLang() === ZH ? 'EN' : '\u4e2d';
    ls.title = dict.langSwitchLabel;
  }
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function setAttr(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export async function handleRoute() {
  try {
    const p = new URLSearchParams(window.location.search);
    const rawPage = p.get('page') || 'home';
    const page = rawPage === 'map' ? 'home' : rawPage === 'quiz' ? 'game' : rawPage;
    const pObj = {}; for (const [k, v] of p) pObj[k] = v;

    _showPage(page);
    _updatePageMeta(rawPage === 'map' ? 'map' : page);
    _applyI18n();
    _initLangSwitch();

    if (!_routeInitCalled) {
      _routeInitCalled = true;
      HashSearch.init();
    }

    switch (page) {
      case 'home': {
        if (_homeInitialized) break;
        themeInit();
        const [homeMod, timelinesMod, mapMod] = await Promise.all([
          import('./home.js'), import('./timelines.js'), import('./map-view.js')
        ]);
        homeMod.searchInit();
        timelinesMod.default.init();
        await homeMod.initHome();
        // Defer map init to avoid blocking initial render
        setTimeout(() => mapMod.default.init(), 0);
        break;
      }
      case 'events': {
        themeInit();
        const { initEventsPage } = await import('./home.js');
        await initEventsPage();
        break;
      }
      case 'detail': {
        themeInit();
        const { initDetailPage } = await import('./home.js');
        const evtData = await initDetailPage(pObj);
        _updatePageMeta('detail', evtData);
        break;
      }
      case 'game': {
        themeInit();
        const { initGameCenter } = await import('./game-center.js');
        await initGameCenter(pObj.tab);
        const tab = pObj.tab || 'quiz';
        const dict = t9n();
        const share = dict.gameShare[tab] || dict.gameShare.quiz;
        const url = `https://shilu.org/?page=game&tab=${tab}`;
        setPageMeta(`${share.t} - ${dict.siteName}`, share.d, url, _MAP_IMG);
        break;
      }
    }
    // Update footer event count (fire-and-forget)
    HashSearch.getEventCount().then(count => {
      const el = document.getElementById('footer-count');
      if (el && count > 0) el.textContent = count;
    }).catch(() => {});
  } catch (e) {
    console.error('[Shilu] Route handler error:', e);
  }
}
