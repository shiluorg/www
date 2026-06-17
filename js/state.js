import { getCurrentLang, onLangChange } from './i18n.js';

const state = {
  currentYear: 1,
  selectedDynasty: null,
  markers: [],
  activeMarker: null,
  contentYears: [],
  contentYearIndex: {},
  searchIndex: null,
  searchIndexReady: false,
  lang: getCurrentLang()
};

onLangChange((lang) => {
  state.lang = lang;
});

// ==================== THEME ====================
const _THEME_KEY = 'shilu_theme';

function themeGet() {
  const s = localStorage.getItem(_THEME_KEY);
  if (s === 'light' || s === 'dark') return s;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
}
function themeSet(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(_THEME_KEY, t); } catch (_) {}
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = t === 'dark' ? '🌙' : '☀️';
  window.dispatchEvent(new CustomEvent('shilu:themechange', { detail: t }));
}
function themeToggle() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  themeSet(cur === 'dark' ? 'light' : 'dark');
}
export function themeInit() {
  const btn = document.getElementById('theme-toggle');
  if (!btn || btn.dataset.init) return;
  btn.dataset.init = '1';
  themeSet(themeGet());
  btn.addEventListener('click', themeToggle);
}

export default state;
