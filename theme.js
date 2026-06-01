(function() {
  const STORAGE_KEY = 'shilu_theme'

  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
    return 'dark'
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch(e) {}
    const btn = document.getElementById('theme-toggle')
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️'
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark'
    setTheme(current === 'dark' ? 'light' : 'dark')
  }

  document.addEventListener('DOMContentLoaded', function() {
    setTheme(getPreferredTheme())
    const btn = document.getElementById('theme-toggle')
    if (btn) btn.addEventListener('click', toggleTheme)
  })
})()
