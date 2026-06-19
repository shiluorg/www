import { t9n } from './i18n.js';
import { _showCards, gameShare } from './game-center.js';

let _sortEvents = [];

function _pickRandomEvents(events, count) {
  const n = Math.min(events.length, count);
  const picked = new Array(n);
  for (let i = 0; i < events.length; i++) {
    if (i < n) { picked[i] = events[i]; }
    else { const j = Math.floor(Math.random() * (i + 1)); if (j < n) picked[j] = events[i]; }
  }
  return picked.map((e, i) => ({ ...e, _i: i }));
}

function _renderList(container) {
  const list = container.querySelector('.sort-game__list');
  if (!list) return;

  list.innerHTML = _sortEvents.map((evt, i) => `
    <div class="sort-game__item" draggable="true" data-idx="${evt._i}">
      <span class="sort-game__item-order">${i + 1}</span>
      <span class="sort-game__item-text">${evt.t}</span>
      <span class="sort-game__item-desc">${(evt.s || '').substring(0, 60)}${(evt.s || '').length > 60 ? '…' : ''}</span>
    </div>
  `).join('');

  _bindDrag(list);

  const fb = container.querySelector('.sort-game__feedback');
  if (fb) { fb.className = 'sort-game__feedback'; fb.textContent = ''; }
}

function _bindDrag(list) {
  let dragSrc = null;

  const items = () => list.querySelectorAll('.sort-game__item');

  items().forEach(el => {
    el.addEventListener('dragstart', e => {
      dragSrc = el;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.idx);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      items().forEach(x => x.classList.remove('drag-over'));
      dragSrc = null;
    });

    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      items().forEach(x => x.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (dragSrc && dragSrc !== el) {
        const srcIdx = parseInt(dragSrc.dataset.idx);
        const targetIdx = parseInt(el.dataset.idx);
        const from = _sortEvents.findIndex(e => e._i === srcIdx);
        const to = _sortEvents.findIndex(e => e._i === targetIdx);
        const [moved] = _sortEvents.splice(from, 1);
        _sortEvents.splice(to, 0, moved);
        _renderList(list.closest('.game-panel'));
      }
    });
  });
}

function _checkAnswer(container) {
  const dict = t9n();
  const fb = container.querySelector('.sort-game__feedback');
  const sorted = [..._sortEvents].sort((a, b) => a.y - b.y);
  const correct = _sortEvents.filter((e, i) => e._i === sorted[i]._i).length;
  const allCorrect = correct === _sortEvents.length;

  if (fb) { fb.className = 'sort-game__feedback ' + (allCorrect ? 'correct' : 'wrong'); fb.textContent = (allCorrect ? '✓ ' : '✗ ') + (allCorrect ? dict.sortGameCorrect : dict.sortGameWrong); }
  const scoreEl = container.querySelector('.sort-game__score');
  if (scoreEl) scoreEl.textContent = dict.sortGameScore(correct, _sortEvents.length);
}

export function initSortGame(container, events) {
  const dict = t9n();

  container.innerHTML = `
    <button class="game-back-btn" data-back="sort">${dict.gameBackBtn}</button>
    <button class="game-share-btn" data-tab="sort">📤</button>
    <div class="sort-game__desc">${dict.sortGameDesc}</div>
    <div class="sort-game__tip">${dict.sortGameTip}</div>
    <div class="sort-game__list"></div>
    <div class="sort-game__feedback"></div>
    <div class="sort-game__score"></div>
    <button class="sort-game__submit">${dict.sortGameSubmit}</button>
  `;

  const shareBtn = container.querySelector('.game-share-btn');
  if (shareBtn) shareBtn.addEventListener('click', () => gameShare(shareBtn.dataset.tab));

  const backBtn = container.querySelector('.game-back-btn');
  if (backBtn) backBtn.addEventListener('click', _showCards);

  _sortEvents = _pickRandomEvents(events, 5);
  _renderList(container);

  const submitBtn = container.querySelector('.sort-game__submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      _checkAnswer(container);
      setTimeout(() => {
        _sortEvents = _pickRandomEvents(events, 5);
        _renderList(container);
        const scoreEl = container.querySelector('.sort-game__score');
        if (scoreEl) scoreEl.textContent = '';
      }, 2000);
    });
  }
}
