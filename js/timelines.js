import HashSearch from './hash-search.js';
import state from './state.js';

const TOUCH_THROTTLE_MS = 80;

const _state = {
  containerD: null, canvasD: null, ctxD: null, tooltipD: null,
  containerC: null, canvasC: null, ctxC: null, tooltipC: null,
  hoverDynasty: null, hoverYear: null
};

let _dynastyWeightsCache = null;
let _dynastyWeightsVer = '';
let _resizeTimer = null;
let _dynastyDrawPending = false;
let _calendarDrawPending = false;
let _dynastyLayoutCache = { drawW: -1, layout: null };
let _colorCache = {};

function _cssVar(name) {
  if (!_colorCache[name]) {
    _colorCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
  }
  return _colorCache[name] || '#30363d';
}

function _cssVarRgba(name, alpha) {
  const hex = _cssVar(name);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function _cacheDom() {
  _state.containerD = document.getElementById('dynasty-timeline-container');
  _state.canvasD = document.getElementById('dynasty-canvas');
  _state.ctxD = _state.canvasD?.getContext('2d');
  _state.tooltipD = document.getElementById('dynasty-tooltip');
  _state.containerC = document.getElementById('calendar-timeline-container');
  _state.canvasC = document.getElementById('calendar-canvas');
  _state.ctxC = _state.canvasC?.getContext('2d');
  _state.tooltipC = document.getElementById('calendar-tooltip');
}

const _idx = {
  get ci() { return state.contentYearIndex || {}; },
  get cy() { return state.contentYears || []; },
  get curYear() { return state.currentYear; },
  get selDyn() { return state.selectedDynasty; }
};

function _gi(year) { return _idx.ci[year]; }
function _nearestGi(year) {
  const idx = _idx.ci[year];
  if (idx !== undefined) return idx;
  const ys = _idx.cy;
  if (!ys.length) return undefined;
  let lo = 0, hi = ys.length - 1;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (ys[m] < year) lo = m + 1; else hi = m; }
  if (lo === 0) return 0;
  const p = ys[lo - 1], c = ys[lo];
  return (year - p) <= (c - year) ? lo - 1 : lo;
}
function _ci2x(i, w) { const t = _idx.cy.length; return t < 2 ? 0 : (i / (t - 1)) * w; }
function _x2ci(x, w) { const cy = _idx.cy, t = cy.length; if (t < 2) return 0; return Math.max(0, Math.min(t - 1, Math.round((x / w) * (t - 1)))); }

function _dw(w, p) { return w - p * 2; }

// ==================== DYNASTY TIMELINE ====================

function _dynastyWeights() {
  const cy = _idx.cy;
  const ver = cy.length + '|' + (cy[0] || '') + '|' + (cy[cy.length-1] || '');
  if (_dynastyWeightsCache && _dynastyWeightsVer === ver) return _dynastyWeightsCache;
  const result = [...HashSearch.dynasties].sort((a, b) => a.start - b.start).map(d => {
    let c = 0;
    for (const y of cy) { if (y >= d.start && y <= d.end) c++; }
    return { d, weight: Math.max(c, 1) };
  });
  _dynastyWeightsVer = ver;
  _dynastyWeightsCache = result;
  return result;
}

function _dynastyLayout(drawW) {
  if (_dynastyLayoutCache.drawW === drawW && _dynastyLayoutCache.layout) {
    return _dynastyLayoutCache.layout;
  }
  const ws = _dynastyWeights();
  const tw = ws.reduce((s, w) => s + w.weight, 0);
  const rw = ws.map(w => Math.max((w.weight / tw) * drawW, 8));
  const rt = rw.reduce((s, w) => s + w, 0);
  const result = rt > drawW
    ? ws.map((w, i) => ({ ...w, width: (rw[i] / rt) * drawW }))
    : ws.map((w, i) => ({ ...w, width: rw[i] }));
  _dynastyLayoutCache = { drawW, layout: result };
  return result;
}

