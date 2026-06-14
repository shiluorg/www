import state from './state.js';

let _map = null;
let _satelliteLayer = null;
let _streetLayer = null;
let _currentLayer = 'satellite';

function init() {
  if (typeof L === 'undefined') {
    const t = setTimeout(() => {
      if (typeof L !== 'undefined') { clearTimeout(t); _initMap(); }
    }, 3000);
    return;
  }
  _initMap();
}

function _initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.warn('[实录] 地图容器 #map 未找到');
    return;
  }
  _map = L.map('map', {
    center: [30, 20],
    zoom: 3,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: false,
    attributionControl: false
  });

  _satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: ''
  });

  _streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  });

  _satelliteLayer.addTo(_map);
  L.control.zoom({ position: 'topleft' }).addTo(_map);

  _map.on('click', () => {
    const panel = document.getElementById('event-detail-panel');
    if (panel) panel.classList.add('hidden');
    if (state.activeMarker) {
      const el = state.activeMarker.getElement();
      if (el) el.classList.remove('active');
      state.activeMarker = null;
    }
  });
  window.addEventListener('resize', () => { if (_map) _map.invalidateSize(); });

  const satBtn = document.getElementById('layer-satellite');
  const strBtn = document.getElementById('layer-street');
  if (satBtn) satBtn.addEventListener('click', () => switchLayer('satellite'));
  if (strBtn) strBtn.addEventListener('click', () => switchLayer('street'));
}

function switchLayer(type) {
  if (!_map || _currentLayer === type) return;
  _currentLayer = type;
  const satBtn = document.getElementById('layer-satellite');
  const strBtn = document.getElementById('layer-street');
  if (type === 'satellite') {
    _map.removeLayer(_streetLayer);
    _satelliteLayer.addTo(_map);
    if (satBtn) satBtn.classList.add('active');
    if (strBtn) strBtn.classList.remove('active');
  } else {
    _map.removeLayer(_satelliteLayer);
    _streetLayer.addTo(_map);
    if (strBtn) strBtn.classList.add('active');
    if (satBtn) satBtn.classList.remove('active');
  }
}

function clearMarkers() {
  state.markers.forEach(m => {
    if (_map) _map.removeLayer(m);
  });
  state.markers = [];
  state.activeMarker = null;
}

function showEvents(events) {
  if (!_map) return;
  clearMarkers();
  const hint = document.getElementById('map-empty-hint');
  if (!events || events.length === 0) {
    if (hint) hint.classList.remove('hidden');
    return;
  }
  if (hint) hint.classList.add('hidden');
  const bounds = [];
  events.forEach(evt => {
    const marker = L.marker([evt.a, evt.l], {
      icon: L.divIcon({
        className: 'custom-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    });
    const regionLabel = evt.r ? `<span style="color:#f0883e;font-size:11px;">${evt.r}</span>` : '';
    marker.bindTooltip(`<div style="text-align:center;"><strong>${evt.t}</strong><br>${regionLabel}</div>`, {
      direction: 'top',
      offset: [0, -10],
      className: '',
      sticky: true
    });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      state.markers.forEach(m => { const el = m.getElement(); if (el) el.classList.remove('active'); });
      const el = marker.getElement();
      if (el) el.classList.add('active');
      state.activeMarker = marker;
      document.dispatchEvent(new CustomEvent('shilu:selectEvent', { detail: evt }));
    });
    marker.addTo(_map);
    state.markers.push(marker);
    bounds.push([evt.a, evt.l]);
  });
  if (bounds.length > 1) {
    _map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
  } else if (bounds.length === 1) {
    _map.setView(bounds[0], 5);
  }
}

function setView(lat, lng, zoom) {
  if (_map) _map.setView([lat, lng], zoom || 5);
}

function invalidateSize() {
  if (_map) _map.invalidateSize();
}

const MapView = { init, switchLayer, clearMarkers, showEvents, setView, invalidateSize };
export default MapView;
