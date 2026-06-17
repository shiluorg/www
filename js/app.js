import { handleRoute } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  handleRoute();
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
window.addEventListener('popstate', handleRoute);
