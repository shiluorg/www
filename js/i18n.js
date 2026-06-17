const _lang = {
  _current: null,
  _listeners: new Set()
};

const ZH = 'zh', EN = 'en';

const LOCALE = {
  [ZH]: {
    name: '中文',
    short: '中',
    dir: 'ltr',
    formatYear: (y) => y < 0 ? `公元前${Math.abs(y)}年` : `公元${y}年`,
    dynastyTooltip: (name, start, end) => `${name}（${_fmtYear(start)} ~ ${_fmtYear(end)}）`,
    // HTML / meta
    htmlTitle: '实录：跨越11512年的人类文明历史年表 shilu.org',
    htmlDescription: '实录是一部交互式地球文明年表，覆盖公元前9600年至公元1912年间的重大历史事件。按年份浏览政治、军事、文化、科技等领域的重要时刻，配合地图直观呈现，跨越11512年人类文明史。',
    htmlKeywords: '历史年表,世界历史,中国历史,文明年表,交互式地图,shilu,实录,人类文明史,编年史,公元前,公元,朝代,大事件',
    ogTitle: '实录 shilu.org - 地球硅基文明年表：人类群星闪耀时',
    ogDescription: '跨越11512年的人类文明年表，从哥贝克力石阵到清朝灭亡。交互式地图展示全球历史事件，按年份浏览政治、军事、文化、科技的重要时刻。',
    ogLocale: 'zh_CN',
    siteName: '实录 shilu.org',
    // Header
    homeLink: '📜实录',
    navEvents: '全站事件列表',
    navGames: '趣味历史游戏',
    searchTitle: '搜索事件',
    themeTitle: '明暗切换',
    shortcutTitle: '键盘快捷键',
    // Search panel
    searchPlaceholder: '搜索事件标题、地区、描述（至少2个汉字）',
    clearTitle: '清除',
    modeCombined: '组合',
    modeExact: '精确',
    modeFuzzy: '模糊',
    // Timeline ARIA
    dynastyAria: '朝代时间轴，展示从史前到清朝的28个朝代持续时间',
    calendarAria: '日历时间轴，展示当前年份在有数据年份中的位置',
    // Map
    mapEmpty: '该年份暂无记录事件',
    layerSatellite: '卫星',
    layerStreet: '街道',
    layerHistoric: '历史',
    // Event detail panel
    detailTitle: '事件详情',
    backLink: '← 返回',
    disclaimer: '⚠️免责声明：内容源自互联网公开信息整理，不保证准确完整，仅供科普参考，不构成任何建议。',
    fallbackCategory: '历史事件',
    fallbackContinent: '其他',
    fallbackRegion: '其他',
    noDescription: '暂无描述',
    // Events page
    eventsLoading: '加载全站事件数据中...',
    filterPlaceholder: '筛选事件标题、地区、描述...',
    filterLabel: '分类',
    filterAll: '全部',
    eventsCount: (total, shown) => `共 ${total} 条记录，显示 ${shown} 条`,
    noMatch: '未找到匹配事件',
    pageLoading: '加载中...',
    // Detail page
    detailLoading: '加载中...',
    eventNotFound: '未找到该事件',
    dynastySection: '所属朝代',
    // Quiz page
    quizLoading: '加载全站事件数据中...',
    quizLevelTitle: '当前修为',
    quizNext: '下一题',
    quizReset: '重置修为',
    quizResetConfirm: '确定要重置修为吗？',
    quizTypeYear: '📅 年份推断',
    quizTypeEvent: '📖 事件匹配',
    quizQTextYear: (evt) => `"<span class="question-highlight">${evt}</span>" 发生在哪一年？`,
    quizQTextEvent: (year) => `以下哪个事件发生在 <span class="question-highlight">${year}</span>？`,
    quizCorrect: '✓ 回答正确！修为 +1',
    quizWrong: (correct) => `✗ 回答错误，修为 -1。${correct}`,
    quizCorrectYear: (year) => `正确答案是 ${year}`,
    quizCorrectEvent: (title, year) => `正确答案是「${title}」（${year}）`,
    quizLoadingMsgs: [
      '正在穿越11512年的人类文明长河……',
      '请稍候，历史的大门正在缓缓打开……',
      '从公元前9600年的哥贝克力石阵，到公元1912年的清朝落幕……',
      '加载中…… 这趟时空列车跨越了11512年！',
      '请稍等，文明碎片正在聚集中……'
    ],
    quizLoadingStats: (pct) => `已加载 ${Math.round(pct)}% 的数据文件`,
    quizLoadingCount: (count) => `已加载 ${count} 个事件`,
    // Game Center
    gameTitle: '趣味历史游戏',
    gameBackBtn: '← 返回',
    gameAction: '开始游戏 →',
    gameShare: {
      quiz:  { t: '历史问答', d: '答对年份/事件一路飞升，从炼气到道祖，挑战你的历史知识库！' },
      map:   { t: '地图定位', d: '给你一个历史事件，在世界地图上盲猜位置！越接近得分越高🌍' },
      sort:  { t: '时间排序', d: '打乱的历史事件等你重新排列！拖动排序，测测你的历史时间感⏳' },
      match: { t: '同期匹配', d: '同一时间地球两端在发生什么？把中外同期事件配对，发现历史的奇妙共振🔗' }
    },
    gameTabQuiz: '历史问答',
    gameTabMap: '地图定位',
    gameTabSort: '时间排序',
    gameTabMatch: '同期匹配',
    mapGameQuestion: (evt) => `"${evt}" 发生在哪里？请在地图上点击`,
    mapGameScore: (score) => `得分: ${score} 分`,
    mapGameNext: '下一题',
    mapGameTotal: (total) => `累计: ${total} 分`,
    mapGameCorrect: '正确位置',
    mapGameYour: '你的选择',
    mapGameDistance: (km) => `距离 ${km} km`,
    sortGameDesc: '将事件按时间顺序拖拽排列',
    sortGameSubmit: '提交排序',
    sortGameScore: (score, total) => `${score} / ${total} 正确`,
    sortGameCorrect: '正确！',
    sortGameWrong: '再想想，时间顺序不对哦',
    sortGameTip: '从早到晚排列',
    matchGameDesc: '找出同一时期发生的中外事件',
    matchGameScore: (score) => `得分: ${score}`,
    matchGameMatch: '匹配正确！',
    matchGameNoMatch: '不是同一时期，再试试',
    matchGameDone: '全部匹配完成！',
    matchGameNew: '新一题',
    matchGamePick: '点击两个事件进行配对',
    // Search
    indexNotReady: '索引未就绪',
    searchNoResult: '未找到匹配事件',
    searchBuilding: '索引构建中…',
    searchResultCount: (n, capped) => `找到 ${n} 条结果${capped ? '（显示前100条）' : ''}`,
    // Year prompt
    yearPrompt: '请输入年份：\n公元前输入负数，公元直接输入数字',
    yearZeroError: '公元0年不存在',
    yearOutOfRange: '年份超出范围',
    // Data error
    dataLoadError: '数据加载失败',
    loadFailed: '加载失败',
    retry: '重试',
    // Page titles
    pageTitle: {
      home: '实录：跨越11512年的人类文明历史年表 shilu.org',
      events: '全站事件列表 - 实录 shilu.org',
      map: '历史地图 - 实录 shilu.org',
      detail: '事件详情 - 实录 shilu.org',
      quiz: '历史趣味问答 - 实录 shilu.org',
      game: '趣味历史游戏 - 实录 shilu.org'
    },
    pageDescription: {
      home: '跨越11512年的交互式地球文明年表，覆盖公元前9600年至公元1912年的重大历史事件。按年份浏览政治、军事、文化、科技等领域的重要时刻，配合地图直观呈现。',
      events: '浏览实录全站所有历史事件，按分类筛选，搜索任意年份、地区、关键词。',
      map: '在地图上查看全球历史事件的时空分布，从安纳托利亚到印度河流域，纵览人类文明足迹。',
      quiz: '通过趣味问答测试历史知识，包含朝代、年份、事件等多种题型。逐步提升修为等级。',
      game: '玩历史游戏：地图定位答题、时间排序闯关、同期事件匹配。测试你的世界历史知识。'
    },
    // Quiz levels (59 levels)
    quizLevels: [
      '炼气一层','炼气二层','炼气三层','炼气四层','炼气五层','炼气六层','炼气七层','炼气八层','炼气九层','炼气十层',
      '炼气十一层','炼气十二层','炼气十三层','筑基初期','筑基中期','筑基后期','筑基巅峰','结丹初期','结丹中期','结丹后期',
      '结丹巅峰','元婴初期','元婴中期','元婴后期','元婴巅峰','化神初期','化神中期','化神后期','化神巅峰','炼虚初期',
      '炼虚中期','炼虚后期','炼虚巅峰','合体初期','合体中期','合体后期','合体巅峰','大乘初期','大乘中期','大乘后期',
      '大乘巅峰','渡劫期','真仙初期','真仙中期','真仙后期','真仙巅峰','金仙初期','金仙中期','金仙后期','金仙巅峰',
      '太乙仙初期','太乙仙中期','太乙仙后期','太乙仙巅峰','大罗仙初期','大罗仙中期','大罗仙后期','大罗仙巅峰','大罗仙圆满','道祖'
    ],
    quizRealms: [
      {s:0,e:12,i:'🧘',n:'炼气'},{s:13,e:16,i:'⚔️',n:'筑基'},{s:17,e:20,i:'🔮',n:'结丹'},{s:21,e:24,i:'👶',n:'元婴'},
      {s:25,e:28,i:'🔥',n:'化神'},{s:29,e:32,i:'🌌',n:'炼虚'},{s:33,e:36,i:'⛓️',n:'合体'},{s:37,e:40,i:'🚢',n:'大乘'},
      {s:41,e:41,i:'⚡',n:'渡劫'},{s:42,e:45,i:'🕊️',n:'真仙'},{s:46,e:49,i:'👑',n:'金仙'},{s:50,e:53,i:'🌟',n:'太乙仙'},
      {s:54,e:57,i:'🌙',n:'大罗仙'},{s:58,e:58,i:'☯️',n:'大罗仙圆满'},{s:59,e:59,i:'🐉',n:'道祖'}
    ],
    // Keyboard shortcuts
    shortcutTitle: '键盘快捷键',
    shortcuts: [
      { keys: ['←','→'], desc: '切换年份' },
      { keys: ['Shift + ←','Shift + →'], desc: '快进/快退10年' },
      { keys: ['/','Ctrl+F'], desc: '搜索事件' }
    ],
    // NoScript
    noscript: {
      heading: '📜 实录 shilu.org',
      desc: '跨越11512年的人类文明历史年表 — 交互式地球文明年表，覆盖公元前9600年至公元1912年间的重大历史事件。',
      warning: '⚠️ 您的浏览器未启用 JavaScript。本站为交互式应用，建议启用 JavaScript 以获得完整体验。您仍可浏览以下基本内容：',
      navTitle: '导航',
      jumpTitle: '快速跳转年份'
    },
    // Footer
    footerPrefix: '© 2026 实录 shilu.org 地球硅基文明的',
    footerSuffix: '个闪耀时刻',
    // Continent order
    continentOrder: ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '美洲', '南极洲', '世界', '全球', '其他'],
    // Misc
    langSwitchLabel: 'English',
    // Share card
    shareLabel: '📤 分享',
    shareTitle: '分享卡片',
    shareCardTitle: '分享卡片',
    shareCardDownload: '下载 PNG',
    shareCardCopy: '复制图片',
    shareCardCopied: '已复制!'
  },

  [EN]: {
    name: 'English',
    short: 'EN',
    dir: 'ltr',
    formatYear: (y) => y < 0 ? `${Math.abs(y)} BC` : `AD ${y}`,
    dynastyTooltip: (name, start, end) => `${name} (${_fmtYear(start)} ~ ${_fmtYear(end)})`,
    // HTML / meta
    htmlTitle: 'Shilu: A 11,512-Year Chronicle of Human Civilization - Shilu.org',
    htmlDescription: 'Shilu is an interactive Earth civilization timeline covering major historical events from 9600 BC to AD 1912. Browse political, military, cultural, and technological milestones by year with an integrated map.',
    htmlKeywords: 'historical timeline,world history,Chinese history,civilization timeline,interactive map,shilu,实录,human civilization,chronicle,BC,AD,dynasties,major events',
    ogTitle: 'Shilu - Earth Silicon Civilization Timeline: Where Great Minds Shine',
    ogDescription: 'An 11,512-year human civilization timeline from Göbekli Tepe to the fall of the Qing Dynasty. Interactive map showcasing global historical events by year across politics, military, culture, and technology.',
    ogLocale: 'en_US',
    siteName: 'Shilu',
    // Header
    homeLink: '📜Shilu',
    navEvents: 'All Events',
    navGames: 'History Games',
    searchTitle: 'Search Events',
    themeTitle: 'Toggle Theme',
    shortcutTitle: 'Keyboard Shortcuts',
    // Search panel
    searchPlaceholder: 'Search event titles, regions, descriptions (min 2 chars)',
    clearTitle: 'Clear',
    modeCombined: 'Combined',
    modeExact: 'Exact',
    modeFuzzy: 'Fuzzy',
    // Timeline ARIA
    dynastyAria: 'European civilization timeline covering 25 key periods from Neolithic to Nationalism & Empire, showing the evolution of Greece, Rome, Byzantium, and modern European powers',
    calendarAria: 'Calendar timeline showing current year position among years with data',
    // Map
    mapEmpty: 'No events recorded for this year',
    layerSatellite: 'Satellite',
    layerStreet: 'Street',
    layerHistoric: 'Historical',
    // Event detail panel
    detailTitle: 'Event Details',
    backLink: '← Back',
    disclaimer: '⚠️Disclaimer: Content compiled from publicly available sources. Accuracy and completeness are not guaranteed. For reference only.',
    fallbackCategory: 'Historical Event',
    fallbackContinent: 'Other',
    fallbackRegion: 'Other',
    noDescription: 'No description available',
    // Events page
    eventsLoading: 'Loading all event data...',
    filterPlaceholder: 'Filter events by title, region, description...',
    filterLabel: 'Category',
    filterAll: 'All',
    eventsCount: (total, shown) => `${total} records total, ${shown} shown`,
    noMatch: 'No matching events found',
    pageLoading: 'Loading...',
    // Detail page
    detailLoading: 'Loading...',
    eventNotFound: 'Event not found',
    dynastySection: 'Historical Era',
    // Quiz page
    quizLoading: 'Loading all event data...',
    quizLevelTitle: 'Current Level',
    quizNext: 'Next Question',
    quizReset: 'Reset Level',
    quizResetConfirm: 'Are you sure you want to reset your level?',
    quizTypeYear: '📅 Year Quiz',
    quizTypeEvent: '📖 Event Match',
    quizQTextYear: (evt) => `In which year did "<span class="question-highlight">${evt}</span>" occur?`,
    quizQTextEvent: (year) => `Which event occurred in <span class="question-highlight">${year}</span>?`,
    quizCorrect: '✓ Correct! Level +1',
    quizWrong: (correct) => `✗ Wrong! Level -1. ${correct}`,
    quizCorrectYear: (year) => `The correct answer is ${year}`,
    quizCorrectEvent: (title, year) => `The correct answer is "${title}" (${year})`,
    quizLoadingMsgs: [
      'Traveling through 11,512 years of human civilization...',
      'Please wait, the gates of history are opening...',
      'From Göbekli Tepe (9600 BC) to the fall of the Qing Dynasty (1912 AD)...',
      'Loading... This time-travel train spans 11,512 years!',
      'Please wait, civilization fragments are assembling...'
    ],
    quizLoadingStats: (pct) => `Loaded ${Math.round(pct)}% of data files`,
    quizLoadingCount: (count) => `Loaded ${count} events`,
    // Game Center
    gameTitle: 'History Games',
    gameBackBtn: '← Back',
    gameAction: 'Play →',
    gameShare: {
      quiz:  { t: 'History Quiz', d: 'Test your history IQ! Answer year/event questions and level up from Qi Refining to Dao Ancestor 🧠' },
      map:   { t: 'Map Locator', d: 'Guess locations on a world map blind! Given an event, drop a pin and score points based on distance 🌍' },
      sort:  { t: 'Timeline Sort', d: 'Scrambled events need sorting! Drag & drop to rearrange them in the right order ⏳' },
      match: { t: 'Period Match', d: 'What happened on opposite sides of the world at the same time? Pair events across cultures 🔗' }
    },
    gameTabQuiz: 'History Quiz',
    gameTabMap: 'Map Locator',
    gameTabSort: 'Timeline Sort',
    gameTabMatch: 'Period Match',
    mapGameQuestion: (evt) => `Where did "${evt}" happen? Click on the map`,
    mapGameScore: (score) => `Score: ${score}`,
    mapGameNext: 'Next',
    mapGameTotal: (total) => `Total: ${total}`,
    mapGameCorrect: 'Correct Location',
    mapGameYour: 'Your Guess',
    mapGameDistance: (km) => `${km} km away`,
    sortGameDesc: 'Drag events to arrange them in chronological order',
    sortGameSubmit: 'Submit',
    sortGameScore: (score, total) => `${score} / ${total} correct`,
    sortGameCorrect: 'Correct!',
    sortGameWrong: 'Not quite right, try again',
    sortGameTip: 'Arrange from earliest to latest',
    matchGameDesc: 'Match Chinese and world events from the same period',
    matchGameScore: (score) => `Score: ${score}`,
    matchGameMatch: 'Match!',
    matchGameNoMatch: 'Not the same period, try again',
    matchGameDone: 'All matched!',
    matchGameNew: 'New Round',
    matchGamePick: 'Click two events to match',
    // Search
    indexNotReady: 'Index not ready',
    searchNoResult: 'No matching events found',
    searchBuilding: 'Building index…',
    searchResultCount: (n, capped) => `${n} result(s) found${capped ? ' (showing first 100)' : ''}`,
    // Year prompt
    yearPrompt: 'Enter a year:\nNegative for BC, positive for AD',
    yearZeroError: 'Year 0 does not exist',
    yearOutOfRange: 'Year out of range',
    // Data error
    dataLoadError: 'Data loading failed',
    loadFailed: 'Load failed',
    retry: 'Retry',
    // Page titles
    pageTitle: {
      home: 'Shilu: A 11,512-Year Chronicle of Human Civilization',
      events: 'All Events - Shilu',
      map: 'Historical Map - Shilu',
      detail: 'Event Details - Shilu',
      quiz: 'History Quiz - Shilu',
      game: 'History Games - Shilu'
    },
    pageDescription: {
      home: 'An interactive 11,512-year Earth civilization timeline covering major events from 9600 BC to AD 1912. Browse political, military, cultural, and technological milestones by year with an integrated map.',
      events: 'Browse all historical events, filter by category, search by year, region, or keyword.',
      map: 'Explore the spatial distribution of global historical events on a map, from Anatolia to the Indus Valley.',
      quiz: 'Test your history knowledge with fun quiz questions about dynasties, years, and events. Level up as you progress.',
      game: 'Play history games: map location quiz, timeline sorting, and period matching. Test your knowledge of world history.'
    },
    // Quiz levels
    quizLevels: [
      'Qi Refining Lv.1','Qi Refining Lv.2','Qi Refining Lv.3','Qi Refining Lv.4','Qi Refining Lv.5',
      'Qi Refining Lv.6','Qi Refining Lv.7','Qi Refining Lv.8','Qi Refining Lv.9','Qi Refining Lv.10',
      'Qi Refining Lv.11','Qi Refining Lv.12','Qi Refining Lv.13','Foundation Early','Foundation Mid','Foundation Late','Foundation Peak',
      'Core Formation Early','Core Formation Mid','Core Formation Late','Core Formation Peak',
      'Nascent Soul Early','Nascent Soul Mid','Nascent Soul Late','Nascent Soul Peak',
      'Spirit Severing Early','Spirit Severing Mid','Spirit Severing Late','Spirit Severing Peak',
      'Void Refining Early','Void Refining Mid','Void Refining Late','Void Refining Peak',
      'Body Integration Early','Body Integration Mid','Body Integration Late','Body Integration Peak',
      'Mahayana Early','Mahayana Mid','Mahayana Late','Mahayana Peak',
      'Tribulation Stage','True Immortal Early','True Immortal Mid','True Immortal Late','True Immortal Peak',
      'Golden Immortal Early','Golden Immortal Mid','Golden Immortal Late','Golden Immortal Peak',
      'Taiyi Immortal Early','Taiyi Immortal Mid','Taiyi Immortal Late','Taiyi Immortal Peak',
      'Great Luo Immortal Early','Great Luo Immortal Mid','Great Luo Immortal Late','Great Luo Immortal Peak',
      'Great Luo Immortal Perfection','Dao Ancestor'
    ],
    quizRealms: [
      {s:0,e:12,i:'🧘',n:'Qi Refining'},{s:13,e:16,i:'⚔️',n:'Foundation'},{s:17,e:20,i:'🔮',n:'Core Formation'},{s:21,e:24,i:'👶',n:'Nascent Soul'},
      {s:25,e:28,i:'🔥',n:'Spirit Severing'},{s:29,e:32,i:'🌌',n:'Void Refining'},{s:33,e:36,i:'⛓️',n:'Body Integration'},{s:37,e:40,i:'🚢',n:'Mahayana'},
      {s:41,e:41,i:'⚡',n:'Tribulation'},{s:42,e:45,i:'🕊️',n:'True Immortal'},{s:46,e:49,i:'👑',n:'Golden Immortal'},{s:50,e:53,i:'🌟',n:'Taiyi Immortal'},
      {s:54,e:57,i:'🌙',n:'Great Luo Immortal'},{s:58,e:58,i:'☯️',n:'Great Luo Perfection'},{s:59,e:59,i:'🐉',n:'Dao Ancestor'}
    ],
    // Keyboard shortcuts
    shortcutTitle: 'Keyboard Shortcuts',
    shortcuts: [
      { keys: ['←','→'], desc: 'Navigate years' },
      { keys: ['Shift + ←','Shift + →'], desc: 'Skip 10 years' },
      { keys: ['/','Ctrl+F'], desc: 'Search events' }
    ],
    // Footer
    footerPrefix: '© 2026 Shilu.org ',
    footerSuffix: ' shining moments of Earth\'s silicon civilization',
    // Continent order
    continentOrder: ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania', 'Americas', 'Antarctica', 'World', 'Global', 'Other'],
    // Misc
    langSwitchLabel: '中文',
    // Share card
    shareLabel: '📤 Share',
    shareTitle: 'Share Card',
    shareCardTitle: 'Share Card',
    shareCardDownload: 'Download PNG',
    shareCardCopy: 'Copy Image',
    shareCardCopied: 'Copied!'
  }
};

