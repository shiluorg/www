import HashSearch from './hash-search.js';
import state from './state.js';
import { t9n, getCurrentLang } from './i18n.js';
import { initQuizGame } from './quiz.js';

let _events = null;
let _quizInited = false;

async function _loadEvents() {
  if (_events) return _events;
  // Check search index cache first
  if (state.searchIndex && state.searchIndex._events && state.searchIndex._events.length > 7000) {
    _events = state.searchIndex._events;
    return _events;
  }
  const loading = document.getElementById('game-loading');
  if (loading) loading.classList.remove('hidden');
  try {
    _events = await HashSearch.getAllEvents();
  } catch (_) {
    _events = [];
  }
  if (loading) loading.classList.add('hidden');
  return _events;
}

export function _shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function _showCards() {
  const page = document.getElementById('page-game');
  if (page) page.classList.remove('page--game-inplay');
  document.getElementById('game-cards').classList.remove('hidden');
  document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
  const qs = new URLSearchParams({ page: 'game' });
  const lang = getCurrentLang();
  if (lang !== 'zh') qs.set('lang', lang);
  history.replaceState(null, '', '?' + qs.toString());
}

function _showGame(tab) {
  const page = document.getElementById('page-game');
  if (page) page.classList.add('page--game-inplay');
  document.getElementById('game-cards').classList.add('hidden');
  document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('game-panel-' + tab);
  if (panel) panel.classList.remove('hidden');
  const qs = new URLSearchParams({ page: 'game', tab });
  const lang = getCurrentLang();
  if (lang !== 'zh') qs.set('lang', lang);
  history.pushState(null, '', '?' + qs.toString());
}

function _initGamePanel(panel, tab, events) {
  if (panel.dataset.initialized) return;
  panel.dataset.initialized = '1';
  if (tab === 'map') {
    import('./game-map.js').then(m => m.initMapGame(panel, events));
  } else if (tab === 'sort') {
    import('./game-sort.js').then(m => m.initSortGame(panel, events));
  } else if (tab === 'match') {
    import('./game-match.js').then(m => m.initMatchGame(panel, events));
  }
}

export function gameShare(tab) {
  const dict = t9n();
  const info = dict.gameShare[tab] || dict.gameShare.quiz;
  const url = `${window.location.origin}/?page=game&tab=${tab}`;
  if (navigator.share) {
    navigator.share({ title: info.t, text: info.d, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      const toast = document.getElementById('err-toast');
      const msg = document.getElementById('err-message');
      if (msg) msg.textContent = dict.shareCardCopied || 'Copied!';
      if (toast) { toast.classList.remove('hidden'); setTimeout(() => toast.classList.add('hidden'), 2000); }
    }).catch(() => {});
  }
}

export async function initGameCenter(tab) {
  try {
    const dict = t9n();
    const page = document.getElementById('page-game');
    if (!page) return;

    const titleEl = page.querySelector('.game-center__title');
    if (titleEl) titleEl.textContent = dict.gameTitle;

    const cardMap = {
      quiz: { title: dict.gameTabQuiz, desc: dict.gameShare.quiz.d },
      map: { title: dict.gameTabMap, desc: dict.gameShare.map.d },
      sort: { title: dict.gameTabSort, desc: dict.gameShare.sort.d },
      match: { title: dict.gameTabMatch, desc: dict.gameShare.match.d }
    };
    page.querySelectorAll('.game-card').forEach(card => {
      const g = card.dataset.game;
      if (cardMap[g]) {
        const t = card.querySelector('.game-card__title');
        const d = card.querySelector('.game-card__desc');
        const a = card.querySelector('.game-card__action');
        if (t) t.textContent = cardMap[g].title;
        if (d) d.textContent = cardMap[g].desc;
        if (a) a.textContent = dict.gameAction;
      }
    });

    const quizBackBtn = page.querySelector('#game-panel-quiz .game-back-btn');
    if (quizBackBtn) quizBackBtn.textContent = dict.gameBackBtn;

    const events = await _loadEvents();

    if (!_quizInited) {
      _quizInited = true;
      initQuizGame(document.getElementById('game-panel-quiz'), events || state.searchIndex?._events);
    }

    if (tab && tab !== 'quiz') {
      _showGame(tab);
      _initGamePanel(document.getElementById('game-panel-' + tab), tab, events);
    } else if (tab === 'quiz') {
      _showGame('quiz');
    } else {
      _showCards();
    }

    if (!page.dataset.cardsInit) {
      page.dataset.cardsInit = '1';
      page.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
          const g = card.dataset.game;
          _showGame(g);
          _initGamePanel(document.getElementById('game-panel-' + g), g, events);
        });
      });

      page.querySelectorAll('.game-back-btn').forEach(btn => {
        btn.addEventListener('click', () => _showCards());
      });
    }
  } catch (e) {
    console.error('[Shilu] Game center init error:', e);
  }
}
