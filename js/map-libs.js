const CSS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css'
];

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

async function _loadMaplibre() {
  await loadCSS(CSS[1]);
  await loadJS('https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js');
  await loadJS('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js');
  await loadJS('js/maplibre-gl-dates.js');
}

export function loadMaplibre() {
  return _loadMaplibre();
}

export function ensureL() {
  if (typeof L !== 'undefined') return Promise.resolve();
  return _loadLeaflet().then(() => {
    if (typeof L === 'undefined') return new Promise(r => setTimeout(r, 2000));
  });
}
