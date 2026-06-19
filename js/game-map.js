import { t9n } from './i18n.js';
import { ensureL, createTileLayers, createSwitchLayer, initHistoricLayer } from './map-libs.js';
import { _showCards, gameShare } from './game-center.js';

let _map = null;
let _currentEvent = null;
let _totalScore = 0;
let _userMarker = null, _correctMarker = null, _line = null;
let _satelliteLayer = null, _streetLayer = null, _historicLayer = null;
let _currentLayer = 'satellite';
let _$question = null, _$scoreText = null, _$totalText = null, _$distText = null, _$nextBtn = null;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _pickRandomEvent(events) {
  const filtered = events.filter(e => e.a != null && e.l != null);
  return filtered.length ? filtered[Math.floor(Math.random() * filtered.length)] : null;
}

function _newQuestion(container, events) {
  const evt = _pickRandomEvent(events);
  if (!evt) return;
  _currentEvent = evt;
  if (_userMarker) { _map.removeLayer(_userMarker); _userMarker = null; }
  if (_correctMarker) { _map.removeLayer(_correctMarker); _correctMarker = null; }
  if (_line) { _map.removeLayer(_line); _line = null; }
  if (_$question) _$question.textContent = t9n().mapGameQuestion(evt.t);
  if (_$nextBtn) _$nextBtn.classList.remove('show');
}

export async function initMapGame(container, events) {
  await ensureL();
  const dict = t9n();

  container.innerHTML = `
    <button class="game-back-btn" data-back="map">${dict.gameBackBtn}</button>
    <button class="game-share-btn" data-tab="map">📤</button>
    <div class="map-game__question"></div>
    <div class="map-game__map-area">
      <div id="map-game-map" class="map-game__map"></div>
      <div class="map-events__layer-toggle">
        <button id="gm-layer-satellite" class="layer-btn active">${dict.layerSatellite}</button>
        <button id="gm-layer-street" class="layer-btn">${dict.layerStreet}</button>
        <button id="gm-layer-historic" class="layer-btn">${dict.layerHistoric}</button>
      </div>
    </div>
    <div class="map-game__score">
      <span class="map-game__score-text">${dict.mapGameScore(0)}</span>
      <span class="map-game__dist-text"></span>
      <span class="map-game__total">${dict.mapGameTotal(0)}</span>
    </div>
    <button class="map-game__next">${dict.mapGameNext}</button>
  `;

  const mapEl = container.querySelector('#map-game-map');
  if (!mapEl) return;

  // Cache DOM refs
  _$question = container.querySelector('.map-game__question');
  _$scoreText = container.querySelector('.map-game__score-text');
  _$distText = container.querySelector('.map-game__dist-text');
  _$totalText = container.querySelector('.map-game__total');
  _$nextBtn = container.querySelector('.map-game__next');

  _map = L.map(mapEl, { scrollWheelZoom: true, doubleClickZoom: false, dragging: true, zoomControl: true, attributionControl: true }).setView([30, 40], 2);

  const layers = createTileLayers(_map);
  _satelliteLayer = layers.satellite;
  _streetLayer = layers.street;
  _satelliteLayer.addTo(_map);
  _map.attributionControl.setPrefix('');

  const gmSatBtn = container.querySelector('#gm-layer-satellite');
  const gmStrBtn = container.querySelector('#gm-layer-street');
  const gmHistBtn = container.querySelector('#gm-layer-historic');

  const switchLayer = createSwitchLayer(_map, _satelliteLayer, _streetLayer, () => _historicLayer, () => _currentLayer, (t) => { _currentLayer = t; }, gmSatBtn, gmStrBtn, gmHistBtn, _map.attributionControl);
  if (gmSatBtn) gmSatBtn.addEventListener('click', () => switchLayer('satellite'));
  if (gmStrBtn) gmStrBtn.addEventListener('click', () => switchLayer('street'));
  if (gmHistBtn) { gmHistBtn.disabled = true; gmHistBtn.title = '加载中...'; gmHistBtn.addEventListener('click', () => switchLayer('historic')); }

  _map.on('click', function(e) {
    if (!_currentEvent) return;
    const dict = t9n();
    if (_userMarker) _map.removeLayer(_userMarker);
    if (_correctMarker) _map.removeLayer(_correctMarker);
    if (_line) _map.removeLayer(_line);

    const userLat = e.latlng.lat, userLng = e.latlng.lng;
    const correctLat = _currentEvent.a, correctLng = _currentEvent.l;

    _userMarker = L.circleMarker([userLat, userLng], { radius: 8, color: '#f85149', fillColor: '#f85149', fillOpacity: 0.8, weight: 2 }).addTo(_map);
    _userMarker.bindPopup(dict.mapGameYour).openPopup();
    _correctMarker = L.circleMarker([correctLat, correctLng], { radius: 8, color: '#3fb950', fillColor: '#3fb950', fillOpacity: 0.8, weight: 2 }).addTo(_map);
    _correctMarker.bindPopup(dict.mapGameCorrect).openPopup();

    const km = haversine(userLat, userLng, correctLat, correctLng);
    _line = L.polyline([[userLat, userLng], [correctLat, correctLng]], { color: '#ffa657', weight: 2, dashArray: '5, 5' }).addTo(_map);
    _map.fitBounds(L.latLngBounds([[userLat, userLng], [correctLat, correctLng]]), { padding: [50, 50] });

    _totalScore += Math.max(0, Math.round(100 - km / 50));
    if (_$scoreText) _$scoreText.textContent = dict.mapGameScore(_totalScore);
    if (_$distText) _$distText.textContent = dict.mapGameDistance(km.toFixed(0));
    if (_$totalText) _$totalText.textContent = dict.mapGameTotal(_totalScore);
    if (_$nextBtn) _$nextBtn.classList.add('show');
    _currentEvent = null;
  });

  container.querySelector('.game-back-btn')?.addEventListener('click', _showCards);
  container.querySelector('.game-share-btn')?.addEventListener('click', () => gameShare('map'));
  if (_$nextBtn) _$nextBtn.addEventListener('click', () => { _newQuestion(container, events); if (_$scoreText) _$scoreText.textContent = t9n().mapGameScore(0); });

  _newQuestion(container, events);
  initHistoricLayer(l => { _historicLayer = l; }, container.querySelector('#gm-layer-historic'));
}