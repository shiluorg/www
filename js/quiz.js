import HashSearch from './hash-search.js';
import state from './state.js';

const _fmtYear = HashSearch.formatYear;

const QUIZ_LEVELS = ['炼气一层','炼气二层','炼气三层','炼气四层','炼气五层','炼气六层','炼气七层','炼气八层','炼气九层','炼气十层','炼气十一层','炼气十二层','炼气十三层','筑基初期','筑基中期','筑基后期','筑基巅峰','结丹初期','结丹中期','结丹后期','结丹巅峰','元婴初期','元婴中期','元婴后期','元婴巅峰','化神初期','化神中期','化神后期','化神巅峰','炼虚初期','炼虚中期','炼虚后期','炼虚巅峰','合体初期','合体中期','合体后期','合体巅峰','大乘初期','大乘中期','大乘后期','大乘巅峰','渡劫期','真仙初期','真仙中期','真仙后期','真仙巅峰','金仙初期','金仙中期','金仙后期','金仙巅峰','太乙仙初期','太乙仙中期','太乙仙后期','太乙仙巅峰','大罗仙初期','大罗仙中期','大罗仙后期','大罗仙巅峰','大罗仙圆满','道祖'];
const QUIZ_REALMS = [{s:0,e:12,i:'🧘',c:'#4ade80',n:'炼气'},{s:13,e:16,i:'⚔️',c:'#2dd4bf',n:'筑基'},{s:17,e:20,i:'🔮',c:'#a78bfa',n:'结丹'},{s:21,e:24,i:'👶',c:'#f472b6',n:'元婴'},{s:25,e:28,i:'🔥',c:'#fb923c',n:'化神'},{s:29,e:32,i:'🌌',c:'#38bdf8',n:'炼虚'},{s:33,e:36,i:'⛓️',c:'#fbbf24',n:'合体'},{s:37,e:40,i:'🚢',c:'#f87171',n:'大乘'},{s:41,e:41,i:'⚡',c:'#fef08a',n:'渡劫'},{s:42,e:45,i:'🕊️',c:'#67e8f9',n:'真仙'},{s:46,e:49,i:'👑',c:'#fcd34d',n:'金仙'},{s:50,e:53,i:'🌟',c:'#e879f9',n:'太乙仙'},{s:54,e:57,i:'🌙',c:'#818cf8',n:'大罗仙'},{s:58,e:58,i:'☯️',c:'#c084fc',n:'大罗仙圆满'},{s:59,e:59,i:'🐉',c:'#fbbf24',n:'道祖'}];
const QK = 'shilu_quiz_level';

let _qEvents = [], _qLevel = 0, _qCorrect = null, _qType = null, _qAnswered = false;
let _quizInitialized = false;

function _qRealm(l) { for (const r of QUIZ_REALMS) { if (l >= r.s && l <= r.e) return r; } return QUIZ_REALMS[0]; }
function _qShuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function _qUpdateUI() {
  const r = _qRealm(_qLevel), tl = QUIZ_LEVELS.length - 1, s = 24 + (_qLevel / tl) * 22, is = 28 + (_qLevel / tl) * 24;
  const icon = document.getElementById('quiz-icon'), name = document.getElementById('quiz-name'), bar = document.getElementById('quiz-bar'), pct = document.getElementById('quiz-pct');
  if (icon) { icon.textContent = r.i; icon.style.fontSize = is + 'px'; }
  if (name) { name.textContent = QUIZ_LEVELS[_qLevel]; name.style.color = r.c; name.style.fontSize = s + 'px'; }
  const p = (_qLevel / tl) * 100;
  if (bar) bar.style.width = p + '%'; if (pct) pct.textContent = Math.round(p) + '%';
}

function _qSave() { try { localStorage.setItem(QK, _qLevel); } catch (_) {} }
function _qLoad() { try { const s = localStorage.getItem(QK); if (s !== null) { const n = parseInt(s, 10); if (n >= 0 && n < QUIZ_LEVELS.length) _qLevel = n; } } catch (_) {} }

function _qGen() {
  if (_qEvents.length < 4) return;
  _qAnswered = false;
  const next = document.getElementById('quiz-next'), fb = document.getElementById('quiz-feedback');
  if (next) next.classList.remove('show'); if (fb) { fb.className = ''; }
  _qCorrect = _qEvents[Math.floor(Math.random() * _qEvents.length)];
  const useY = Math.random() < 0.5;
  const qType = document.getElementById('quiz-qtype'), qText = document.getElementById('quiz-qtext'), opts = document.getElementById('quiz-options');
  if (useY) {
    _qType = 'year';
    const ws = new Set(); ws.add(_qCorrect.y);
    while (ws.size < 4) { const re = _qEvents[Math.floor(Math.random() * _qEvents.length)]; if (re.y !== _qCorrect.y) ws.add(re.y); }
    const yo = _qShuffle([...ws]);
    if (qType) qType.textContent = '📅 年份推断';
    if (qText) qText.innerHTML = `"<span class="question-highlight">${_qCorrect.t}</span>" 发生在哪一年？`;
    if (opts) opts.innerHTML = yo.map((y, i) => `<button class="option-btn" data-value="${y}" data-correct="${y === _qCorrect.y}"><span class="opt-label">${'ABCD'[i]}.</span> ${_fmtYear(y)}</button>`).join('');
  } else {
    _qType = 'event';
    const pool = _qEvents.filter(e => e.y !== _qCorrect.y);
    const picked = _qShuffle(pool).slice(0, 3);
    const all = _qShuffle([{ title: _qCorrect.t, year: _qCorrect.y, correct: true }, ...picked.map(e => ({ title: e.t, year: e.y, correct: false }))]);
    if (qType) qType.textContent = '📖 事件匹配';
    if (qText) qText.innerHTML = `以下哪个事件发生在 <span class="question-highlight">${_fmtYear(_qCorrect.y)}</span>？`;
    if (opts) opts.innerHTML = all.map((o, i) => `<button class="option-btn" data-value="${o.title.replace(/"/g,'&quot;')}" data-correct="${o.correct}"><span class="opt-label">${'ABCD'[i]}.</span> ${o.title}</button>`).join('');
  }
  if (opts) opts.querySelectorAll('.option-btn').forEach(btn => btn.addEventListener('click', () => _qAnswer(btn)));
}

