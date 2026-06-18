import { t9n } from './i18n.js';
import { ensureL, loadMaplibre, getTileConfigSync, createSwitchLayer, initHistoricLayer } from './map-libs.js';
import { _showCards, gameShare } from './game-center.js';

let _map = null;
let _currentEvent = null;
let _totalScore = 0;
let _userMarker = null;
let _correctMarker = null;
let _line = null;
let _satelliteLayer = null, _streetLayer = null, _historicLayer = null;
let _currentLayer = 'satellite';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _pickRandomEvent(events) {
  const filtered = events.filter(e => e.a != null && e.l != null);
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function _newQuestion(container, events) {
  const dict = t9n();
  const evt = _pickRandomEvent(events);
  if (!evt) return;
  _currentEvent = evt;

  // Clear previous markers
  if (_userMarker) { _map.removeLayer(_userMarker); _userMarker = null; }
  if (_correctMarker) { _map.removeLayer(_correctMarker); _correctMarker = null; }
  if (_line) { _map.removeLayer(_line); _line = null; }

  const question = container.querySelector('.map-game__question');
  const nextBtn = container.querySelector('.map-game__next');
  if (question) question.textContent = dict.mapGameQuestion(evt.t);
  if (nextBtn) nextBtn.classList.remove('show');
}

export async function initMapGame(container, events) {
  await ensureL();
  const dict = t9n();

  container.innerHTML = `
    <div class="game-panel-header">
      <button class="game-back-btn" data-back="map">${dict.gameBackBtn}</button>
      <button class="game-share-btn" data-tab="map">📤</button>
    </div>
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
      <span class="map-game__total">${dict.mapGameTotal(0)}</span>
    </div>
    <button class="map-game__next">${dict.mapGameNext}</button>
  `;

  // Init Leaflet map
  const mapEl = container.querySelector('#map-game-map');
  if (!mapEl) return;

  _map = L.map(mapEl, {
    scrollWheelZoom: true,
    doubleClickZoom: false,
    dragging: true,
    zoomControl: true,
    attributionControl: true
  }).setView([30, 40], 2);

  // Layer tiles (same as home page)
  const tiles = getTileConfigSync();
  _satelliteLayer = L.tileLayer(tiles.satellite, {
    maxZoom: 18, attribution: tiles.attr,
    updateWhenIdle: false, updateWhenZooming: false
  });
  _streetLayer = L.tileLayer(tiles.street, {
    maxZoom: 18, attribution: tiles.streetAttr || tiles.attr,
    updateWhenIdle: false, updateWhenZooming: false
  });
  _satelliteLayer.addTo(_map);
  _map.attributionControl.setPrefix('');

  // Layer switch function (shared)
  const gmSatBtn = container.querySelector('#gm-layer-satellite');
  const gmStrBtn = container.querySelector('#gm-layer-street');
  const gmHistBtn = container.querySelector('#gm-layer-historic');

  const switchLayer = createSwitchLayer(
    _map, _satelliteLayer, _streetLayer,
    () => _historicLayer,
    () => _currentLayer,
    (type) => { _currentLayer = type; },
    gmSatBtn, gmStrBtn, gmHistBtn,
    _map.attributionControl
  );
  if (gmSatBtn) gmSatBtn.addEventListener('click', () => switchLayer('satellite'));
  if (gmStrBtn) gmStrBtn.addEventListener('click', () => switchLayer('street'));
  if (gmHistBtn) {
    gmHistBtn.disabled = true;
    gmHistBtn.title = '\u52A0\u8F7D\u4E2D...';
    gmHistBtn.addEventListener('click', () => switchLayer('historic'));
  }

  // Map click handler
  _map.on('click', function(e) {
    if (!_currentEvent) return;
    const dict = t9n();

    // Clear previous
    if (_userMarker) _map.removeLayer(_userMarker);
    if (_correctMarker) _map.removeLayer(_correctMarker);
    if (_line) _map.removeLayer(_line);

    const userLat = e.latlng.lat;
    const userLng = e.latlng.lng;
    const correctLat = _currentEvent.a;
    const correctLng = _currentEvent.l;

    // User marker (red)
    _userMarker = L.circleMarker([userLat, userLng], {
      radius: 8,
      color: '#f85149',
      fillColor: '#f85149',
      fillOpacity: 0.8,
      weight: 2
    }).addTo(_map);
    _userMarker.bindPopup(dict.mapGameYour).openPopup();

    // Correct marker (green)
    _correctMarker = L.circleMarker([correctLat, correctLng], {
      radius: 8,
      color: '#3fb950',
      fillColor: '#3fb950',
      fillOpacity: 0.8,
      weight: 2
    }).addTo(_map);
    _correctMarker.bindPopup(dict.mapGameCorrect).openPopup();

    // Distance line
    const km = haversine(userLat, userLng, correctLat, correctLng);
    _line = L.polyline([[userLat, userLng], [correctLat, correctLng]], {
      color: '#ffa657',
      weight: 2,
      dashArray: '5, 5'
    }).addTo(_map);

    // Fit bounds
    const bounds = L.latLngBounds([[userLat, userLng], [correctLat, correctLng]]);
    _map.fitBounds(bounds, { padding: [50, 50] });

    // Score
    const score = Math.max(0, Math.round(100 - km / 50));
    _totalScore += score;

    const distEl = container.querySelector('.map-game__score-text');
    const totalEl = container.querySelector('.map-game__total');
    const nextBtn = container.querySelector('.map-game__next');
    if (distEl) distEl.textContent = dict.mapGameDistance(km.toFixed(0));
    if (totalEl) totalEl.textContent = dict.mapGameTotal(_totalScore);
    if (nextBtn) nextBtn.classList.add('show');

    _currentEvent = null;
  });

  // Back button
  const backBtn = container.querySelector('.game-back-btn');
  if (backBtn) backBtn.addEventListener('click', _showCards);

  // Share button
  const shareBtn = container.querySelector('.game-share-btn');
  if (shareBtn) shareBtn.addEventListener('click', () => gameShare(shareBtn.dataset.tab));

  // Next button
  const nextBtn = container.querySelector('.map-game__next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      _newQuestion(container, events);
      const distEl = container.querySelector('.map-game__score-text');
      if (distEl) distEl.textContent = dict.mapGameScore(0);
    });
  }

  // Start first question
  _newQuestion(container, events);

  // Deferred load historic layer
  initHistoricLayer(
    (layer) => { _historicLayer = layer; },
    container.querySelector('#gm-layer-historic')
  );
}