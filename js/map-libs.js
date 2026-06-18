const CSS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css'
];

// --- IP-based region detection for tile CDN selection ---
const REGION_KEY = 'shilu_region';
let _regionPromise = null;

async function _detectRegion() {
  try {
    const cached = sessionStorage.getItem(REGION_KEY);
    if (cached === 'cn' || cached === 'en') return cached;
  } catch (_) {}

  try {
    const resp = await fetch('https://api.ip.sb/geoip', { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();
    const region = data.country_code === 'CN' ? 'cn' : 'en';
    try { sessionStorage.setItem(REGION_KEY, region); } catch (_) {}
    return region;
  } catch (_) {
    try { sessionStorage.setItem(REGION_KEY, 'cn'); } catch (_) {}
    return 'cn';
  }
}

function _getRegion() {
  if (!_regionPromise) _regionPromise = _detectRegion();
  return _regionPromise;
}

const TILE_CN = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
  attr: '&copy; Esri',
  streetAttr: '&copy; OpenStreetMap'
};

const TILE_EN = {
  satellite: 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
  attr: '&copy; Esri',
  streetAttr: '&copy; OpenStreetMap'
};

export async function getTileConfig() {
  const region = await _getRegion();
  return region === 'cn' ? TILE_CN : TILE_EN;
}

export function getTileConfigSync() {
  try {
    const cached = sessionStorage.getItem(REGION_KEY);
    if (cached === 'en') return TILE_EN;
  } catch (_) {}
  return TILE_CN;
}

function loadCSS(url) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = resolve;
    link.onerror = resolve;
    document.head.appendChild(link);
  });
}

function loadJS(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + url));
    document.body.appendChild(s);
  });
}

async function _loadLeaflet() {
  await loadCSS(CSS[0]);
  await loadJS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
}

export async function loadMaplibre() {
  await loadCSS(CSS[1]);
  await loadJS('https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js');
  await loadJS('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js');
  await loadJS('js/maplibre-gl-dates.js');
}

export function ensureL() {
  if (typeof L !== 'undefined') return Promise.resolve();
  return _loadLeaflet();
}

export const HISTORIC_ATTR = '&copy; OpenHistoricalMap';

/**
 * 创建统一的图层切换函数。
 * @param {object} map - Leaflet map 实例
 * @param {object} satLayer - 卫星图层
 * @param {object} strLayer - 街道图层
 * @param {function|object} histLayer - 历史图层（若为函数则惰性求值）
 * @param {function} getCurrentLayer - 返回当前图层类型
 * @param {function} setCurrentLayer - 设置当前图层类型
 * @param {HTMLElement|null} satBtn - 卫星按钮
 * @param {HTMLElement|null} strBtn - 街道按钮
 * @param {HTMLElement|null} histBtn - 历史按钮
 * @param {object|null} attributionControl - Leaflet attribution control
 * @param {function} [onSwitchHistoric] - 切换到历史图层后的额外回调
 * @returns {function} switchLayer(type) 函数
 */
export function createSwitchLayer(map, satLayer, strLayer, histLayer, getCurrentLayer, setCurrentLayer, satBtn, strBtn, histBtn, attributionControl, onSwitchHistoric) {
  return function switchLayer(type) {
    const _histLayer = typeof histLayer === 'function' ? histLayer() : histLayer;
    if (!map || getCurrentLayer() === type) return;
    if (type === 'historic' && !_histLayer) return;

    const current = getCurrentLayer();
    if (current === 'satellite') map.removeLayer(satLayer);
    else if (current === 'street') map.removeLayer(strLayer);
    else { if (_histLayer) { map.removeLayer(_histLayer); } if (attributionControl) attributionControl.removeAttribution(HISTORIC_ATTR); }

    setCurrentLayer(type);

    if (type === 'satellite') satLayer.addTo(map);
    else if (type === 'street') strLayer.addTo(map);
    else if (_histLayer) { _histLayer.addTo(map); if (attributionControl) attributionControl.addAttribution(HISTORIC_ATTR); if (onSwitchHistoric) onSwitchHistoric(); }

    if (satBtn) satBtn.classList.toggle('active', type === 'satellite');
    if (strBtn) strBtn.classList.toggle('active', type === 'street');
    if (histBtn) histBtn.classList.toggle('active', type === 'historic');
  };
}

/**
 * 延迟加载历史地图图层（Maplibre GL）。
 * @param {function} setHistoricLayer - 回调，接收创建后的图层实例
 * @param {HTMLElement|null} histBtn - 历史按钮
 */
export async function initHistoricLayer(setHistoricLayer, histBtn) {
  try {
    await loadMaplibre();
    if (typeof L.maplibreGL !== 'undefined') {
      const layer = L.maplibreGL({
        style: 'https://www.openhistoricalmap.org/map-styles/main/main.json',
        attributionControl: false
      });
      setHistoricLayer(layer);
      if (histBtn) {
        histBtn.disabled = false;
        histBtn.title = '';
      }
    }
  } catch (_) {}
}

// Start region detection early (fire-and-forget)
_getRegion();