function _fmtYear(y) {
  const t = t9n();
  return t.formatYear(y);
}

function _detectLang() {
  // 1. URL parameter takes highest priority
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang === 'en' || urlLang === 'zh') return urlLang;
  // 2. localStorage for returning visitors
  try {
    const stored = localStorage.getItem('shilu_lang');
    if (stored === 'en' || stored === 'zh') return stored;
  } catch (_) {}
  // 3. Browser language for first-time visitors
  try {
    const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (navLang.startsWith('zh')) return ZH;
    // For all non-Chinese browsers (en, ja, ko, etc.), default to English
    return EN;
  } catch (_) {}
  return ZH;
}

export function getCurrentLang() {
  if (!_lang._current) _lang._current = _detectLang();
  return _lang._current;
}

export function setLanguage(lang) {
  if (lang !== ZH && lang !== EN) return;
  _lang._current = lang;
  try { localStorage.setItem('shilu_lang', lang); } catch (_) {}
  // Update URL parameter without reload
  const url = new URL(window.location);
  if (lang === ZH) url.searchParams.delete('lang');
  else url.searchParams.set('lang', lang);
  window.history.replaceState(null, '', url.toString());
  document.documentElement.lang = lang === ZH ? 'zh-CN' : 'en';
  document.documentElement.dir = t9n().dir;
  // Notify all listeners
  _lang._listeners.forEach(fn => fn(lang));
  // Dispatch event
  window.dispatchEvent(new CustomEvent('shilu:langchange', { detail: lang }));
}

export function onLangChange(fn) {
  _lang._listeners.add(fn);
  return () => _lang._listeners.delete(fn);
}

export function t9n(lang) {
  const l = lang || _lang._current || _detectLang();
  return LOCALE[l] || LOCALE[ZH];
}

export function t(key, ...args) {
  const dict = t9n();
  const val = key.split('.').reduce((o, k) => o && o[k] !== undefined ? o[k] : undefined, dict);
  if (typeof val === 'function') return val(...args);
  return val !== undefined ? val : key;
}

// Initialize on module load
_lang._current = _detectLang();
document.documentElement.lang = _lang._current === ZH ? 'zh-CN' : 'en';

export { ZH };
