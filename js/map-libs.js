const CSS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css'
];

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
    try { sessionStorage.setItem(REGION_KEY, 'en'); } catch (_) {}
    return 'en';
  }
}

function _getRegion() {
  if (!_regionPromise) _regionPromise = _detectRegion();
  return _regionPromise;
}

const TILE_ATTR = '&copy; Esri';
const TILE_STREET_ATTR = '&copy; OpenStreetMap';
const TILE_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILE_STREET = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

export function createTileLayers(map) {
  if (!map) return {};
  const opts = { maxZoom: 18, updateWhenIdle: false, updateWhenZooming: false };
  const sat = L.tileLayer(TILE_SATELLITE, { ...opts, attribution: TILE_ATTR });
  const str = L.tileLayer(TILE_STREET, { ...opts, attribution: TILE_STREET_ATTR });
  return { satellite: sat, street: str };
}

const _cssPromises = new Map();
const _jsPromises = new Map();

function loadCSS(url) {
  if (_cssPromises.has(url)) return _cssPromises.get(url);
  const p = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = url;
    link.onload = resolve; link.onerror = resolve;
    document.head.appendChild(link);
  });
  _cssPromises.set(url, p);
  return p;
}

function loadJS(url) {
  if (_jsPromises.has(url)) return _jsPromises.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error('Failed to load: ' + url));
    document.body.appendChild(s);
  });
  _jsPromises.set(url, p);
  return p;
}

let _leafletPromise = null;
function _loadLeaflet() {
  if (!_leafletPromise) {
    _leafletPromise = (async () => {
      await loadCSS(CSS[0]);
      await loadJS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    })();
  }
  return _leafletPromise;
}

let _maplibrePromise = null;
export function loadMaplibre() {
  if (!_maplibrePromise) {
    _maplibrePromise = (async () => {
      await loadCSS(CSS[1]);
      await loadJS('https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js');
      await loadJS('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js');
      await loadJS('js/maplibre-gl-dates.js');
    })();
  }
  return _maplibrePromise;
}

export function ensureL() {
  if (typeof L !== 'undefined') return Promise.resolve();
  return _loadLeaflet();
}

export const HISTORIC_ATTR = '&copy; OpenHistoricalMap';

export function createSwitchLayer(map, satLayer, strLayer, histLayer, getCurrentLayer, setCurrentLayer, satBtn, strBtn, histBtn, attributionControl, onSwitchHistoric) {
  return function switchLayer(type) {
    const _histLayer = typeof histLayer === 'function' ? histLayer() : histLayer;
    if (!map || getCurrentLayer() === type) return;
    if (type === 'historic' && !_histLayer) return;

    const current = getCurrentLayer();
    if (current === 'satellite') map.removeLayer(satLayer);
    else if (current === 'street') map.removeLayer(strLayer);
    else { if (_histLayer) map.removeLayer(_histLayer); if (attributionControl) attributionControl.removeAttribution(HISTORIC_ATTR); }

    setCurrentLayer(type);

    if (type === 'satellite') satLayer.addTo(map);
    else if (type === 'street') strLayer.addTo(map);
    else if (_histLayer) { _histLayer.addTo(map); if (attributionControl) attributionControl.addAttribution(HISTORIC_ATTR); if (onSwitchHistoric) onSwitchHistoric(); }

    if (satBtn) satBtn.classList.toggle('active', type === 'satellite');
    if (strBtn) strBtn.classList.toggle('active', type === 'street');
    if (histBtn) histBtn.classList.toggle('active', type === 'historic');
  };
}

export async function initHistoricLayer(setHistoricLayer, histBtn) {
  try {
    await loadMaplibre();
    if (typeof L.maplibreGL !== 'undefined') {
      const layer = L.maplibreGL({
        style: 'https://www.openhistoricalmap.org/map-styles/main/main.json',
        attributionControl: false
      });
      setHistoricLayer(layer);
      if (histBtn) { histBtn.disabled = false; histBtn.title = ''; }
    }
  } catch (_) {}
}

_getRegion();