import { t9n } from './i18n.js';
import { _showCards, _shuffle, gameShare } from './game-center.js';

let _matchCards = [];
let _selectedCard = null;
let _matchedCount = 0;
let _matchYearCache = null;
let _score = 0;

function _isChinese(evt) {
  return evt.o === '亚洲' || (evt.o && evt.o.toLowerCase().includes('asia'));
}

function _findMatchYear(events) {
  if (_matchYearCache) {
    const year = Object.keys(_matchYearCache)[Math.floor(Math.random() * Object.keys(_matchYearCache).length)];
    return _matchYearCache[year];
  }
  // Build cache on first run
  const byYear = {};
  for (const evt of events) {
    if (!byYear[evt.y]) byYear[evt.y] = { chinese: [], foreign: [] };
    if (_isChinese(evt)) {
      byYear[evt.y].chinese.push(evt);
    } else {
      byYear[evt.y].foreign.push(evt);
    }
  }
  // Cache only years with at least 2 Chinese and 2 foreign events
  _matchYearCache = {};
  for (const [y, data] of Object.entries(byYear)) {
    if (data.chinese.length >= 2 && data.foreign.length >= 2) {
      _matchYearCache[y] = { year: parseInt(y), chinese: data.chinese, foreign: data.foreign };
    }
  }
  const keys = Object.keys(_matchYearCache);
  if (keys.length === 0) return null;
  const year = keys[Math.floor(Math.random() * keys.length)];
  return _matchYearCache[year];
}

function _renderCards(container, matchData) {
  const dict = t9n();
  const grid = container.querySelector('.match-game__grid');
  if (!grid) return;

  const pairCount = Math.min(matchData.chinese.length, matchData.foreign.length);
  const chinese = matchData.chinese.slice(0, pairCount);
  const foreign = matchData.foreign.slice(0, pairCount);
  _matchCards = _shuffle([
    ...chinese.map(e => ({ ...e, tag: '中', year: matchData.year })),
    ...foreign.map(e => ({ ...e, tag: '外', year: matchData.year }))
  ]);

  _matchedCount = 0;
  _selectedCard = null;

  grid.innerHTML = _matchCards.map((card, i) => `
    <div class="match-game__card" data-idx="${i}">
      <div class="match-game__card-title">${card.t}</div>
      <span class="match-game__card-tag">${card.tag}</span>
    </div>
  `).join('');

  grid.querySelectorAll('.match-game__card').forEach(cardEl => {
    cardEl.addEventListener('click', () => _onCardClick(container, cardEl));
  });

  const newBtn = container.querySelector('.match-game__new');
  if (newBtn) newBtn.classList.remove('show');
  const pick = container.querySelector('.match-game__pick');
  if (pick) pick.textContent = dict.matchGamePick;
}

function _onCardClick(container, cardEl) {
  const dict = t9n();
  const idx = parseInt(cardEl.dataset.idx);
  const card = _matchCards[idx];

  // Ignore already matched
  if (cardEl.classList.contains('matched')) return;

  if (!_selectedCard) {
    // First selection
    _selectedCard = { el: cardEl, idx, card };
    cardEl.classList.add('selected');
  } else if (_selectedCard.el === cardEl) {
    // Deselect
    _selectedCard = null;
    cardEl.classList.remove('selected');
  } else {
    // Second selection - check match
    const first = _selectedCard;
    if (first.card.year === card.year && first.card.tag !== card.tag) {
      // Match!
      first.el.classList.remove('selected');
      first.el.classList.add('matched');
      cardEl.classList.add('matched');
      _matchedCount += 2;
      _score += 10;
      _selectedCard = null;

      const scoreEl = container.querySelector('.match-game__score');
      if (scoreEl) scoreEl.textContent = dict.matchGameScore(_score);

      if (_matchedCount >= _matchCards.length) {
        const pick = container.querySelector('.match-game__pick');
        if (pick) pick.textContent = dict.matchGameDone;
        const newBtn = container.querySelector('.match-game__new');
        if (newBtn) newBtn.classList.add('show');
      }
    } else {
      // No match
      first.el.classList.add('wrong');
      cardEl.classList.add('wrong');
      const pick = container.querySelector('.match-game__pick');
      if (pick) pick.textContent = dict.matchGameNoMatch;

      setTimeout(() => {
        first.el.classList.remove('selected', 'wrong');
        cardEl.classList.remove('wrong');
        const pick = container.querySelector('.match-game__pick');
        if (pick) pick.textContent = dict.matchGamePick;
      }, 500);
      _selectedCard = null;
    }
  }
}

export function initMatchGame(container, events) {
  const dict = t9n();

  container.innerHTML = `
    <div class="game-panel-header">
      <button class="game-back-btn" data-back="match">${dict.gameBackBtn}</button>
      <button class="game-share-btn" data-tab="match">📤</button>
    </div>
    <div class="match-game__desc">${dict.matchGameDesc}</div>
    <div class="match-game__score">${dict.matchGameScore(0)}</div>
    <div class="match-game__pick">${dict.matchGamePick}</div>
    <div class="match-game__grid"></div>
    <button class="match-game__new">${dict.matchGameNew}</button>
  `;

  const shareBtn = container.querySelector('.game-share-btn');
  if (shareBtn) shareBtn.addEventListener('click', () => gameShare(shareBtn.dataset.tab));

  const backBtn = container.querySelector('.game-back-btn');
  if (backBtn) backBtn.addEventListener('click', _showCards);

  _score = 0;

  function _newRound() {
    const matchData = _findMatchYear(events);
    if (!matchData) {
      const grid = container.querySelector('.match-game__grid');
      if (grid) grid.innerHTML = `<div style="text-align:center;padding:20px;color:var(--color-text-muted);">${dict.noMatch}</div>`;
      return;
    }
    _renderCards(container, matchData);
  }

  _newRound();

  const newBtn = container.querySelector('.match-game__new');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      _score = 0;
      const scoreEl = container.querySelector('.match-game__score');
      if (scoreEl) scoreEl.textContent = dict.matchGameScore(0);
      _newRound();
    });
  }
}