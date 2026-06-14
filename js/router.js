import state from './state.js';
import { themeInit } from './state.js';
import HashSearch from './hash-search.js';

const HOME_PAGE = 'home';
const _pages = [HOME_PAGE, 'events', 'detail', 'quiz'];
const _ric = window.requestIdleCallback || (cb => setTimeout(cb, 50));

let _homeInitialized = false;
let _errorTimer = null;

export function getState() {
  return { _homeInitialized, _errorTimer };
}

export function setRouterState(key, value) {
  if (key === '_homeInitialized') _homeInitialized = value;
}

const _fmtYear = HashSearch.formatYear;

function _showError(msg) {
  const el = document.getElementById('err-message'), t = document.getElementById('err-toast');
  if (el) el.textContent = msg;
  if (t) { t.classList.remove('hidden'); if (_errorTimer) clearTimeout(_errorTimer); _errorTimer = setTimeout(() => { t.classList.add('hidden'); _errorTimer = null; }, 4000); }
}

function _showPage(name) {
  _pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('hidden', p !== name);
  });
  document.querySelectorAll('.home-only').forEach(el => el.classList.toggle('hidden', name !== HOME_PAGE));
}

export function routeTo(name, params) {
  const qs = new URLSearchParams({ page: name, ...params }).toString();
  const url = `?${qs}`;
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
}

function _updatePageMeta(page) {
  const titleMap = { home: '实录：跨越11512年的人类文明历史年表 shilu.org', events: '全站事件列表 - 实录 shilu.org', map: '历史地图 - 实录 shilu.org', detail: '事件详情 - 实录 shilu.org', quiz: '历史趣味问答 - 实录 shilu.org' };
  const descMap = { home: '跨越11512年的交互式地球文明年表，覆盖公元前9600年至公元1912年的重大历史事件。按年份浏览政治、军事、文化、科技等领域的重要时刻，配合地图直观呈现。', events: '浏览实录全站所有历史事件，按分类筛选，搜索任意年份、地区、关键词。', map: '在地图上查看全球历史事件的时空分布，从安纳托利亚到印度河流域，纵览人类文明足迹。', quiz: '通过趣味问答测试历史知识，包含朝代、年份、事件等多种题型。逐步提升修为等级。' };
  const canonicalMap = { home: 'https://shilu.org/', events: 'https://shilu.org/?page=events', map: 'https://shilu.org/?page=map', quiz: 'https://shilu.org/?page=quiz' };
  const title = titleMap[page] || titleMap.home;
  const desc = descMap[page] || descMap.home;
  const url = canonicalMap[page] || 'https://shilu.org/';
  setPageMeta(title, desc, url);
}

// Search functions
function _searchClose() {
  const p = document.getElementById('search-panel'), i = document.getElementById('search-input');
  if (p) p.classList.add('hidden'); if (i) i.value = '';
}

function _searchHL(text, q) {
  const r = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return text.replace(r, '<span class="search-highlight">$1</span>');
}

export function _searchShow(q) {
  const c = document.getElementById('search-results'), s = document.getElementById('search-status');
  if (!c) return;
  const idx = state.searchIndex;
  if (!idx || !idx._events) { c.innerHTML = '<div class="search-result-empty">索引未就绪</div>'; return; }
  const results = HashSearch.search(idx._events, q);
  if (results.length === 0) { c.innerHTML = '<div class="search-result-empty">未找到匹配事件</div>'; if (s) s.textContent = state.searchIndexReady ? '' : '索引构建中…'; return; }
  let html = '';
  for (const evt of results.slice(0, 100)) {
    const hlT = _searchHL(evt.t, q), hlR = evt.r ? _searchHL(evt.r, q) : '';
    const descText = evt.s || '';
    const dp = descText.length > 60 ? descText.substring(0, 60) + '…' : descText;
    html += `<div class="search-result-item" data-year="${evt.y}" data-title="${evt.t.replace(/"/g, '&quot;')}">
      <div class="search-result-year">${_fmtYear(evt.y)}</div>
      <div class="search-result-info">
        <div class="search-result-title">${hlT}</div>
        <div class="search-result-meta">
          <span class="search-result-tag">${evt.c || '事件'}</span>
          ${evt.r ? `<span class="search-result-tag">${hlR}</span>` : ''}
          <span class="search-result-tag">${evt.o || ''}</span>
        </div>
        <div class="search-result-desc">${_searchHL(dp, q)}</div>
      </div>
    </div>`;
  }
  c.innerHTML = html;
  if (s) s.textContent = `找到 ${results.length} 条结果${results.length > 100 ? '（显示前100条）' : ''}${!state.searchIndexReady ? ' | 索引构建中…' : ''}`;
}

// Helper functions for route modules
export function nearestYear(year) {
  const ys = state.contentYears;
  if (!ys.length) return year;
  let lo = 0, hi = ys.length - 1;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (ys[m] < year) lo = m + 1; else hi = m; }
  if (lo === 0) return ys[0];
  const p = ys[lo - 1], c = ys[lo];
  return (year - p) <= (c - year) ? p : c;
}

export { _searchClose, _searchHL, _showError, _showPage, _fmtYear, _ric };

export async function handleRoute() {
  try {
    const p = new URLSearchParams(window.location.search);
    const rawPage = p.get('page') || HOME_PAGE;
    const page = rawPage === 'map' ? HOME_PAGE : rawPage;
    const pObj = {}; for (const [k, v] of p) pObj[k] = v;

    _showPage(page);
    _updatePageMeta(rawPage === 'map' ? 'map' : page);

    switch (page) {
      case 'home': {
        if (_homeInitialized) break;
        HashSearch.init();
        themeInit();
        const [homeMod, timelinesMod, mapMod] = await Promise.all([
          import('./home.js'), import('./timelines.js'), import('./map-view.js')
        ]);
        homeMod.searchInit();
        timelinesMod.default.init();
        mapMod.default.init();
        await homeMod.initHome();
        break;
      }
      case 'events': {
        HashSearch.init();
        themeInit();
        const { initEventsPage } = await import('./home.js');
        await initEventsPage();
        break;
      }
      case 'detail': {
        themeInit();
        const { initDetailPage } = await import('./home.js');
        await initDetailPage(pObj);
        break;
      }
      case 'quiz': {
        themeInit();
        const { initQuizPage } = await import('./quiz.js');
        await initQuizPage();
        break;
      }
    }
  } catch (e) {
    console.error('[实录] 路由处理错误:', e);
  }
}

export default { routeTo, handleRoute, setRouterState, getState, _searchShow, nearestYear, setPageMeta };