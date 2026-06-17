import state from './state.js';
import { t9n } from './i18n.js';
import { _showCards, _shuffle, gameShare } from './game-center.js';

let _matchCards = [];
let _selectedCard = null;
let _matchedCount = 0;
let _score = 0;

function _isChinese(evt) {
  return evt.o === '亚洲' || (evt.o && evt.o.toLowerCase().includes('asia'));
}

function _findMatchYear(events) {
  // Group events by year
  const byYear = {};
  for (const evt of events) {
    if (!byYear[evt.y]) byYear[evt.y] = { chinese: [], foreign: [] };
    if (_isChinese(evt)) {
      byYear[evt.y].chinese.push(evt);
    } else {
      byYear[evt.y].foreign.push(evt);
    }
  }

  // Find years with at least 2 Chinese and 2 foreign events
  const validYears = Object.keys(byYear).filter(y => byYear[y].chinese.length >= 2 && byYear[y].foreign.length >= 2);
  if (validYears.length === 0) return null;

  const year = validYears[Math.floor(Math.random() * validYears.length)];
  const chinese = _shuffle(byYear[year].chinese).slice(0, 2);
  const foreign = _shuffle(byYear[year].foreign).slice(0, 2);
  return { year: parseInt(year), chinese, foreign };
}

function _renderCards(container, matchData) {
  const dict = t9n();
  const grid = container.querySelector('.match-game__grid');
  if (!grid) return;

  _matchCards = _shuffle([
    ...matchData.chinese.map(e => ({ ...e, tag: _isChinese(e) ? '中' : '外', year: matchData.year })),
    ...matchData.foreign.map(e => ({ ...e, tag: '外', year: matchData.year }))
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
    if (first.card.year === card.year) {
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
    <div class="game-footer">${dict.footerPrefix}<span>${state.searchIndex?._events?.length || 7275}</span>${dict.footerSuffix}</div>
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
      if (grid) grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--color-text-muted);">No matching events found</div>';
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