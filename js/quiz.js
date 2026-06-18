import HashSearch from './hash-search.js';
import state from './state.js';
import { t9n } from './i18n.js';
import { gameShare, _shuffle } from './game-center.js';

const _fmtYear = HashSearch.formatYear;

const QK = 'shilu_quiz_level';

let _qEvents = [], _qLevel = 0, _qCorrect = null, _qType = null, _qAnswered = false;
let _quizInitialized = false;
let _qContainer = null;

function _qEl(id) { return _qContainer.querySelector('#' + id); }

function _qRealm(l, realms) { for (const r of realms) { if (l >= r.s && l <= r.e) return r; } return realms[0]; }

function _qUpdateUI() {
  const dict = t9n();
  const levels = dict.quizLevels;
  const realms = dict.quizRealms;
  const r = _qRealm(_qLevel, realms), tl = levels.length - 1, s = 24 + (_qLevel / tl) * 22, is = 28 + (_qLevel / tl) * 24;
  const icon = _qEl('quiz-icon'), name = _qEl('quiz-name'), bar = _qEl('quiz-bar'), pct = _qEl('quiz-pct');
  if (icon) { icon.textContent = r.i; icon.style.fontSize = is + 'px'; }
  if (name) { name.textContent = levels[_qLevel]; name.style.color = r.c; name.style.fontSize = s + 'px'; }
  const p = (_qLevel / tl) * 100;
  if (bar) bar.style.width = p + '%'; if (pct) pct.textContent = Math.round(p) + '%';
}

function _qSave() { try { localStorage.setItem(QK, _qLevel); } catch (_) {} }
function _qLoad() { try { const s = localStorage.getItem(QK); if (s !== null) { const n = parseInt(s, 10); if (n >= 0 && n < t9n().quizLevels.length) _qLevel = n; } } catch (_) {} }

function _qGen() {
  if (_qEvents.length < 4) return;
  const dict = t9n();
  _qAnswered = false;
  const next = _qEl('quiz-next'), fb = _qEl('quiz-feedback');
  if (next) next.classList.remove('show'); if (fb) { fb.className = ''; }
  _qCorrect = _qEvents[Math.floor(Math.random() * _qEvents.length)];
  const useY = Math.random() < 0.5;
  const qType = _qEl('quiz-qtype'), qText = _qEl('quiz-qtext'), opts = _qEl('quiz-options');
  if (useY) {
    _qType = 'year';
    const ws = new Set(); ws.add(_qCorrect.y);
    while (ws.size < 4) { const re = _qEvents[Math.floor(Math.random() * _qEvents.length)]; if (re.y !== _qCorrect.y) ws.add(re.y); }
    const yo = _shuffle([...ws]);
    if (qType) qType.textContent = dict.quizTypeYear;
    if (qText) qText.innerHTML = dict.quizQTextYear(_qCorrect.t);
    if (opts) opts.innerHTML = yo.map((y, i) => `<button class="option-btn" data-value="${y}" data-correct="${y === _qCorrect.y}"><span class="opt-label">${'ABCD'[i]}.</span> ${_fmtYear(y)}</button>`).join('');
  } else {
    _qType = 'event';
    const pool = _qEvents.filter(e => e.y !== _qCorrect.y);
    const picked = _shuffle(pool).slice(0, 3);
    const all = _shuffle([{ title: _qCorrect.t, year: _qCorrect.y, correct: true }, ...picked.map(e => ({ title: e.t, year: e.y, correct: false }))]);
    if (qType) qType.textContent = dict.quizTypeEvent;
    if (qText) qText.innerHTML = dict.quizQTextEvent(_fmtYear(_qCorrect.y));
    if (opts) opts.innerHTML = all.map((o, i) => `<button class="option-btn" data-value="${o.title.replace(/"/g,'&quot;')}" data-correct="${o.correct}"><span class="opt-label">${'ABCD'[i]}.</span> ${o.title}</button>`).join('');
  }
  if (opts) opts.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', () => _qAnswer(btn)));
}

function _qAnswer(btn) {
  if (_qAnswered) return;
  const dict = t9n();
  _qAnswered = true;
  const isC = btn.dataset.correct === 'true';
  const opts = _qEl('quiz-options');
  if (opts) opts.querySelectorAll('.option-btn').forEach(b => { b.classList.add('disabled'); if (b.dataset.correct === 'true') b.classList.add('correct'); if (b === btn && !isC) b.classList.add('wrong'); if (b === btn) b.classList.add('selected'); });
  const fb = _qEl('quiz-feedback'), next = _qEl('quiz-next');
  if (isC) {
    if (fb) { fb.className = 'correct'; fb.textContent = dict.quizCorrect; }
    _qLevel = Math.min(_qLevel + 1, dict.quizLevels.length - 1); _qSave(); _qUpdateUI();
    const nEl = _qEl('quiz-name'), iEl = _qEl('quiz-icon');
    if (nEl) { nEl.classList.add('level-up'); setTimeout(() => nEl.classList.remove('level-up'), 500); }
    if (iEl) { iEl.classList.add('level-up'); setTimeout(() => iEl.classList.remove('level-up'), 500); }
  } else {
    const ans = _qType === 'year' ? dict.quizCorrectYear(_fmtYear(_qCorrect.y)) : dict.quizCorrectEvent(_qCorrect.t, _fmtYear(_qCorrect.y));
    if (fb) { fb.className = 'wrong'; fb.textContent = dict.quizWrong(ans); }
    if (_qLevel > 0) { _qLevel = Math.max(_qLevel - 1, 0); _qSave(); _qUpdateUI(); }
  }
  if (next) next.classList.add('show');
}

export async function initQuizGame(container, existingEvents) {
  _qContainer = container;
  const dict = t9n();
  const loading = _qEl('quiz-loading'), game = _qEl('quiz-game');
  const reset = _qEl('quiz-reset'), next = _qEl('quiz-next');
  if (!_quizInitialized) {
    if (next) next.addEventListener('click', _qGen);
    if (reset) reset.addEventListener('click', () => { if (confirm(dict.quizResetConfirm)) { _qLevel = 0; _qSave(); _qUpdateUI(); _qGen(); } });
    const shareBtn = container?.querySelector('.game-share-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => gameShare(shareBtn.dataset.tab));
    _quizInitialized = true;
  }

  _qEvents = existingEvents || state.searchIndex?._events || [];

  if (_qEvents.length > 7000) {
    if (loading) loading.classList.add('hidden');
    if (game) game.classList.remove('hidden');
    _qLoad(); _qUpdateUI(); _qGen();
    return;
  }

  _qEvents = [];
  const msgs = dict.quizLoadingMsgs;
  const totalFiles = HashSearch.getAllFileNames().length;
  function setMsg(pct) { const idx = Math.floor(Math.random() * msgs.length); if (loading) loading.innerHTML = `<div class="spinner"></div><p>${msgs[idx]}</p><span style="font-size:11px;color:var(--color-text-muted);display:block;margin-top:4px;">${pct != null ? dict.quizLoadingStats(pct) : dict.quizLoadingCount(_qEvents.length)}</span>`; }
  if (loading) { loading.classList.remove('hidden'); setMsg(); }
  _qEvents = await HashSearch.getAllEvents((loaded, total) => {
    setMsg(Math.round(loaded / total * 100));
  });
  if (loading) loading.classList.add('hidden');
  if (game) game.classList.remove('hidden');
  _qLoad(); _qUpdateUI(); _qGen();
}