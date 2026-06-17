import { getCurrentLang } from './i18n.js';

const STORAGE_PREFIX = 'shilu_hs_';
const STORAGE_META = 'shilu_hs_meta';
const CACHE_VERSION = '2.1';

const BC_CHUNK_SIZE = 1000;
const CE_CHUNK_SIZE = 100;
const YEAR_PAD = 4;

let _memoryCache = new Map();
let _initialized = false;
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

async function _fetchJSON(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        if (resp.status >= 400 && resp.status < 500) {
          throw new Error(`HashSearch: HTTP ${resp.status} ${url}`);
        }
        throw new Error(`HashSearch: HTTP ${resp.status} ${url} (retry ${attempt + 1}/${retries + 1})`);
      }
      return resp.json();
    } catch (err) {
      if (attempt === retries || (err.message && err.message.includes('HTTP 4'))) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

const YEAR_MIN = -10000;
const YEAR_MAX = 1912;

const dynasties = [
  { id: 'shiqian', name: '史前', nameEn: 'Prehistoric', start: -10000, end: -3501, color: '#6a6a5a' },
  { id: 'shanggu', name: '上古', nameEn: 'Ancient', start: -3500, end: -2201, color: '#8a7a50' },
  { id: 'yu', name: '虞', nameEn: 'Yu', start: -2200, end: -2071, color: '#c4a060' },
  { id: 'xia', name: '夏', nameEn: 'Xia', start: -2070, end: -1600, color: '#d4a574' },
  { id: 'shang', name: '商', nameEn: 'Shang', start: -1600, end: -1046, color: '#c9985e' },
  { id: 'xizhou', name: '西周', nameEn: 'W. Zhou', start: -1046, end: -771, color: '#b8864e' },
  { id: 'chunqiu', name: '春秋', nameEn: 'Spring & Autumn', start: -770, end: -476, color: '#a08050' },
  { id: 'zhanguo', name: '战国', nameEn: 'Warring States', start: -475, end: -221, color: '#8a6a3c' },
  { id: 'qin', name: '秦', nameEn: 'Qin', start: -221, end: -206, color: '#c0392b' },
  { id: 'xihan', name: '西汉', nameEn: 'W. Han', start: -206, end: 8, color: '#d64545' },
  { id: 'xin', name: '新', nameEn: 'Xin', start: 9, end: 23, color: '#e0734a' },
  { id: 'gengshi', name: '更始', nameEn: 'Gengshi', start: 23, end: 25, color: '#e68a5e' },
  { id: 'donghan', name: '东汉', nameEn: 'E. Han', start: 25, end: 220, color: '#c95e3a' },
  { id: 'sanguo', name: '三国', nameEn: '3 Kingdoms', start: 220, end: 280, color: '#7d55a5' },
  { id: 'xijin', name: '西晋', nameEn: 'W. Jin', start: 265, end: 316, color: '#8e6ab3' },
  { id: 'dongjin', name: '东晋', nameEn: 'E. Jin', start: 317, end: 420, color: '#9d7ec4' },
  { id: 'nanbei', name: '南北朝', nameEn: 'S. & N. Dyn.', start: 420, end: 589, color: '#6c8ebf' },
  { id: 'sui', name: '隋', nameEn: 'Sui', start: 581, end: 618, color: '#4a90d9' },
  { id: 'tang', name: '唐', nameEn: 'Tang', start: 618, end: 907, color: '#e8a838' },
  { id: 'wuzhou', name: '武周', nameEn: 'Wu Zhou', start: 690, end: 705, color: '#d4a060' },
  { id: 'wudai', name: '五代十国', nameEn: '5 Dynasties', start: 907, end: 960, color: '#ab8b5a' },
  { id: 'liao', name: '辽', nameEn: 'Liao', start: 907, end: 1125, color: '#8b6b4a' },
  { id: 'beisong', name: '北宋', nameEn: 'N. Song', start: 960, end: 1127, color: '#5b9e5b' },
  { id: 'jin', name: '金', nameEn: 'Jin', start: 1115, end: 1234, color: '#7a9cc6' },
  { id: 'nansong', name: '南宋', nameEn: 'S. Song', start: 1127, end: 1279, color: '#6db36d' },
  { id: 'yuan', name: '元', nameEn: 'Yuan', start: 1271, end: 1368, color: '#4a7c8c' },
  { id: 'ming', name: '明', nameEn: 'Ming', start: 1368, end: 1644, color: '#c44d4d' },
  { id: 'qing', name: '清', nameEn: 'Qing', start: 1644, end: 1912, color: '#3a6a8c' }
];

const worldEras = [
  // 史前基础
  { id: 'neolithic', name: '新石器时代', nameEn: 'Neolithic', start: -10000, end: -3501, color: '#6a6a5a' },
  // 爱琴青铜文明
  { id: 'aegean', name: '爱琴青铜文明', nameEn: 'Aegean Bronze Age', start: -2700, end: -1100, color: '#aa8a5a' },
  // 古希腊
  { id: 'darkages', name: '希腊黑暗时代', nameEn: 'Greek Dark Ages', start: -1100, end: -800, color: '#7a6a4c' },
  { id: 'archaic', name: '古风希腊', nameEn: 'Archaic Greece', start: -800, end: -500, color: '#c4a060' },
  { id: 'classical', name: '古典希腊', nameEn: 'Classical Greece', start: -480, end: -338, color: '#d4a040' },
  // 马其顿与希腊化
  { id: 'macedon', name: '亚历山大帝国', nameEn: 'Alexander\'s Empire', start: -338, end: -323, color: '#b0863e' },
  { id: 'hellenistic', name: '希腊化时代', nameEn: 'Hellenistic Age', start: -323, end: -146, color: '#c4984e' },
  // 罗马
  { id: 'republic', name: '罗马共和国', nameEn: 'Roman Republic', start: -509, end: -27, color: '#c44d4d' },
  { id: 'empire', name: '罗马帝国', nameEn: 'Roman Empire', start: -27, end: 476, color: '#c44d4d' },
  // 中世纪
  { id: 'byzantine', name: '拜占庭帝国', nameEn: 'Byzantine Empire', start: 330, end: 1453, color: '#7a5a9a' },
  { id: 'frankish', name: '法兰克王国', nameEn: 'Frankish Kingdoms', start: 481, end: 843, color: '#5a7a9a' },
  { id: 'viking', name: '维京时代', nameEn: 'Viking Age', start: 793, end: 1066, color: '#3a5a7a' },
  { id: 'hre', name: '神圣罗马帝国', nameEn: 'Holy Roman Empire', start: 962, end: 1806, color: '#8a6a3c' },
  { id: 'crusades', name: '十字军东征', nameEn: 'Age of Crusades', start: 1096, end: 1291, color: '#b05040' },
  { id: 'hundred', name: '百年战争', nameEn: 'Hundred Years\' War', start: 1337, end: 1453, color: '#c44d4d' },
  // 近代早期
  { id: 'renaissance', name: '文艺复兴', nameEn: 'Renaissance', start: 1400, end: 1600, color: '#d4883c' },
  { id: 'ottoman', name: '奥斯曼在欧洲', nameEn: 'Ottoman Europe', start: 1362, end: 1683, color: '#4a7a7a' },
  { id: 'spain', name: '西班牙帝国', nameEn: 'Spanish Empire', start: 1492, end: 1898, color: '#c4a040' },
  { id: 'thirty', name: '三十年战争', nameEn: 'Thirty Years\' War', start: 1618, end: 1648, color: '#5a5a7a' },
  { id: 'enlightenment', name: '启蒙时代', nameEn: 'Age of Enlightenment', start: 1650, end: 1789, color: '#e8a838' },
  // 近代
  { id: 'russia', name: '俄罗斯帝国', nameEn: 'Russian Empire', start: 1721, end: 1912, color: '#4a4a6a' },
  { id: 'industrial', name: '工业革命', nameEn: 'Industrial Revolution', start: 1760, end: 1840, color: '#3a6a8c' },
  { id: 'revolution', name: '法国大革命', nameEn: 'French Revolution', start: 1789, end: 1799, color: '#c44d4d' },
  { id: 'napoleon', name: '拿破仑时代', nameEn: 'Napoleonic Era', start: 1799, end: 1815, color: '#8c3a3a' },
  { id: 'modern', name: '民族主义与帝国', nameEn: 'Nationalism & Empire', start: 1848, end: 1912, color: '#4a8a6a' }
];

async function _forEachFileChunk(files, fn, onChunkDone) {
  const CHUNK = 4;
  for (let i = 0; i < files.length; i += CHUNK) {
    await Promise.all(files.slice(i, i + CHUNK).map(fn));
    if (onChunkDone) onChunkDone(Math.min(CHUNK, files.length - i));
  }
}

// Convert language code to data directory prefix
function _getLangPrefix(lang) {
  return lang === 'en' ? 'en/' : 'zh/';
}

const HashSearch = {
  get VERSION() { return CACHE_VERSION; },

  get dynasties() { return dynasties; },
  get worldEras() { return worldEras; },
  get YEAR_MIN() { return YEAR_MIN; },
  get YEAR_MAX() { return YEAR_MAX; },

  init() { _init(); },

  formatYear(y, lang) {
    const l = lang || getCurrentLang();
    if (l === 'en') {
      return y < 0 ? `${Math.abs(y)} BC` : `AD ${y}`;
    }
    return y < 0 ? `公元前${Math.abs(y)}年` : `公元${y}年`;
  },

  getDataPath(year, lang) {
    const l = lang || getCurrentLang();
    const prefix = _getLangPrefix(l);
    return prefix + this.getFileName(year);
  },

  async get(url) {
    if (!_initialized) _init();
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
    if (_memoryCache.size > 100) { const first = _memoryCache.keys().next().value; _memoryCache.delete(first); }
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
      if (absYear >= BC_CHUNK_SIZE + 1 && absYear <= BC_CHUNK_SIZE * 2) return 'bc-2000-1001.json';
      if (absYear >= BC_CHUNK_SIZE * 2 + 1) return 'bc-9600-2001.json';
      const start = Math.floor((absYear - 1) / CE_CHUNK_SIZE) * CE_CHUNK_SIZE + 1;
      const end = start + CE_CHUNK_SIZE - 1;
      return `bc-${String(end).padStart(YEAR_PAD, '0')}-${String(start).padStart(YEAR_PAD, '0')}.json`;
    }
    const start = Math.floor((year - 1) / CE_CHUNK_SIZE) * CE_CHUNK_SIZE + 1;
    const end = start + CE_CHUNK_SIZE - 1;
    return `${String(start).padStart(YEAR_PAD, '0')}-${String(end).padStart(YEAR_PAD, '0')}.json`;
  },

  getAllFileNames() {
    return ['0001-0100.json','0101-0200.json','0201-0300.json','0301-0400.json','0401-0500.json','0501-0600.json','0601-0700.json','0701-0800.json','0801-0900.json','0901-1000.json','1001-1100.json','1101-1200.json','1201-1300.json','1301-1400.json','1401-1500.json','1501-1600.json','1601-1700.json','1701-1800.json','1801-1900.json','1901-2000.json','bc-0100-0001.json','bc-0200-0101.json','bc-0300-0201.json','bc-0400-0301.json','bc-0500-0401.json','bc-0600-0501.json','bc-0700-0601.json','bc-0800-0701.json','bc-0900-0801.json','bc-1000-0901.json','bc-2000-1001.json','bc-9600-2001.json'];
  },

  async getYearData(year, lang) {
    const l = lang || getCurrentLang();
    const fileName = this.getFileName(year);
    const prefix = _getLangPrefix(l);
    const fileData = await this.get(prefix + fileName);
    const entry = Array.isArray(fileData) ? fileData.find(d => d && d.y === year) : null;
    if (!entry) return { d: [], v: [] };
    return {
      d: entry.d || [],
      v: entry.v || []
    };
  },

  async preloadAll(onProgress, lang) {
    const l = lang || getCurrentLang();
    const files = this.getAllFileNames().map(f => _getLangPrefix(l) + f);
    const total = files.length;
    let loaded = 0;
    await _forEachFileChunk(files, async f => { try { await this.get(f); } catch (_) {} }, (c) => { loaded = Math.min(loaded + c, total); if (onProgress) onProgress(loaded, total); });
  },

  async getAllEvents(onProgress, lang) {
    const l = lang || getCurrentLang();
    const files = this.getAllFileNames().map(f => _getLangPrefix(l) + f);
    const total = files.length;
    let allEvents = [];
    let loaded = 0;
    await _forEachFileChunk(files, async f => { try { const d = await this.get(f); if (Array.isArray(d)) { for (const entry of d) { if (entry && entry.v) { entry.v.forEach((evt, i) => allEvents.push({ y: entry.y, _i: i, ...evt })); } } } } catch (_) {} }, (c) => { loaded += c; if (onProgress) onProgress(Math.min(loaded, total), total); });
    allEvents.sort((a, b) => a.y - b.y);
    return allEvents;
  },

  async getContentYearIndex() {
    const data = await this.get('content-years.json');
    let years;
    if (data.years_delta_rle) {
      // RLE format: [value, count, value, count, ...]
      // Pre-calculate total length
      let totalLen = 0;
      for (let i = 1; i < data.years_delta_rle.length; i += 2) {
        totalLen += data.years_delta_rle[i];
      }
      const deltas = new Array(totalLen);
      let di = 0;
      for (let i = 0; i < data.years_delta_rle.length; i += 2) {
        const val = data.years_delta_rle[i];
        const count = data.years_delta_rle[i + 1];
        for (let j = 0; j < count; j++) {
          deltas[di++] = val;
        }
      }
      years = [deltas[0]];
      for (let i = 1; i < deltas.length; i++) {
        years.push(years[years.length - 1] + deltas[i]);
      }
    } else if (data.years_delta) {
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
    if (!queryString || !Array.isArray(data)) return data || [];
    const f = fields || ['t', 'r', 's'];
    const m = mode || 'combined';
    const { exactTerms, fuzzyTerms } = this.parseQuery(queryString);

    if (m === 'exact') {
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
  },

  findNearestIndex(year, years) {
    if (!years || !years.length) return -1;
    let lo = 0, hi = years.length - 1;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (years[m] < year) lo = m + 1; else hi = m; }
    if (lo === 0) return 0;
    const p = years[lo - 1], c = years[lo];
    return (year - p) <= (c - year) ? lo - 1 : lo;
  }
};

export default HashSearch;
