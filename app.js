const App = (() => {
  const YEAR_MIN = -2070
  const YEAR_MAX = 1912
  const YEAR_RANGE = YEAR_MAX - YEAR_MIN

  const state = {
    currentYear: 1,
    selectedDynasty: null,
    viewStartYear: YEAR_MIN,
    pixelsPerYear: 1.5,
    eventsCache: {},
    markers: [],
    activeMarker: null,
    contentYears: [],
    contentYearIndex: {},
    viewStartIdx: 0,
    pixelsPerContentYear: 1.5
  }

  const dom = {}
  const subscribers = {}

  function on(event, fn) {
    if (!subscribers[event]) subscribers[event] = []
    subscribers[event].push(fn)
  }

  function emit(event, data) {
    if (subscribers[event]) {
      subscribers[event].forEach(fn => fn(data))
    }
  }

  function cacheDom() {
    dom.dynastyCanvas = document.getElementById('dynasty-canvas')
    dom.dynastyCtx = dom.dynastyCanvas.getContext('2d')
    dom.calendarCanvas = document.getElementById('calendar-canvas')
    dom.calendarCtx = dom.calendarCanvas.getContext('2d')
    dom.mapEl = document.getElementById('map')
    dom.mapEmptyHint = document.getElementById('map-empty-hint')
    dom.eventPanel = document.getElementById('event-detail-panel')
    dom.eventTitle = document.getElementById('event-detail-title')
    dom.eventCategory = document.getElementById('event-detail-category')
    dom.eventContinent = document.getElementById('event-detail-continent')
    dom.eventRegion = document.getElementById('event-detail-region')
    dom.eventDesc = document.getElementById('event-detail-description')
    dom.eventClose = document.getElementById('event-detail-close')
    dom.loadingOverlay = document.getElementById('loading-overlay')
    dom.errorToast = document.getElementById('error-toast')
    dom.errorMessage = document.getElementById('error-message')
    dom.shortcutPanel = document.getElementById('shortcut-panel')
    dom.shortcutBtn = document.getElementById('shortcut-btn')
    dom.dynastyTooltip = document.getElementById('dynasty-tooltip')
    dom.calendarTooltip = document.getElementById('calendar-tooltip')
    dom.dynastyContainer = document.getElementById('dynasty-timeline-container')
    dom.calendarContainer = document.getElementById('calendar-timeline-container')
    dom.mobYearNav = document.getElementById('mobile-year-nav')
    dom.mobYearDisplay = document.getElementById('mob-year-display')
  }

  const dynasties = [
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
    { id: 'wudai', name: '五代十国', start: 907, end: 960, color: '#ab8b5a' },
    { id: 'liao', name: '辽', start: 907, end: 1125, color: '#8b6b4a' },
    { id: 'beisong', name: '北宋', start: 960, end: 1127, color: '#5b9e5b' },
    { id: 'jin', name: '金', start: 1115, end: 1234, color: '#7a9cc6' },
    { id: 'nansong', name: '南宋', start: 1127, end: 1279, color: '#6db36d' },
    { id: 'yuan', name: '元', start: 1271, end: 1368, color: '#4a7c8c' },
    { id: 'ming', name: '明', start: 1368, end: 1644, color: '#c44d4d' },
    { id: 'qing', name: '清', start: 1644, end: 1912, color: '#3a6a8c' }
  ]

  function formatYear(y) {
    if (y < 0) return `公元前${Math.abs(y)}年`
    return `公元${y}年`
  }

  function updateRuleDisplay(year, yearData) {
    const el = document.getElementById('rule-quote')
    if (!el) return
    const dynData = yearData && yearData.dynasties
    if (dynData && dynData.length > 0) {
      const primary = dynData[0]
      el.textContent = `${formatYear(year)}，${primary.name}，${primary.ruler}，${primary.era}`
    } else {
      el.textContent = formatYear(year)
    }
  }

  function updateMobileYearDisplay(year) {
    if (dom.mobYearDisplay) {
      dom.mobYearDisplay.textContent = formatYear(year)
    }
  }

  function yearToX(year, canvasWidth) {
    const adjusted = year <= 0 ? year : year - 1
    return ((adjusted - YEAR_MIN) / YEAR_RANGE) * canvasWidth
  }

  function xToYear(x, canvasWidth) {
    const raw = YEAR_MIN + (x / canvasWidth) * YEAR_RANGE
    const adjusted = raw <= 0 ? raw : raw + 1
    const rounded = Math.round(adjusted)
    return rounded === 0 ? -1 : rounded
  }

  function getContentIndex(year) {
    return state.contentYearIndex[year]
  }

  function contentIdxToYear(idx) {
    return state.contentYears[idx]
  }

  function contentIdxToX(idx, drawW) {
    const total = state.contentYears.length
    if (total < 2) return 0
    return (idx / (total - 1)) * drawW
  }

  function xToContentIdx(x, drawW) {
    const total = state.contentYears.length
    if (total < 2) return 0
    const idx = Math.round((x / drawW) * (total - 1))
    return Math.max(0, Math.min(total - 1, idx))
  }

  function findNearestContentYear(year) {
    const years = state.contentYears
    if (!years.length) return year
    let lo = 0, hi = years.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (years[mid] < year) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return years[0]
    const prev = years[lo - 1]
    const curr = years[lo]
    return (year - prev) <= (curr - year) ? prev : curr
  }

  const DataLoader = {
    getFileName(year) {
      if (year < 0) {
        const absYear = Math.abs(year)
        const start = Math.floor((absYear - 1) / 100) * 100 + 1
        const end = start + 99
        return `data/bc-${String(end).padStart(4, '0')}-${String(start).padStart(4, '0')}.json`
      }
      const start = Math.floor((year - 1) / 100) * 100 + 1
      const end = start + 99
      return `data/${String(start).padStart(4, '0')}-${String(end).padStart(4, '0')}.json`
    },

    async loadYearData(year) {
      const fileName = this.getFileName(year)
      if (state.eventsCache[fileName]) {
        return state.eventsCache[fileName]
      }
      try {
        const resp = await fetch(fileName)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        state.eventsCache[fileName] = data
        return data
      } catch (err) {
        console.warn(`DataLoader: failed to load ${fileName}`, err)
        state.eventsCache[fileName] = []
        return []
      }
    },

    async getYearData(year) {
      const fileData = await this.loadYearData(year)
      const entry = fileData.find(d => d.year === year)
      if (!entry) return { dynasties: [], events: [] }
      return {
        dynasties: entry.dynasties || [],
        events: entry.events || []
      }
    }
  }

  const DynastyTimeline = {
    hoveredId: null,

    resize() {
      const rect = dom.dynastyContainer.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      dom.dynastyCanvas.width = rect.width * dpr
      dom.dynastyCanvas.height = rect.height * dpr
      dom.dynastyCanvas.style.width = rect.width + 'px'
      dom.dynastyCanvas.style.height = rect.height + 'px'
      dom.dynastyCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      this.draw()
    },

    draw() {
      const ctx = dom.dynastyCtx
      const w = dom.dynastyCanvas.width / (window.devicePixelRatio || 1)
      const h = dom.dynastyCanvas.height / (window.devicePixelRatio || 1)

      ctx.clearRect(0, 0, w, h)

      const paddingX = 8
      const barY = h * 0.15
      const barH = h * 0.7
      const drawW = w - paddingX * 2
      const radius = 3

      const sorted = [...dynasties].sort((a, b) => a.start - b.start)

      const weights = sorted.map(d => {
        let count = 0
        for (const y of state.contentYears) {
          if (y >= d.start && y <= d.end) count++
        }
        return { d, weight: Math.max(count, 1) }
      })
      const totalWeight = weights.reduce((s, w) => s + w.weight, 0)

      let xOffset = paddingX
      weights.forEach(({ d, weight }) => {
        const width = Math.max((weight / totalWeight) * drawW, 8)
        const x1 = xOffset
        const x2 = xOffset + width

        const isActive = state.selectedDynasty === d.id
        const isCurrent = state.currentYear >= d.start && state.currentYear <= d.end
        const isHovered = this.hoveredId === d.id

        const alpha = isActive ? 1 : (isCurrent || isHovered) ? 0.9 : 0.35
        ctx.fillStyle = d.color + Math.round(alpha * 255).toString(16).padStart(2, '0')
        if (isActive) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1
        } else {
          ctx.strokeStyle = 'transparent'
          ctx.lineWidth = 0
        }

        ctx.beginPath()
        ctx.moveTo(x1 + radius, barY)
        ctx.lineTo(x2 - radius, barY)
        ctx.quadraticCurveTo(x2, barY, x2, barY + radius)
        ctx.lineTo(x2, barY + barH - radius)
        ctx.quadraticCurveTo(x2, barY + barH, x2 - radius, barY + barH)
        ctx.lineTo(x1 + radius, barY + barH)
        ctx.quadraticCurveTo(x1, barY + barH, x1, barY + barH - radius)
        ctx.lineTo(x1, barY + radius)
        ctx.quadraticCurveTo(x1, barY, x1 + radius, barY)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        if (width > 14) {
          ctx.fillStyle = (isActive || isCurrent || isHovered) ? '#fff' : 'rgba(255,255,255,0.6)'
          ctx.font = `${Math.max(7, Math.min(9, barH * 0.65))}px "PingFang SC", "Microsoft YaHei", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(d.name, x1 + width / 2, barY + barH / 2)
        }

        xOffset = x2
      })

      const curIdx = getContentIndex(state.currentYear)
      if (curIdx !== undefined && state.contentYears.length > 1) {
        const frac = curIdx / (state.contentYears.length - 1)
        const cursorX = frac * drawW + paddingX
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(cursorX, 0)
        ctx.lineTo(cursorX, h)
        ctx.stroke()
        ctx.setLineDash([])
      }
    },

    getDynastyAt(x, y) {
      const rect = dom.dynastyCanvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const drawW = w - 16
      const paddingX = 8
      const rx = x - rect.left

      const sorted = [...dynasties].sort((a, b) => a.start - b.start)
      const weights = sorted.map(d => {
        let count = 0
        for (const y of state.contentYears) {
          if (y >= d.start && y <= d.end) count++
        }
        return { d, weight: Math.max(count, 1) }
      })
      const totalWeight = weights.reduce((s, w) => s + w.weight, 0)

      let xOff = paddingX
      for (const { d, weight } of weights) {
        const wd = Math.max((weight / totalWeight) * drawW, 8)
        if (rx >= xOff && rx <= xOff + wd) return d
        xOff += wd
      }
      return null
    },

    handleClick(e) {
      const dynasty = this.getDynastyAt(e.clientX, e.clientY)
      if (dynasty) {
        state.selectedDynasty = dynasty.id
        emit('dynastySelected', dynasty)
        this.draw()
      }
    },

    handleMove(e) {
      const dynasty = this.getDynastyAt(e.clientX, e.clientY)
      if (dynasty) {
        this.hoveredId = dynasty.id
        dom.dynastyTooltip.textContent = `${dynasty.name}（${formatYear(dynasty.start)} ~ ${formatYear(dynasty.end)}）`
        dom.dynastyTooltip.classList.remove('hidden')
        dom.dynastyTooltip.style.left = (e.clientX - dom.dynastyContainer.getBoundingClientRect().left + 12) + 'px'
        dom.dynastyTooltip.style.top = (e.clientY - dom.dynastyContainer.getBoundingClientRect().top - 32) + 'px'
        this.draw()
      } else {
        this.hoveredId = null
        dom.dynastyTooltip.classList.add('hidden')
        this.draw()
      }
    },

    handleLeave() {
      this.hoveredId = null
      dom.dynastyTooltip.classList.add('hidden')
      this.draw()
    }
  }

  const CalendarTimeline = {
    dragging: false,
    dragStartX: 0,
    dragStartView: 0,
    hoverYear: null,

    resize() {
      const rect = dom.calendarContainer.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      dom.calendarCanvas.width = rect.width * dpr
      dom.calendarCanvas.height = rect.height * dpr
      dom.calendarCanvas.style.width = rect.width + 'px'
      dom.calendarCanvas.style.height = rect.height + 'px'
      dom.calendarCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const drawW = rect.width - 16
      const total = state.contentYears.length
      if (total > 1) {
        state.pixelsPerContentYear = Math.min(1.8, drawW / total)
        if (state.pixelsPerContentYear >= 0.8) {
          state.viewStartIdx = 0
        }
      } else {
        const fitPixelsPerYear = drawW / YEAR_RANGE
        state.pixelsPerYear = Math.min(1.8, fitPixelsPerYear)
        if (fitPixelsPerYear >= 0.8) {
          state.viewStartYear = YEAR_MIN
        }
      }
      this.draw()
    },

    draw() {
      const ctx = dom.calendarCtx
      const w = dom.calendarCanvas.width / (window.devicePixelRatio || 1)
      const h = dom.calendarCanvas.height / (window.devicePixelRatio || 1)

      ctx.clearRect(0, 0, w, h)

      const paddingX = 8
      const drawW = w - paddingX * 2
      const tickTop = h * 0.1
      const tickH = h * 0.45

      const years = state.contentYears
      const total = years.length
      if (total < 2) {
        this.drawLinear(ctx, w, h, paddingX, drawW, tickTop, tickH)
        return
      }

      const ppcy = state.pixelsPerContentYear
      const startIdx = Math.max(0, Math.floor(state.viewStartIdx))
      const visibleCount = Math.ceil(drawW / ppcy) + 2
      const endIdx = Math.min(total - 1, startIdx + visibleCount)

      ctx.strokeStyle = '#30363d'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(paddingX, tickTop)
      ctx.lineTo(w - paddingX, tickTop)
      ctx.stroke()

      if (state.selectedDynasty) {
        const d = dynasties.find(d => d.id === state.selectedDynasty)
        if (d) {
          const sIdx = getContentIndex(d.start)
          const eIdx = getContentIndex(d.end)
          if (sIdx !== undefined && eIdx !== undefined) {
            const dx1 = (sIdx - state.viewStartIdx) * ppcy + paddingX
            const dx2 = (eIdx - state.viewStartIdx) * ppcy + paddingX
            ctx.fillStyle = 'rgba(255, 165, 87, 0.12)'
            ctx.fillRect(dx1, 0, dx2 - dx1, h)
            ctx.strokeStyle = 'rgba(255, 165, 87, 0.5)'
            ctx.lineWidth = 1
            ctx.setLineDash([6, 3])
            ctx.beginPath()
            ctx.moveTo(dx1, tickTop)
            ctx.lineTo(dx1, tickTop + h * 0.8)
            ctx.moveTo(dx2, tickTop)
            ctx.lineTo(dx2, tickTop + h * 0.8)
            ctx.stroke()
            ctx.setLineDash([])
          }
        }
      }

      for (let i = startIdx; i <= endIdx; i++) {
        const y = years[i]
        const x = (i - state.viewStartIdx) * ppcy + paddingX
        if (x < -20 || x > w + 20) continue

        const isCurrent = y === state.currentYear
        const isHover = y === this.hoverYear
        const isCentury = y % 100 === 0
        const isDecade = y % 10 === 0

        if (isCurrent) {
          ctx.fillStyle = 'rgba(88, 166, 255, 0.15)'
          ctx.fillRect(x - 2, 0, 4, h)
        }

        if (isCentury) {
          ctx.strokeStyle = '#8b949e'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + tickH * 1.44)
          ctx.stroke()
        } else if (isDecade) {
          ctx.strokeStyle = '#484f58'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + tickH)
          ctx.stroke()
        } else {
          ctx.strokeStyle = isCurrent || isHover ? '#8b949e' : '#30363d'
          ctx.lineWidth = isCurrent || isHover ? 1.5 : 0.5
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + tickH * 0.56)
          ctx.stroke()
        }

        if (isCurrent || isHover) {
          ctx.fillStyle = isCurrent ? '#58a6ff' : '#f0883e'
          ctx.beginPath()
          ctx.arc(x, tickTop + h * 0.5, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      const curIdx = getContentIndex(state.currentYear)
      if (curIdx !== undefined) {
        const cursorX = (curIdx - state.viewStartIdx) * ppcy + paddingX
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(cursorX, 0)
        ctx.lineTo(cursorX, h)
        ctx.stroke()
        ctx.setLineDash([])
      }
    },

    drawLinear(ctx, w, h, paddingX, drawW, tickTop, tickH) {
      const startYear = Math.floor(state.viewStartYear / 10) * 10
      const endYear = Math.ceil((state.viewStartYear + YEAR_RANGE / state.pixelsPerYear) / 10) * 10

      ctx.strokeStyle = '#30363d'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(paddingX, tickTop)
      ctx.lineTo(w - paddingX, tickTop)
      ctx.stroke()

      if (state.selectedDynasty) {
        const d = dynasties.find(d => d.id === state.selectedDynasty)
        if (d) {
          const dx1 = yearToX(d.start, drawW) - yearToX(state.viewStartYear, drawW) + paddingX
          const dx2 = yearToX(d.end, drawW) - yearToX(state.viewStartYear, drawW) + paddingX
          ctx.fillStyle = 'rgba(255, 165, 87, 0.12)'
          ctx.fillRect(dx1, 0, dx2 - dx1, h)
          ctx.strokeStyle = 'rgba(255, 165, 87, 0.5)'
          ctx.lineWidth = 1
          ctx.setLineDash([6, 3])
          ctx.beginPath()
          ctx.moveTo(dx1, tickTop)
          ctx.lineTo(dx1, tickTop + h * 0.8)
          ctx.moveTo(dx2, tickTop)
          ctx.lineTo(dx2, tickTop + h * 0.8)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      for (let y = startYear; y <= endYear; y++) {
        if (y === 0) continue
        const x = yearToX(y, drawW) - yearToX(state.viewStartYear, drawW) + paddingX
        if (x < -20 || x > w + 20) continue

        const isCentury = y % 100 === 0
        const isDecade = y % 10 === 0
        const isCurrent = y === state.currentYear
        const isHover = y === this.hoverYear

        if (isCurrent) {
          ctx.fillStyle = 'rgba(88, 166, 255, 0.15)'
          ctx.fillRect(x - 2, 0, 4, h)
        }

        if (isCentury) {
          ctx.strokeStyle = '#8b949e'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + tickH * 1.44)
          ctx.stroke()
        } else if (isDecade) {
          ctx.strokeStyle = '#484f58'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + tickH)
          ctx.stroke()
        } else {
          ctx.strokeStyle = '#30363d'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + tickH * 0.56)
          ctx.stroke()
        }

        if (isCurrent || isHover) {
          ctx.fillStyle = isCurrent ? '#58a6ff' : '#f0883e'
          ctx.beginPath()
          ctx.arc(x, tickTop + h * 0.5, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    },

    getYearAt(x, y) {
      const rect = dom.calendarCanvas.getBoundingClientRect()
      const w = rect.width
      const drawW = w - 16
      const paddingX = 8
      const rx = x - rect.left
      if (state.contentYears.length > 1) {
        const ppcy = state.pixelsPerContentYear
        const idx = Math.round((rx - paddingX) / ppcy + state.viewStartIdx)
        return contentIdxToYear(Math.max(0, Math.min(state.contentYears.length - 1, idx)))
      }
      return xToYear(rx - paddingX + yearToX(state.viewStartYear, drawW), drawW)
    },

    handleClick(e) {
      const year = this.getYearAt(e.clientX, e.clientY)
      if (year >= YEAR_MIN && year <= YEAR_MAX) {
        state.currentYear = year
        state.selectedDynasty = null
        emit('yearChanged', year)
        this.draw()
        DynastyTimeline.draw()
      }
    },

    handleMove(e) {
      const year = this.getYearAt(e.clientX, e.clientY)
      if (year >= YEAR_MIN && year <= YEAR_MAX) {
        this.hoverYear = year
        dom.calendarTooltip.textContent = formatYear(year)
        dom.calendarTooltip.classList.remove('hidden')
        dom.calendarTooltip.style.left = (e.clientX - dom.calendarContainer.getBoundingClientRect().left + 12) + 'px'
        dom.calendarTooltip.style.top = (e.clientY - dom.calendarContainer.getBoundingClientRect().top - 28) + 'px'
        this.draw()
      } else {
        this.hoverYear = null
        dom.calendarTooltip.classList.add('hidden')
        this.draw()
      }
    },

    handleLeave() {
      this.hoverYear = null
      dom.calendarTooltip.classList.add('hidden')
      this.draw()
    },

    handleWheel(e) {
      e.preventDefault()
      if (state.contentYears.length > 1) {
        const delta = e.deltaY > 0 ? 5 : -5
        state.viewStartIdx = Math.max(0, Math.min(state.contentYears.length - 1, state.viewStartIdx + delta))
      } else {
        const delta = e.deltaY > 0 ? 10 : -10
        state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, state.viewStartYear + delta))
      }
      this.draw()
    },

    handleMouseDown(e) {
      this.dragging = true
      this.dragStartX = e.clientX
      this.dragStartView = state.contentYears.length > 1 ? state.viewStartIdx : state.viewStartYear
      dom.calendarContainer.style.cursor = 'grabbing'
    },

    handleMouseMove(e) {
      if (!this.dragging) {
        this.handleMove(e)
        return
      }
      const rect = dom.calendarCanvas.getBoundingClientRect()
      const drawW = rect.width - 16
      if (state.contentYears.length > 1) {
        const ppcy = state.pixelsPerContentYear
        const deltaX = this.dragStartX - e.clientX
        const deltaIdx = Math.round(deltaX / ppcy)
        state.viewStartIdx = Math.max(0, Math.min(state.contentYears.length - 1, this.dragStartView + deltaIdx))
      } else {
        const deltaX = this.dragStartX - e.clientX
        const deltaYears = (deltaX / drawW) * YEAR_RANGE
        state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, this.dragStartView + deltaYears))
      }
      this.draw()
    },

    handleMouseUp() {
      this.dragging = false
      dom.calendarContainer.style.cursor = 'grab'
    },

    scrollToYear(year) {
      if (state.contentYears.length > 1) {
        const idx = getContentIndex(year)
        if (idx === undefined) return
        const total = state.contentYears.length
        const rect = dom.calendarCanvas.getBoundingClientRect()
        const drawW = rect.width - 16
        const ppcy = state.pixelsPerContentYear
        const visibleCount = drawW / ppcy
        state.viewStartIdx = Math.max(0, Math.min(total - visibleCount, idx - visibleCount / 2))
      } else {
        const rect = dom.calendarCanvas.getBoundingClientRect()
        const drawW = rect.width - 16
        state.viewStartYear = year - (YEAR_RANGE / state.pixelsPerYear) / 2
        state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, state.viewStartYear))
      }
    },

    animateScrollToYear(targetYear) {
      const duration = 500
      const startTime = performance.now()

      if (state.contentYears.length > 1) {
        const idx = getContentIndex(targetYear)
        if (idx === undefined) return
        const startView = state.viewStartIdx
        const total = state.contentYears.length
        const rect = dom.calendarCanvas.getBoundingClientRect()
        const drawW = rect.width - 16
        const ppcy = state.pixelsPerContentYear
        const visibleCount = drawW / ppcy
        const targetView = Math.max(0, Math.min(total - visibleCount, idx - visibleCount / 2))

        const animate = (now) => {
          const elapsed = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          state.viewStartIdx = startView + (targetView - startView) * eased
          this.draw()
          if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      } else {
        const startView = state.viewStartYear
        const rect = dom.calendarCanvas.getBoundingClientRect()
        const drawW = rect.width - 16
        const targetView = targetYear - (YEAR_RANGE / state.pixelsPerYear) / 2
        const clampedTarget = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, targetView))

        const animate = (now) => {
          const elapsed = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          state.viewStartYear = startView + (clampedTarget - startView) * eased
          this.draw()
          if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
      }
    }
  }

  const MapView = {
    map: null,
    satelliteLayer: null,
    streetLayer: null,
    currentLayer: 'satellite',

    init() {
      this.map = L.map('map', {
        center: [30, 20],
        zoom: 3,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false
      })

      this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: ''
      })

      this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      })

      this.satelliteLayer.addTo(this.map)

      this.map.on('resize', () => {
        this.map.invalidateSize()
      })

      window.addEventListener('resize', () => {
        this.map.invalidateSize()
      })

      const satBtn = document.getElementById('layer-satellite')
      const strBtn = document.getElementById('layer-street')
      if (satBtn) {
        satBtn.addEventListener('click', () => this.switchLayer('satellite'))
      }
      if (strBtn) {
        strBtn.addEventListener('click', () => this.switchLayer('street'))
      }
    },

    switchLayer(type) {
      if (this.currentLayer === type) return
      this.currentLayer = type
      const satBtn = document.getElementById('layer-satellite')
      const strBtn = document.getElementById('layer-street')

      if (type === 'satellite') {
        this.map.removeLayer(this.streetLayer)
        this.satelliteLayer.addTo(this.map)
        if (satBtn) satBtn.classList.add('active')
        if (strBtn) strBtn.classList.remove('active')
      } else {
        this.map.removeLayer(this.satelliteLayer)
        this.streetLayer.addTo(this.map)
        if (strBtn) strBtn.classList.add('active')
        if (satBtn) satBtn.classList.remove('active')
      }
    },

    clearMarkers() {
      state.markers.forEach(m => this.map.removeLayer(m))
      state.markers = []
      state.activeMarker = null
    },

    showEvents(events) {
      this.clearMarkers()

      if (!events || events.length === 0) {
        dom.mapEmptyHint.classList.remove('hidden')
        return
      }

      dom.mapEmptyHint.classList.add('hidden')

      const bounds = []

      events.forEach((evt, idx) => {
        const marker = L.marker([evt.latitude, evt.longitude], {
          icon: L.divIcon({
            className: 'custom-marker',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        })

        const regionLabel = evt.region ? `<span style="color:#f0883e;font-size:11px;">${evt.region}</span>` : ''
        marker.bindTooltip(`<div style="text-align:center;"><strong>${evt.title}</strong><br>${regionLabel}</div>`, {
          direction: 'top',
          offset: [0, -10],
          className: '',
          sticky: true
        })

        marker.on('click', () => {
          state.markers.forEach(m => {
            const el = m.getElement()
            if (el) el.classList.remove('active')
          })
          const el = marker.getElement()
          if (el) el.classList.add('active')
          state.activeMarker = marker
          emit('eventSelected', evt)
        })

        marker.addTo(this.map)
        state.markers.push(marker)
        bounds.push([evt.latitude, evt.longitude])
      })

      if (bounds.length > 1) {
        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 })
      } else if (bounds.length === 1) {
        this.map.setView(bounds[0], 5)
      }
    }
  }

  function showLoading() {
    dom.loadingOverlay.classList.remove('hidden')
  }

  function hideLoading() {
    dom.loadingOverlay.classList.add('hidden')
  }

  function showError(msg) {
    dom.errorMessage.textContent = msg
    dom.errorToast.classList.remove('hidden')
    setTimeout(() => {
      dom.errorToast.classList.add('hidden')
    }, 4000)
  }

  function toggleShortcutPanel() {
    dom.shortcutPanel.classList.toggle('hidden')
  }

  const EventPanel = {
    showEvents(year, yearData) {
      const listBody = document.getElementById('event-list-body')

      const events = yearData.events

      if (!listBody) return

      let html = ''

      if (!events || events.length === 0) {
        html += '<p style="color:var(--color-text-muted);font-size:12px;padding:8px;">该年份暂无记录事件</p>'
        listBody.innerHTML = html
        return
      }

      const groups = {}
      events.forEach(evt => {
        const continent = evt.continent || '其他'
        if (!groups[continent]) groups[continent] = {}
        const region = evt.region || '其他'
        if (!groups[continent][region]) groups[continent][region] = []
        groups[continent][region].push(evt)
      })

      const continentOrder = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲', '其他']
      continentOrder.forEach(continent => {
        if (!groups[continent]) return
        html += `<div class="event-continent-group"><div class="event-continent-title">${continent}</div>`
        Object.keys(groups[continent]).sort().forEach(region => {
          html += `<div class="event-region-group"><div class="event-region-title">${region}</div><div class="event-region-items">`
          groups[continent][region].forEach(evt => {
            html += `<div class="event-item" data-title="${evt.title.replace(/"/g, '&quot;')}">
              <span class="event-item-dot"></span>
              <span class="event-item-cat">${evt.category || '事件'}</span>
              <span class="event-item-title">${evt.title}</span>
            </div>`
          })
          html += '</div></div>'
        })
        html += '</div>'
      })
      listBody.innerHTML = html

      listBody.querySelectorAll('.event-item').forEach(item => {
        item.addEventListener('click', () => {
          const title = item.dataset.title
          const evt = events.find(e => e.title === title)
          if (evt) {
            emit('eventSelected', evt)
            const marker = state.markers.find(m => {
              const ll = m.getLatLng()
              return ll.lat === evt.latitude && ll.lng === evt.longitude
            })
            if (marker) {
              state.markers.forEach(m => {
                const el = m.getElement()
                if (el) el.classList.remove('active')
              })
              const el = marker.getElement()
              if (el) el.classList.add('active')
              state.activeMarker = marker
              MapView.map.setView([evt.latitude, evt.longitude], 5)
            }
          }
        })
      })
    }
  }

  async function loadAndShowEvents(year) {
    showLoading()
    try {
      const yearData = await DataLoader.getYearData(year)
      updateRuleDisplay(year, yearData)
      updateMobileYearDisplay(year)
      MapView.showEvents(yearData.events)
      EventPanel.showEvents(year, yearData)
    } catch (err) {
      showError('数据加载失败，请稍后重试')
      dom.mapEmptyHint.classList.remove('hidden')
      MapView.clearMarkers()
      EventPanel.showEvents(year, { dynasties: [], events: [] })
    } finally {
      hideLoading()
    }
  }

  function setupEventListeners() {
    dom.dynastyContainer.addEventListener('click', e => DynastyTimeline.handleClick(e))
    dom.dynastyContainer.addEventListener('mousemove', e => DynastyTimeline.handleMove(e))
    dom.dynastyContainer.addEventListener('mouseleave', () => DynastyTimeline.handleLeave())

    dom.calendarContainer.addEventListener('click', e => CalendarTimeline.handleClick(e))
    dom.calendarContainer.addEventListener('mousemove', e => CalendarTimeline.handleMouseMove(e))
    dom.calendarContainer.addEventListener('mouseleave', () => CalendarTimeline.handleLeave())
    dom.calendarContainer.addEventListener('wheel', e => CalendarTimeline.handleWheel(e), { passive: false })
    dom.calendarContainer.addEventListener('mousedown', e => CalendarTimeline.handleMouseDown(e))
    dom.calendarContainer.addEventListener('mouseup', () => CalendarTimeline.handleMouseUp())
    window.addEventListener('mouseup', () => CalendarTimeline.handleMouseUp())

    let lastTouchUpdateTime = 0
    let lastTouchYear = null
    const TOUCH_THROTTLE = 120

    dom.calendarContainer.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        CalendarTimeline.dragging = true
        CalendarTimeline.dragStartX = e.touches[0].clientX
        CalendarTimeline.dragStartView = state.contentYears.length > 1 ? state.viewStartIdx : state.viewStartYear
        lastTouchUpdateTime = Date.now()
        lastTouchYear = state.currentYear
      }
    })
    dom.calendarContainer.addEventListener('touchmove', e => {
      if (!CalendarTimeline.dragging || e.touches.length !== 1) return
      const rect = dom.calendarCanvas.getBoundingClientRect()
      if (state.contentYears.length > 1) {
        const ppcy = state.pixelsPerContentYear
        const deltaX = CalendarTimeline.dragStartX - e.touches[0].clientX
        const deltaIdx = Math.round(deltaX / ppcy)
        state.viewStartIdx = Math.max(0, Math.min(state.contentYears.length - 1, CalendarTimeline.dragStartView + deltaIdx))
      } else {
        const drawW = rect.width - 16
        const deltaX = CalendarTimeline.dragStartX - e.touches[0].clientX
        const deltaYears = (deltaX / drawW) * YEAR_RANGE
        state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, CalendarTimeline.dragStartView + deltaYears))
      }
      CalendarTimeline.draw()

      const now = Date.now()
      if (now - lastTouchUpdateTime < TOUCH_THROTTLE) return
      const touch = e.touches[0]
      const year = CalendarTimeline.getYearAt(touch.clientX, touch.clientY)
      if (year >= YEAR_MIN && year <= YEAR_MAX && year !== lastTouchYear) {
        lastTouchUpdateTime = now
        lastTouchYear = year
        state.currentYear = year
        state.selectedDynasty = null
        emit('yearChanged', year)
        DynastyTimeline.draw()
      }
    })
    dom.calendarContainer.addEventListener('touchend', () => {
      CalendarTimeline.dragging = false
    })

    document.addEventListener('keydown', e => {
      const key = e.key
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault()
        const years = state.contentYears
        let newYear
        if (years.length > 1) {
          const curIdx = getContentIndex(state.currentYear)
          let newIdx
          if (e.shiftKey) {
            const step = key === 'ArrowRight' ? 10 : -10
            newIdx = (curIdx !== undefined ? curIdx : 0) + step
          } else {
            newIdx = curIdx !== undefined ? curIdx + (key === 'ArrowRight' ? 1 : -1) : 0
          }
          newIdx = Math.max(0, Math.min(years.length - 1, newIdx))
          newYear = years[newIdx]
        } else {
          const step = e.shiftKey ? 10 : 1
          const delta = key === 'ArrowRight' ? step : -step
          newYear = state.currentYear + delta
          if (newYear === 0) newYear = delta > 0 ? 1 : -1
          newYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX, newYear))
        }
        if (newYear !== state.currentYear) {
          state.currentYear = newYear
          state.selectedDynasty = null
          emit('yearChanged', newYear)
          CalendarTimeline.draw()
          DynastyTimeline.draw()
        }
      }
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault()
        toggleShortcutPanel()
      }
      if (key === 'Escape') {
        dom.shortcutPanel.classList.add('hidden')
        dom.eventPanel.classList.add('hidden')
        state.selectedDynasty = null
        DynastyTimeline.draw()
      }
    })

    dom.shortcutBtn.addEventListener('click', toggleShortcutPanel)

    dom.eventClose.addEventListener('click', () => {
      dom.eventPanel.classList.add('hidden')
      if (state.activeMarker) {
        const el = state.activeMarker.getElement()
        if (el) el.classList.remove('active')
        state.activeMarker = null
      }
    })

    window.addEventListener('resize', () => {
      DynastyTimeline.resize()
      CalendarTimeline.resize()
    })

    document.addEventListener('click', e => {
      if (!dom.shortcutPanel.contains(e.target) && e.target !== dom.shortcutBtn) {
        dom.shortcutPanel.classList.add('hidden')
      }
    })

    dom.mobYearNav.addEventListener('click', e => {
      const btn = e.target.closest('.mob-nav-btn')
      if (btn) {
        const step = parseInt(btn.dataset.step, 10)
        let newYear
        const years = state.contentYears
        if (years.length > 1) {
          const curIdx = getContentIndex(state.currentYear)
          const newIdx = Math.max(0, Math.min(years.length - 1, (curIdx !== undefined ? curIdx : 0) + step))
          newYear = years[newIdx]
        } else {
          newYear = state.currentYear + step
          if (newYear === 0) newYear = step > 0 ? 1 : -1
          newYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX, newYear))
        }
        if (newYear !== state.currentYear) {
          state.currentYear = newYear
          state.selectedDynasty = null
          emit('yearChanged', newYear)
          CalendarTimeline.draw()
          DynastyTimeline.draw()
        }
        return
      }
      if (e.target === dom.mobYearDisplay) {
        const yearStr = prompt('请输入年份：\n公元前输入负数，公元直接输入数字', state.currentYear)
        if (yearStr !== null) {
          const y = parseInt(yearStr, 10)
          if (!isNaN(y) && y !== 0 && y >= YEAR_MIN && y <= YEAR_MAX) {
            state.currentYear = y
            state.selectedDynasty = null
            emit('yearChanged', y)
            CalendarTimeline.draw()
            DynastyTimeline.draw()
          } else if (y === 0) {
            showError('公元0年不存在')
          } else {
            showError('年份超出范围')
          }
        }
      }
    })
  }

  function setupSubscriptions() {
    on('dynastySelected', dynasty => {
      const targetYear = findNearestContentYear(dynasty.start)
      state.currentYear = targetYear
      CalendarTimeline.animateScrollToYear(targetYear)
      CalendarTimeline.draw()
      loadAndShowEvents(targetYear)
    })

    on('yearChanged', year => {
      loadAndShowEvents(year)
      const activeDynasty = dynasties.find(d => year >= d.start && year <= d.end)
      if (activeDynasty) {
        state.selectedDynasty = activeDynasty.id
      }
      DynastyTimeline.draw()
    })

    on('eventSelected', evt => {
      dom.eventTitle.textContent = evt.title
      dom.eventCategory.textContent = evt.category || '历史事件'
      dom.eventContinent.textContent = evt.continent || ''
      dom.eventRegion.textContent = evt.region || ''
      dom.eventDesc.textContent = evt.description
      dom.eventPanel.classList.remove('hidden')
    })
  }

  async function loadContentYearIndex() {
    try {
      const resp = await fetch('data/content-years.json')
      if (resp.ok) {
        const data = await resp.json()
        state.contentYears = data.years || []
        state.contentYearIndex = {}
        state.contentYears.forEach((y, i) => { state.contentYearIndex[y] = i })
        if (state.contentYears.length) {
          state.viewStartIdx = 0
          const rect = dom.calendarCanvas && dom.calendarCanvas.getBoundingClientRect()
          if (rect) {
            const drawW = rect.width - 16
            state.pixelsPerContentYear = Math.min(1.8, drawW / state.contentYears.length)
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load content year index', e)
    }
  }

  async function init() {
    cacheDom()
    await loadContentYearIndex()
    setupEventListeners()
    setupSubscriptions()
    MapView.init()

    DynastyTimeline.resize()
    CalendarTimeline.resize()

    await loadAndShowEvents(state.currentYear)
  }

  return { init, dynasties, state, formatYear }
})()

document.addEventListener('DOMContentLoaded', () => {
  App.init()
})