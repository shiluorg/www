import './hash-search.js';
import './state.js';
import { handleRoute } from './router.js';

document.addEventListener('DOMContentLoaded', handleRoute);
window.addEventListener('popstate', handleRoute);