function dynastyDraw() {
  if (_dynastyDrawPending) return;
  _dynastyDrawPending = true;
  requestAnimationFrame(() => {
    _dynastyDrawPending = false;
    _dynastyDrawNow();
  });
}
function _dynastyDrawNow() {
  const ctx = _state.ctxD, w = _state.canvasD.width / (window.devicePixelRatio || 1), h = _state.canvasD.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  const px = 8, by = h * 0.15, bh = h * 0.7, drawW = _dw(w, px), r = 3, layout = _dynastyLayout(drawW);
  let xo = px;
  for (const { d, width } of layout) {
    const x1 = xo, x2 = xo + width;
    const isA = _idx.selDyn === d.id, isC = _idx.curYear >= d.start && _idx.curYear <= d.end, isH = _state.hoverDynasty === d.id;
    const a = isA ? 1 : (isC || isH) ? 0.9 : 0.35;
    ctx.fillStyle = d.color + Math.round(a * 255).toString(16).padStart(2, '0');
    ctx.strokeStyle = isA ? '#fff' : 'transparent';
    ctx.lineWidth = isA ? 1 : 0;
    ctx.beginPath(); ctx.moveTo(x1 + r, by); ctx.lineTo(x2 - r, by); ctx.quadraticCurveTo(x2, by, x2, by + r);
    ctx.lineTo(x2, by + bh - r); ctx.quadraticCurveTo(x2, by + bh, x2 - r, by + bh);
    ctx.lineTo(x1 + r, by + bh); ctx.quadraticCurveTo(x1, by + bh, x1, by + bh - r);
    ctx.lineTo(x1, by + r); ctx.quadraticCurveTo(x1, by, x1 + r, by); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (width > 14) {
      ctx.fillStyle = (isA || isC || isH) ? '#fff' : 'rgba(255,255,255,0.6)';
      ctx.font = `${Math.max(7, Math.min(9, bh * 0.65))}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.name, x1 + width / 2, by + bh / 2);
    }
    xo = x2;
  }
  const ci = _gi(_idx.curYear);
  if (ci !== undefined && _idx.cy.length > 1) {
    const cx = _ci2x(ci, drawW) + px;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke(); ctx.setLineDash([]);
  }
}

function dynastyAt(cx) {
  const rect = _state.canvasD.getBoundingClientRect();
  const px = 8, drawW = _dw(rect.width, px), rx = cx - rect.left, layout = _dynastyLayout(drawW);
  let xo = px;
  for (const { d, width } of layout) { if (rx >= xo && rx <= xo + width) return d; xo += width; }
  return null;
}

function _dynastyHandleMove(e) {
  const d = dynastyAt(e.clientX);
  if (d) {
    _state.hoverDynasty = d.id;
    _state.tooltipD.textContent = `${d.name}（${HashSearch.formatYear(d.start)} ~ ${HashSearch.formatYear(d.end)}）`;
    _state.tooltipD.classList.remove('hidden');
    const vw = window.innerWidth, vh = window.innerHeight;
    const tx = e.clientX + 12, ty = e.clientY - 32;
    const tw = _state.tooltipD.offsetWidth || 200, th = _state.tooltipD.offsetHeight || 40;
    _state.tooltipD.style.left = Math.min(tx, vw - tw - 8) + 'px';
    _state.tooltipD.style.top = Math.max(8, Math.min(ty, vh - th - 8)) + 'px';
  } else { _state.hoverDynasty = null; _state.tooltipD.classList.add('hidden'); }
  dynastyDraw();
}

// ==================== CALENDAR TIMELINE ====================

function calendarDraw() {
  if (_calendarDrawPending) return;
  _calendarDrawPending = true;
  requestAnimationFrame(() => {
    _calendarDrawPending = false;
    _calendarDrawNow();
  });
}
function _calendarDrawNow() {
  const ctx = _state.ctxC, w = _state.canvasC.width / (window.devicePixelRatio || 1), h = _state.canvasC.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);
  const px = 8, drawW = _dw(w, px), tt = h * 0.1, th = h * 0.45, years = _idx.cy, total = years.length;
  if (total < 2) return;
  ctx.strokeStyle = _cssVar('--color-timeline-minor'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, tt); ctx.lineTo(w - px, tt); ctx.stroke();

  if (_idx.selDyn) {
    const d = HashSearch.dynasties.find(d => d.id === _idx.selDyn);
    if (d) {
      const si = _nearestGi(d.start), ei = _nearestGi(d.end);
      if (si !== undefined && ei !== undefined) {
        const dx1 = _ci2x(si, drawW) + px, dx2 = _ci2x(ei, drawW) + px;
        ctx.fillStyle = 'rgba(255,165,87,0.12)'; ctx.fillRect(dx1, 0, dx2 - dx1, h);
        ctx.strokeStyle = 'rgba(255,165,87,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([6, 3]);
        ctx.beginPath(); ctx.moveTo(dx1, tt); ctx.lineTo(dx1, tt + h * 0.8);
        ctx.moveTo(dx2, tt); ctx.lineTo(dx2, tt + h * 0.8); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  for (let i = 0; i < total; i++) {
    const y = years[i], x = _ci2x(i, drawW) + px;
    if (x < -20 || x > w + 20) continue;
    const isC = y === _idx.curYear, isH = y === _state.hoverYear;
    const isCent = y % 100 === 0, isDec = y % 10 === 0;
    if (isC) { ctx.fillStyle = _cssVarRgba('--color-accent', 0.15); ctx.fillRect(x - 2, 0, 4, h); }
    if (isCent) { ctx.strokeStyle = _cssVar('--color-timeline-major'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, tt); ctx.lineTo(x, tt + th * 1.44); ctx.stroke(); }
    else if (isDec) { ctx.strokeStyle = _cssVar('--color-timeline-mid'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, tt); ctx.lineTo(x, tt + th); ctx.stroke(); }
    else { ctx.strokeStyle = isC || isH ? _cssVar('--color-timeline-major') : _cssVar('--color-timeline-minor'); ctx.lineWidth = isC || isH ? 1.5 : 0.5; ctx.beginPath(); ctx.moveTo(x, tt); ctx.lineTo(x, tt + th * 0.56); ctx.stroke(); }
    if (isC || isH) {
      ctx.fillStyle = isC ? _cssVar('--color-accent') : _cssVar('--color-dynasty');
      ctx.beginPath(); ctx.arc(x, tt + h * 0.5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  const ci = _gi(_idx.curYear);
  if (ci !== undefined) {
    const cx = _ci2x(ci, drawW) + px;
    ctx.strokeStyle = _cssVarRgba('--color-accent', 0.3); ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke(); ctx.setLineDash([]);
  }
}

function calendarYearAt(cx) {
  const rect = _state.canvasC.getBoundingClientRect(), px = 8, drawW = _dw(rect.width, px), rx = cx - rect.left;
  if (_idx.cy.length > 1) { const idx = _x2ci(rx - px, drawW); return _idx.cy[Math.max(0, Math.min(_idx.cy.length - 1, idx))]; }
  return 0;
}

// ==================== COMMON ====================

function resize() {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    _resizeNow();
  }, 200);
}
function _resizeNow() {
  for (const key of ['D', 'C']) {
    const cont = _state[`container${key}`], can = _state[`canvas${key}`], ctx = _state[`ctx${key}`];
    if (!cont || !can || !ctx) continue;
    const rect = cont.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    can.width = rect.width * dpr; can.height = rect.height * dpr;
    can.style.width = rect.width + 'px'; can.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  _dynastyLayoutCache = { drawW: -1, layout: null };
  _colorCache = {};
  _dynastyDrawNow();
  _calendarDrawNow();
}

function init() {
  _cacheDom();
  if (!_state.canvasD || !_state.canvasC) {
    console.warn('[实录] 时间轴 canvas 元素未找到，跳过初始化');
    return;
  }
  window.addEventListener('shilu:themechange', () => { _colorCache = {}; _dynastyDrawNow(); _calendarDrawNow(); });
  const D = _state.containerD, C = _state.containerC;
  if (!D || !C) return;
  resize();

  D.addEventListener('click', e => { const d = dynastyAt(e.clientX); if (d) { state.selectedDynasty = d.id; dynastyDraw(); document.dispatchEvent(new CustomEvent('shilu:dynastySelect', { detail: d })); } });
  D.addEventListener('mousemove', _dynastyHandleMove);
  D.addEventListener('mouseleave', () => { _state.hoverDynasty = null; _state.tooltipD.classList.add('hidden'); dynastyDraw(); });

  let dtLast = null, dtTime = 0;
  D.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; e.preventDefault(); const t = e.touches[0], d = dynastyAt(t.clientX); if (d) { dtLast = d.id; state.selectedDynasty = d.id; dynastyDraw(); document.dispatchEvent(new CustomEvent('shilu:dynastySelect', { detail: d })); } }, { passive: false });
  D.addEventListener('touchmove', e => { if (e.touches.length !== 1) return; e.preventDefault(); const now = Date.now(); if (now - dtTime < TOUCH_THROTTLE_MS) return; dtTime = now; const t = e.touches[0], d = dynastyAt(t.clientX); if (d && d.id !== dtLast) { dtLast = d.id; state.selectedDynasty = d.id; dynastyDraw(); document.dispatchEvent(new CustomEvent('shilu:dynastySelect', { detail: d })); } }, { passive: false });

  C.addEventListener('click', e => { const y = calendarYearAt(e.clientX); if (y >= HashSearch.YEAR_MIN && y <= HashSearch.YEAR_MAX) { document.dispatchEvent(new CustomEvent('shilu:yearSelect', { detail: y })); } });
  C.addEventListener('mousemove', e => { const y = calendarYearAt(e.clientX); if (y >= HashSearch.YEAR_MIN && y <= HashSearch.YEAR_MAX) {     _state.hoverYear = y; _state.tooltipC.textContent = HashSearch.formatYear(y); _state.tooltipC.classList.remove('hidden');
    const vw = window.innerWidth, vh = window.innerHeight;
    const tx = e.clientX + 12, ty = e.clientY - 28;
    const tw = _state.tooltipC.offsetWidth || 120, th = _state.tooltipC.offsetHeight || 30;
    _state.tooltipC.style.left = Math.min(tx, vw - tw - 8) + 'px';
    _state.tooltipC.style.top = Math.max(8, Math.min(ty, vh - th - 8)) + 'px';
    calendarDraw(); } else { _state.hoverYear = null; _state.tooltipC.classList.add('hidden'); calendarDraw(); } });
  C.addEventListener('mouseleave', () => { _state.hoverYear = null; _state.tooltipC.classList.add('hidden'); calendarDraw(); });

  let ctLast = null, ctTime = 0;
  C.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; e.preventDefault(); const t = e.touches[0], y = calendarYearAt(t.clientX); if (y >= HashSearch.YEAR_MIN && y <= HashSearch.YEAR_MAX) { ctLast = y; document.dispatchEvent(new CustomEvent('shilu:yearSelect', { detail: y })); } }, { passive: false });
  C.addEventListener('touchmove', e => { if (e.touches.length !== 1) return; e.preventDefault(); const now = Date.now(); if (now - ctTime < TOUCH_THROTTLE_MS) return; ctTime = now; const t = e.touches[0], y = calendarYearAt(t.clientX); if (y >= HashSearch.YEAR_MIN && y <= HashSearch.YEAR_MAX && y !== ctLast) { ctLast = y; document.dispatchEvent(new CustomEvent('shilu:yearSelect', { detail: y })); } }, { passive: false });
}

const Timelines = { init, resize, dynastyDraw, calendarDraw };
export default Timelines;