function _qAnswer(btn) {
  if (_qAnswered) return;
  _qAnswered = true;
  const isC = btn.dataset.correct === 'true';
  const opts = document.getElementById('quiz-options');
  if (opts) opts.querySelectorAll('.option-btn').forEach(b => { b.classList.add('disabled'); if (b.dataset.correct === 'true') b.classList.add('correct'); if (b === btn && !isC) b.classList.add('wrong'); if (b === btn) b.classList.add('selected'); });
  const fb = document.getElementById('quiz-feedback'), next = document.getElementById('quiz-next');
  if (isC) {
    if (fb) { fb.className = 'correct'; fb.textContent = '✓ 回答正确！修为 +1'; }
    _qLevel = Math.min(_qLevel + 1, QUIZ_LEVELS.length - 1); _qSave(); _qUpdateUI();
    const nEl = document.getElementById('quiz-name'), iEl = document.getElementById('quiz-icon');
    if (nEl) { nEl.classList.add('level-up'); setTimeout(() => nEl.classList.remove('level-up'), 500); }
    if (iEl) { iEl.classList.add('level-up'); setTimeout(() => iEl.classList.remove('level-up'), 500); }
  } else {
    const ans = _qType === 'year' ? `正确答案是 ${_fmtYear(_qCorrect.y)}` : `正确答案是「${_qCorrect.t}」（${_fmtYear(_qCorrect.y)}）`;
    if (fb) { fb.className = 'wrong'; fb.textContent = `✗ 回答错误，修为 -1。${ans}`; }
    if (_qLevel > 0) { _qLevel = Math.max(_qLevel - 1, 0); _qSave(); _qUpdateUI(); }
  }
  if (next) next.classList.add('show');
}

export async function initQuizPage() {
  _qEvents = [];
  const loading = document.getElementById('quiz-loading'), bg = document.getElementById('quiz-bg'), game = document.getElementById('quiz-game');
  const reset = document.getElementById('quiz-reset'), next = document.getElementById('quiz-next');
  if (!_quizInitialized) {
    if (next) next.addEventListener('click', _qGen);
    if (reset) reset.addEventListener('click', () => { if (confirm('确定要重置修为吗？')) { _qLevel = 0; _qSave(); _qUpdateUI(); _qGen(); } });
    _quizInitialized = true;
  }

  if (state.searchIndex && state.searchIndex._events && state.searchIndex._events.length > 7000) {
    _qEvents = state.searchIndex._events;
    if (bg) bg.classList.add('quiz__bg--visible');
    if (loading) loading.classList.add('hidden');
    if (game) game.classList.remove('hidden');
    _qLoad(); _qUpdateUI(); _qGen();
    return;
  }

  const msgs = ['正在穿越11512年的人类文明长河……','请稍候，历史的大门正在缓缓打开……','从公元前9600年的哥贝克力石阵，到公元1912年的清朝落幕……','加载中…… 这趟时空列车跨越了11512年！','请稍等，文明碎片正在聚集中……'];
  const files = HashSearch.getAllFileNames();
  const totalFiles = files.length;
  function setMsg(pct) { const idx = Math.floor(Math.random() * msgs.length); if (loading) loading.innerHTML = `<div class="spinner"></div><p>${msgs[idx]}</p>${pct != null ? `<p class="quiz__loading-stats">已加载 ${Math.round(pct)}% 的数据文件</p>` : `<p class="quiz__loading-stats">已加载 ${_qEvents.length} 个事件</p>`}`; }
  if (loading) { loading.classList.remove('hidden'); setMsg(); }
  for (let i = 0; i < files.length; i += 6) {
    const results = await Promise.all(files.slice(i, i + 6).map(async f => { try { return await HashSearch.get(f); } catch (_) { return []; } }));
    for (const data of results) { if (Array.isArray(data)) { for (const entry of data) { if (entry && entry.v) { for (const evt of entry.v) _qEvents.push({ y: entry.y, ...evt }); } } } }
    if (!game || game.classList.contains('hidden')) {
      if (_qEvents.length >= 4) { if (bg) bg.classList.add('quiz__bg--visible'); if (loading) loading.classList.add('hidden'); if (game) game.classList.remove('hidden'); _qLoad(); _qUpdateUI(); _qGen(); }
      else setMsg(Math.round(Math.min(i + 6, totalFiles) / totalFiles * 100));
    }
  }
  if (bg) bg.classList.remove('quiz__bg--visible'); if (loading) loading.classList.add('hidden');
}