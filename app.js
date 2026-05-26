const App = (() => {
  const YEAR_MIN = -2070
  const YEAR_MAX = 1912
  const YEAR_RANGE = YEAR_MAX - YEAR_MIN

  const state = {
    currentYear: 9,
    selectedDynasty: null,
    viewStartYear: YEAR_MIN,
    pixelsPerYear: 1.5,
    eventsCache: {},
    markers: [],
    activeMarker: null
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
    dom.yearDisplay = document.getElementById('current-year-display')
    dom.mapEl = document.getElementById('map')
    dom.mapEmptyHint = document.getElementById('map-empty-hint')
    dom.eventPanel = document.getElementById('event-detail-panel')
    dom.eventTitle = document.getElementById('event-detail-title')
    dom.eventYear = document.getElementById('event-detail-year')
    dom.eventCategory = document.getElementById('event-detail-category')
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
    { id: 'xixia', name: '西夏', start: 1038, end: 1227, color: '#b8956e' },
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

  function yearToX(year, canvasWidth) {
    return ((year - YEAR_MIN) / YEAR_RANGE) * canvasWidth
  }

  function xToYear(x, canvasWidth) {
    return Math.round(YEAR_MIN + (x / canvasWidth) * YEAR_RANGE)
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

      sorted.forEach(d => {
        const x1 = yearToX(d.start, drawW) + paddingX
        const x2 = yearToX(d.end, drawW) + paddingX
        const width = Math.max(x2 - x1, 3)

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
        ctx.lineTo(x1 + width - radius, barY)
        ctx.quadraticCurveTo(x1 + width, barY, x1 + width, barY + radius)
        ctx.lineTo(x1 + width, barY + barH - radius)
        ctx.quadraticCurveTo(x1 + width, barY + barH, x1 + width - radius, barY + barH)
        ctx.lineTo(x1 + radius, barY + barH)
        ctx.quadraticCurveTo(x1, barY + barH, x1, barY + barH - radius)
        ctx.lineTo(x1, barY + radius)
        ctx.quadraticCurveTo(x1, barY, x1 + radius, barY)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        if (width > 14) {
          ctx.fillStyle = (isActive || isCurrent || isHovered) ? '#fff' : 'rgba(255,255,255,0.6)'
          ctx.font = `${Math.max(8, Math.min(10, barH * 0.7))}px "PingFang SC", "Microsoft YaHei", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(d.name, x1 + width / 2, barY + barH / 2)
        }
      })

      const cursorX = yearToX(state.currentYear, drawW) + paddingX
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(cursorX, 0)
      ctx.lineTo(cursorX, h)
      ctx.stroke()
      ctx.setLineDash([])
    },

    getDynastyAt(x, y) {
      const rect = dom.dynastyCanvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const drawW = w - 16
      const paddingX = 8
      const rx = x - rect.left

      const year = xToYear(rx - paddingX, drawW)

      for (const d of dynasties) {
        if (year >= d.start && year <= d.end && y >= rect.top && y <= rect.bottom) {
          return d
        }
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
      const fitPixelsPerYear = drawW / YEAR_RANGE
      state.pixelsPerYear = Math.min(1.8, fitPixelsPerYear)
      if (fitPixelsPerYear >= 0.8) {
        state.viewStartYear = YEAR_MIN
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
      const smallTickH = h * 0.25
      const mediumTickH = h * 0.45
      const largeTickH = h * 0.65

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
          ctx.lineTo(x, tickTop + largeTickH)
          ctx.stroke()

          ctx.fillStyle = '#e6edf3'
          ctx.font = '9px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          const label = y < 0 ? `前${Math.abs(y)}` : `${y}`
          ctx.fillText(label, x, tickTop + largeTickH + 4)
        } else if (isDecade) {
          ctx.strokeStyle = '#484f58'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + mediumTickH)
          ctx.stroke()
        } else {
          ctx.strokeStyle = '#30363d'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(x, tickTop)
          ctx.lineTo(x, tickTop + smallTickH)
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
      const delta = e.deltaY > 0 ? 10 : -10
      state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, state.viewStartYear + delta))
      this.draw()
    },

    handleMouseDown(e) {
      this.dragging = true
      this.dragStartX = e.clientX
      this.dragStartView = state.viewStartYear
      dom.calendarContainer.style.cursor = 'grabbing'
    },

    handleMouseMove(e) {
      if (!this.dragging) {
        this.handleMove(e)
        return
      }
      const rect = dom.calendarCanvas.getBoundingClientRect()
      const drawW = rect.width - 16
      const deltaX = this.dragStartX - e.clientX
      const deltaYears = (deltaX / drawW) * YEAR_RANGE
      state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, this.dragStartView + deltaYears))
      this.draw()
    },

    handleMouseUp() {
      this.dragging = false
      dom.calendarContainer.style.cursor = 'grab'
    },

    scrollToYear(year) {
      const rect = dom.calendarCanvas.getBoundingClientRect()
      const drawW = rect.width - 16
      state.viewStartYear = year - (YEAR_RANGE / state.pixelsPerYear) / 2
      state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, state.viewStartYear))
    },

    animateScrollToYear(targetYear) {
      const startView = state.viewStartYear
      const targetView = targetYear - (YEAR_RANGE / state.pixelsPerYear) / 2
      const clampedTarget = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, targetView))
      const duration = 500
      const startTime = performance.now()

      const animate = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        state.viewStartYear = startView + (clampedTarget - startView) * eased
        this.draw()
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }
  }

  const MapView = {
    map: null,
    tileLayer: null,

    init() {
      this.map = L.map('map', {
        center: [30, 20],
        zoom: 3,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false
      })

      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map)

      this.map.on('resize', () => {
        this.map.invalidateSize()
      })

      window.addEventListener('resize', () => {
        this.map.invalidateSize()
      })
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

  function updateYearDisplay(year) {
    dom.yearDisplay.textContent = formatYear(year)
  }

  const EventPanel = {
    showEvents(year, yearData) {
      const listYear = document.getElementById('event-list-year')
      const listCount = document.getElementById('event-list-count')
      const listBody = document.getElementById('event-list-body')

      const events = yearData.events
      const dynastiesData = yearData.dynasties

      if (listYear) listYear.textContent = formatYear(year)
      if (listCount) listCount.textContent = events && events.length ? `${events.length} 条事件` : ''

      if (!listBody) return

      let html = ''

      if (dynastiesData && dynastiesData.length > 0) {
        html += '<div class="event-region-group"><div class="event-region-title">帝王年号</div>'
        dynastiesData.forEach(r => {
          const color = dynasties.find(d => d.id === r.dynastyId)
          html += `<div class="event-item">
            <span class="event-item-dot" style="background:${color ? color.color : '#888'};"></span>
            <span class="event-item-cat">${r.name || r.dynastyId}</span>
            <span class="event-item-title">${r.ruler} · ${r.era}</span>
          </div>`
        })
        html += '</div>'
      }

      if (!events || events.length === 0) {
        html += '<p style="color:var(--color-text-muted);font-size:12px;padding:8px;">该年份暂无记录事件</p>'
        listBody.innerHTML = html
        return
      }

      const groups = {}
      events.forEach(evt => {
        const region = evt.region || '其他'
        if (!groups[region]) groups[region] = []
        groups[region].push(evt)
      })

      Object.keys(groups).sort().forEach(region => {
        html += `<div class="event-region-group"><div class="event-region-title">${region}</div>`
        groups[region].forEach(evt => {
          html += `<div class="event-item" data-title="${evt.title.replace(/"/g, '&quot;')}">
            <span class="event-item-dot"></span>
            <span class="event-item-cat">${evt.category || '事件'}</span>
            <span class="event-item-title">${evt.title}</span>
          </div>`
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

    dom.calendarContainer.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        CalendarTimeline.dragging = true
        CalendarTimeline.dragStartX = e.touches[0].clientX
        CalendarTimeline.dragStartView = state.viewStartYear
      }
    })
    dom.calendarContainer.addEventListener('touchmove', e => {
      if (!CalendarTimeline.dragging || e.touches.length !== 1) return
      const rect = dom.calendarCanvas.getBoundingClientRect()
      const drawW = rect.width - 16
      const deltaX = CalendarTimeline.dragStartX - e.touches[0].clientX
      const deltaYears = (deltaX / drawW) * YEAR_RANGE
      state.viewStartYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX - YEAR_RANGE / state.pixelsPerYear, CalendarTimeline.dragStartView + deltaYears))
      CalendarTimeline.draw()
    })
    dom.calendarContainer.addEventListener('touchend', () => {
      CalendarTimeline.dragging = false
    })

    document.addEventListener('keydown', e => {
      const key = e.key
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const delta = key === 'ArrowRight' ? step : -step
        const newYear = Math.max(YEAR_MIN, Math.min(YEAR_MAX, state.currentYear + delta))
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
  }

  function setupSubscriptions() {
    on('dynastySelected', dynasty => {
      state.currentYear = dynasty.start
      updateYearDisplay(dynasty.start)
      CalendarTimeline.animateScrollToYear(dynasty.start)
      CalendarTimeline.draw()
      loadAndShowEvents(dynasty.start)
    })

    on('yearChanged', year => {
      updateYearDisplay(year)
      loadAndShowEvents(year)
      const activeDynasty = dynasties.find(d => year >= d.start && year <= d.end)
      if (activeDynasty) {
        state.selectedDynasty = activeDynasty.id
      }
      DynastyTimeline.draw()
    })

    on('eventSelected', evt => {
      dom.eventTitle.textContent = evt.title
      dom.eventYear.textContent = formatYear(evt.year)
      dom.eventCategory.textContent = evt.category || '历史事件'
      dom.eventRegion.textContent = evt.region || ''
      dom.eventDesc.textContent = evt.description
      dom.eventPanel.classList.remove('hidden')
    })
  }

  async function init() {
    cacheDom()
    setupEventListeners()
    setupSubscriptions()
    MapView.init()

    DynastyTimeline.resize()
    CalendarTimeline.resize()

    updateYearDisplay(state.currentYear)
    await loadAndShowEvents(state.currentYear)
  }

  return { init, dynasties, state, formatYear }
})()

document.addEventListener('DOMContentLoaded', () => {
  App.init()
})