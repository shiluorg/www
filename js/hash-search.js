const STORAGE_PREFIX = 'shilu_hs_';
const STORAGE_META = 'shilu_hs_meta';
const CACHE_VERSION = '2.0';

const BC_CHUNK_SIZE = 1000;
const CE_CHUNK_SIZE = 100;
const YEAR_PAD = 4;

let _memoryCache = new Map();
let _initialized = false;
let _allFileNames = null;
let _storageAvailable = true;

function _init() {
  if (_initialized) return;
  if (_storageAvailable) {
    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_META) || '{}');
      if (meta.version !== CACHE_VERSION) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
        }
      }
      localStorage.setItem(STORAGE_META, JSON.stringify({ version: CACHE_VERSION }));
    } catch (_) {
      _storageAvailable = false;
    }
  }
  _initialized = true;
}

function _cacheKey(url) { return STORAGE_PREFIX + url; }

async function _fetchJSON(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        if (resp.status >= 400 && resp.status < 500) {
          // Client error - don't retry
          throw new Error(`HashSearch: HTTP ${resp.status} ${url}`);
        }
        // Server error - retry
        throw new Error(`HashSearch: HTTP ${resp.status} ${url} (retry ${attempt + 1}/${retries + 1})`);
      }
      return resp.json();
    } catch (err) {
      if (attempt === retries || (err.message && err.message.includes('HTTP 4'))) {
        throw err;
      }
      // Wait with exponential backoff before retry
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

const YEAR_MIN = -10000;
const YEAR_MAX = 1912;

const dynasties = [
  { id: 'shiqian', name: '史前', start: -10000, end: -3501, color: '#6a6a5a' },
  { id: 'shanggu', name: '上古', start: -3500, end: -2201, color: '#8a7a50' },
  { id: 'yu', name: '虞', start: -2200, end: -2071, color: '#c4a060' },
  { id: 'xia', name: '夏', start: -2070, end: -1600, color: '#d4a574' },
  { id: 'shang', name: '商', start: -1600, end: -1046, color: '#c9985e' },
  { id: 'xizhou', name: '西周', start: -1046, end: -771, color: '#b8864e' },
  { id: 'chunqiu', name: '春秋', start: -770, end: -476, color: '#a08050' },
  { id: 'zhanguo', name: '战国', start: -475, end: -221, color: '#8a6a3c' },
  { id: 'qin', name: '秦', start: -221, end: -206, color: '#c0392b' },
  { id: 'xihan', name: '西汉', start: -206, end: 8, color: '#d64545' },
  { id: 'xin', name: '新', start: 9, end: 23, color: '#e0734a' },
  { id: 'gengshi', name: '更始', start: 23, end: 25, color: '#e68a5e' },
  { id: 'donghan', name: '东汉', start: 25, end: 220, color: '#c95e3a' },
  { id: 'sanguo', name: '三国', start: 220, end: 280, color: '#7d55a5' },
  { id: 'xijin', name: '西晋', start: 265, end: 316, color: '#8e6ab3' },
  { id: 'dongjin', name: '东晋', start: 317, end: 420, color: '#9d7ec4' },
  { id: 'nanbei', name: '南北朝', start: 420, end: 589, color: '#6c8ebf' },
  { id: 'sui', name: '隋', start: 581, end: 618, color: '#4a90d9' },
  { id: 'tang', name: '唐', start: 618, end: 907, color: '#e8a838' },
  { id: 'wuzhou', name: '武周', start: 690, end: 705, color: '#d4a060' },
  { id: 'wudai', name: '五代十国', start: 907, end: 960, color: '#ab8b5a' },
  { id: 'liao', name: '辽', start: 907, end: 1125, color: '#8b6b4a' },
  { id: 'beisong', name: '北宋', start: 960, end: 1127, color: '#5b9e5b' },
  { id: 'jin', name: '金', start: 1115, end: 1234, color: '#7a9cc6' },
  { id: 'nansong', name: '南宋', start: 1127, end: 1279, color: '#6db36d' },
  { id: 'yuan', name: '元', start: 1271, end: 1368, color: '#4a7c8c' },
  { id: 'ming', name: '明', start: 1368, end: 1644, color: '#c44d4d' },
  { id: 'qing', name: '清', start: 1644, end: 1912, color: '#3a6a8c' }
];

async function _forEachFileChunk(files, fn, onChunkDone) {
  const CHUNK = 4;
  for (let i = 0; i < files.length; i += CHUNK) {
    await Promise.all(files.slice(i, i + CHUNK).map(fn));
    if (onChunkDone) onChunkDone(Math.min(CHUNK, files.length - i));
  }
}

const HashSearch = {
  get VERSION() { return CACHE_VERSION; },

  get dynasties() { return dynasties; },
  get YEAR_MIN() { return YEAR_MIN; },
  get YEAR_MAX() { return YEAR_MAX; },

  init() { _init(); },

  formatYear(y) {
    if (y < 0) return `公元前${Math.abs(y)}年`;
    return `公元${y}年`;
  },

  async get(url) {
    _init();
    const mc = _memoryCache.get(url);
    if (mc !== undefined) return mc;
    if (_storageAvailable) {
      try {
        const stored = localStorage.getItem(_cacheKey(url));
        if (stored) {
          const data = JSON.parse(stored);
          _memoryCache.set(url, data);
          return data;
        }
      } catch (_) {
        _storageAvailable = false;
      }
    }
    const data = await _fetchJSON(url);
    _memoryCache.set(url, data);
    if (_storageAvailable) {
      try { localStorage.setItem(_cacheKey(url), JSON.stringify(data)); } catch (_) { _storageAvailable = false; }
    }
    return data;
  },

  getCached(url) {
    return _memoryCache.get(url) || null;
  },

  getFileName(year) {
    if (year < 0) {
      const absYear = Math.abs(year);
      if (absYear >= BC_CHUNK_SIZE + 1 && absYear <= BC_CHUNK_SIZE * 2) return 'data/bc-2000-1001.json';
      if (absYear >= BC_CHUNK_SIZE * 2 + 1) return 'data/bc-9600-2001.json';
      const start = Math.floor((absYear - 1) / CE_CHUNK_SIZE) * CE_CHUNK_SIZE + 1;
      const end = start + CE_CHUNK_SIZE - 1;
      return `data/bc-${String(end).padStart(YEAR_PAD, '0')}-${String(start).padStart(YEAR_PAD, '0')}.json`;
    }
    const start = Math.floor((year - 1) / CE_CHUNK_SIZE) * CE_CHUNK_SIZE + 1;
    const end = start + CE_CHUNK_SIZE - 1;
    return `data/${String(start).padStart(YEAR_PAD, '0')}-${String(end).padStart(YEAR_PAD, '0')}.json`;
  },

  getAllFileNames() {
    if (_allFileNames) return _allFileNames;
    const files = new Set();
    for (let year = 1; year <= 1912; year += 100) files.add(this.getFileName(year));
    for (let year = -100; year >= -1000; year -= 100) files.add(this.getFileName(year));
    files.add('data/bc-2000-1001.json');
    files.add('data/bc-9600-2001.json');
    _allFileNames = [...files];
    return _allFileNames;
  },

  async getYearData(year) {
    const fileName = this.getFileName(year);
    const fileData = await this.get(fileName);
    const entry = Array.isArray(fileData) ? fileData.find(d => d && d.y === year) : null;
    if (!entry) return { d: [], v: [] };
    return {
      d: entry.d || [],
      v: entry.v || []
    };
  },

  async preloadAll(onProgress) {
    const files = this.getAllFileNames();
    const total = files.length;
    let loaded = 0;
    await _forEachFileChunk(files, async f => { try { await this.get(f); } catch (_) {} }, (c) => { loaded += c; if (onProgress) onProgress(loaded, total); });
  },

  async getAllEvents(onProgress) {
    const files = this.getAllFileNames();
    const total = files.length;
    let allEvents = [];
    let loaded = 0;
    await _forEachFileChunk(files, async f => { try { const d = await this.get(f); if (Array.isArray(d)) { for (const entry of d) { if (entry && entry.v) { for (const evt of entry.v) allEvents.push({ y: entry.y, ...evt }); } } } } catch (_) {} }, (c) => { loaded += c; if (onProgress) onProgress(Math.min(loaded, total), total); });
    allEvents.sort((a, b) => a.y - b.y);
    return allEvents;
  },

  async getContentYearIndex() {
    const data = await this.get('data/content-years.json');
    let years;
    if (data.years_delta) {
      years = [data.years_delta[0]];
      for (let i = 1; i < data.years_delta.length; i++) {
        years.push(years[years.length - 1] + data.years_delta[i]);
      }
    } else {
      years = data.years || [];
    }
    return {
      years: years,
      yearIndex: years.length ? Object.fromEntries(years.map((y, i) => [y, i])) : {}
    };
  },

  parseQuery(queryString) {
    const q = (queryString || '').trim();
    if (!q) return { exactTerms: [], fuzzyTerms: [] };
    const exactMatches = q.match(/"([^"]+)"/g) || [];
    const exactTerms = exactMatches.map(s => s.replace(/"/g, '').toLowerCase());
    const remaining = q.replace(/"([^"]+)"/g, '').trim();
    const fuzzyTerms = remaining ? remaining.split(/\s+/).filter(Boolean).map(s => s.toLowerCase()) : [];
    return { exactTerms, fuzzyTerms };
  },

  search(data, queryString, fields, mode) {
    // mode: 'exact' | 'fuzzy' | 'combined' (default: 'combined' for backward compat)
    if (!queryString || !Array.isArray(data)) return data || [];
    const f = fields || ['t', 'r', 's'];
    const m = mode || 'combined';
    const { exactTerms, fuzzyTerms } = this.parseQuery(queryString);

    if (m === 'exact') {
      // All exact terms must match (AND). If no exact terms, use fuzzy as exact
      const terms = exactTerms.length > 0 ? exactTerms : fuzzyTerms;
      if (terms.length === 0) return data;
      return data.filter(item => {
        for (const term of terms) {
          let found = false;
          for (const field of f) {
            if (((item[field] || '')).toLowerCase().includes(term)) { found = true; break; }
          }
          if (!found) return false;
        }
        return true;
      });
    }

    if (m === 'fuzzy') {
      // Any fuzzy term matches (OR)
      const terms = fuzzyTerms.length > 0 ? fuzzyTerms : exactTerms;
      if (terms.length === 0) return data;
      return data.filter(item => {
        for (const term of terms) {
          for (const field of f) {
            if (((item[field] || '')).toLowerCase().includes(term)) return true;
          }
        }
        return false;
      });
    }

    // 'combined' mode (default, existing behavior)
    if (exactTerms.length === 0 && fuzzyTerms.length === 0) return data;
    return data.filter(item => {
      for (const term of exactTerms) {
        let found = false;
        for (const field of f) {
          if (((item[field] || '')).toLowerCase().includes(term)) { found = true; break; }
        }
        if (!found) return false;
      }
      if (fuzzyTerms.length > 0) {
        for (const term of fuzzyTerms) {
          for (const field of f) {
            if (((item[field] || '')).toLowerCase().includes(term)) return true;
          }
        }
        return false;
      }
      return true;
    });
  }
};

export default HashSearch;
