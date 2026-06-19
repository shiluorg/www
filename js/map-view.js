import state from './state.js';
import { ensureL, createTileLayers, createSwitchLayer, initHistoricLayer } from './map-libs.js';

let _map = null;
let _satelliteLayer = null;
let _streetLayer = null;
let _historicLayer = null;
let _currentLayer = 'satellite';
let _currentYear = 1;
let _sharedIcon = null;
let _satBtn = null, _strBtn = null, _histBtn = null;
let _pendingEvents = null;
let _doSwitchLayer = () => {};

function _getIcon() {
  if (!_sharedIcon) _sharedIcon = L.divIcon({ className: 'custom-marker', iconSize: [14, 14], iconAnchor: [7, 7] });
  return _sharedIcon;
}

async function init() {
  await ensureL();
  _initMap();
  if (_pendingEvents) { const evts = _pendingEvents; _pendingEvents = null; _showEvents(evts); }
  initHistoricLayer(l => { _historicLayer = l; }, _histBtn);
}

function _initMap() {
  if (!document.getElementById('map')) return;
  _map = L.map('map', {
    center: [30, 20], zoom: 3,
    zoomControl: false, attributionControl: true
  });
  const layers = createTileLayers(_map);
  _satelliteLayer = layers.satellite;
  _streetLayer = layers.street;
  _satelliteLayer.addTo(_map);
  L.control.zoom({ position: 'topleft' }).addTo(_map);
  _map.attributionControl.setPrefix('');
  _map.on('click', () => {
    const panel = document.getElementById('event-detail-panel');
    if (panel) panel.classList.add('hidden');
    if (state.activeMarker && state.markers.includes(state.activeMarker)) {
      const el = state.activeMarker.getElement();
      if (el) el.classList.remove('active');
      state.activeMarker = null;
    }
  });
  window.addEventListener('resize', () => { if (_map) _map.invalidateSize(); });
  _satBtn = document.getElementById('layer-satellite');
  _strBtn = document.getElementById('layer-street');
  _histBtn = document.getElementById('layer-historic');
  _doSwitchLayer = createSwitchLayer(
    _map, _satelliteLayer, _streetLayer,
    () => _historicLayer,
    () => _currentLayer,
    (type) => { _currentLayer = type; },
    _satBtn, _strBtn, _histBtn,
    _map.attributionControl,
    () => _applyHistoricDate()
  );
  if (_satBtn) _satBtn.addEventListener('click', () => switchLayer('satellite'));
  if (_strBtn) _strBtn.addEventListener('click', () => switchLayer('street'));
  if (_histBtn) { _histBtn.disabled = true; _histBtn.title = '加载中...'; _histBtn.addEventListener('click', () => switchLayer('historic')); }
}

function switchLayer(type) { _doSwitchLayer(type); }

function _formatISODate(year) {
  const y = Math.abs(year);
  return (year < 0 ? '-' : '') + String(y).padStart(4, '0') + '-01-01';
}

function _applyHistoricDate() {
  if (!_historicLayer) return;
  try {
    const mlMap = _historicLayer.getMaplibreMap();
    if (!mlMap || !mlMap.filterByDate) return;
    const apply = () => { if (_currentYear) mlMap.filterByDate(_formatISODate(_currentYear)); };
    if (mlMap.isStyleLoaded()) apply(); else mlMap.once('styledata', apply);
  } catch (_) {}
}

function setHistoricDate(year) { if (year) { _currentYear = year; if (_currentLayer === 'historic') _applyHistoricDate(); } }

function clearMarkers() {
  state.markers.forEach(m => { if (_map) _map.removeLayer(m); });
  state.markers = []; state.activeMarker = null;
}

function showEvents(events) { if (!_map) { _pendingEvents = events; return; } _showEvents(events); }

function _showEvents(events) {
  clearMarkers();
  const hint = document.getElementById('map-empty-hint');
  if (!events || events.length === 0) { if (hint) hint.classList.remove('hidden'); return; }
  if (hint) hint.classList.add('hidden');
  const bounds = [];
  events.forEach(evt => {
    if (evt.a == null || evt.l == null) return;
    const marker = L.marker([evt.a, evt.l], { icon: _getIcon() });
    const regionLabel = evt.r ? `<br><small>${evt.r}</small>` : '';
    marker.bindTooltip(`<strong>${evt.t}</strong>${regionLabel}`, { direction: 'top', offset: [0, -10], className: '', sticky: true });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      state.markers.forEach(m => { const el = m.getElement(); if (el) el.classList.remove('active'); });
      const el = marker.getElement();
      if (el) el.classList.add('active');
      state.activeMarker = marker;
      document.dispatchEvent(new CustomEvent('shilu:selectEvent', { detail: evt }));
    });
    marker.addTo(_map);
    marker._eventData = evt;
    state.markers.push(marker);
    bounds.push([evt.a, evt.l]);
  });
  if (bounds.length > 1) _map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
  else if (bounds.length === 1) _map.setView(bounds[0], 5);
}

function setView(lat, lng, zoom) { if (_map) _map.setView([lat, lng], zoom || 5); }

const MapView = { init, switchLayer, clearMarkers, showEvents, setView, setHistoricDate };
export default MapView;