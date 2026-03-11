import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, el, hide, show, addClass, removeClass, setStyles, setText } from '@/utils/dom'
import { palette } from '@/styles/palette'
import type { Sighting } from '@/types'
import { useTheme } from '@/composables'

// ─── Types ──────────────────────────────────────────────────────────

export interface TimelineProps {
  onRangeSelect?: (from: number, to: number) => void
}

// ─── Constants ──────────────────────────────────────────────────────

const BAR_W = 10
const BAR_GAP = 2
const BAR_STEP = BAR_W + BAR_GAP
const BAR_MIN_H = 3
const BAR_RADIUS = 2
const LABEL_H = 16
const PAD_X = 8
const THUMB_MIN_W = 48

// ─── Component ──────────────────────────────────────────────────────

export class Timeline extends Component<TimelineProps> {
  private scroller!: HTMLElement
  private canvas!: HTMLCanvasElement
  private hoverBar!: HTMLElement
  private tooltip!: HTMLElement
  private loaderEl!: HTMLElement

  private scrollTrack!: HTMLElement
  private scrollThumb!: HTMLElement

  private yearCounts: Map<number, number> = new Map()
  private dataFrom = 1900
  private dataTo = 2024
  private activeFrom = 0
  private activeTo = 0
  private hoverYear: number | null = null
  private mounted = false
  private canvasW = 0
  private canvasH = 0

  // Thumb drag
  private isDragging = false
  private dragStartX = 0
  private dragStartScroll = 0

  // Perf: cached values — zero DOM queries on hover
  private maxCount = 0
  private barHeights!: Float32Array    // pre-computed bar pixel heights
  private scrollerLeft = 0             // cached scroller.getBoundingClientRect().left
  private rootLeft = 0                 // cached root rect left
  private rootWidth = 0                // cached root rect width
  private barArea = 0                  // cached bar drawing area height

  protected create (): HTMLElement {
    this.canvas = el('canvas', { className: cx.canvas })
    // Prevent broken canvas icon on mobile before first resize
    this.canvas.width = 1
    this.canvas.height = 1
    setStyles(this.canvas, { visibility: 'hidden' })

    this.hoverBar = h('div', { className: cx.hoverBar })

    this.tooltip = h('div', { className: cx.tooltip })
    hide(this.tooltip)

    this.loaderEl = h('div', { className: cx.loader })
    hide(this.loaderEl)

    this.scroller = h('div', { className: cx.scroller },
      this.canvas,
      this.hoverBar
    )

    this.scrollThumb = h('div', { className: cx.scrollThumb })
    this.scrollTrack = h('div', { className: cx.scrollTrack }, this.scrollThumb)

    const wrapper = h('div', { className: cx.root },
      this.scroller,
      this.scrollTrack,
      this.tooltip,
      this.loaderEl
    )

    this.bindEvents()
    return wrapper
  }

  protected didMount (): void {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          this.mounted = true
          this.resize()
        }
      }
    })
    ro.observe(this.el)
  }

  destroy (): void {
    super.destroy()
  }

  // ─── Perf: pre-compute everything data-dependent ──────────────

  private computeMaxCount (): void {
    let max = 0
    for (let y = this.dataFrom; y <= this.dataTo; y++) {
      const c = this.yearCounts.get(y) || 0
      if (c > max) max = c
    }
    this.maxCount = max
  }

  /** Pre-compute pixel heights for every year bar. Called on data/resize. */
  private computeBarHeights (): void {
    const yearSpan = this.dataTo - this.dataFrom + 1
    this.barHeights = new Float32Array(yearSpan)

    if (this.maxCount === 0) return

    const barMaxH = this.barArea - 8
    for (let i = 0; i < yearSpan; i++) {
      const count = this.yearCounts.get(this.dataFrom + i) || 0
      this.barHeights[i] = count > 0
        ? BAR_MIN_H + (count / this.maxCount) * (barMaxH - BAR_MIN_H)
        : 0
    }
  }

  /** Cache layout rects. Called on resize only. */
  private cacheLayout (): void {
    const scrollerRect = this.scroller.getBoundingClientRect()
    this.scrollerLeft = scrollerRect.left

    const rootRect = this.el.getBoundingClientRect()
    this.rootLeft = rootRect.left
    this.rootWidth = rootRect.width
  }

  // ─── Loading overlay ──────────────────────────────────────────

  showLoader (el?: HTMLElement): void {
    setText(this.loaderEl, '')
    if (el) this.loaderEl.appendChild(el)
    show(this.loaderEl)
  }

  hideLoader (): void {
    hide(this.loaderEl)
  }

  // ─── Public API ─────────────────────────────────────────────────

  setSightings (sightings: Sighting[]): void {
    this.yearCounts.clear()
    for (const s of sightings) {
      const y = parseInt(s.occurredAt?.slice(0, 4), 10)
      if (!isNaN(y)) this.yearCounts.set(y, (this.yearCounts.get(y) || 0) + 1)
    }
    this.computeMaxCount()
    this.resize()
  }

  setYearRange (from: number, to: number): void {
    this.dataFrom = from
    this.dataTo = to
    this.computeMaxCount()
    this.resize()
  }

  setActiveRange (from: number, to: number): void {
    this.activeFrom = from
    this.activeTo = to
    this.draw()
    this.scrollToRange(from, to)
  }

  setAllSightings (sightings: Sighting[], availableFrom: number, availableTo: number): void {
    this.yearCounts.clear()
    for (const s of sightings) {
      const y = parseInt(s.occurredAt?.slice(0, 4), 10)
      if (!isNaN(y)) this.yearCounts.set(y, (this.yearCounts.get(y) || 0) + 1)
    }
    this.dataFrom = availableFrom
    this.dataTo = availableTo
    this.computeMaxCount()
    this.resize()
  }

  setManifestCounts (counts: Map<number, number>, availableFrom: number, availableTo: number): void {
    this.yearCounts = new Map(counts)
    this.dataFrom = availableFrom
    this.dataTo = availableTo
    this.computeMaxCount()
    this.resize()
  }

  // ─── Layout ───────────────────────────────────────────────────

  private resize (): void {
    if (!this.mounted) return

    const yearSpan = this.dataTo - this.dataFrom + 1
    if (yearSpan <= 0) return

    const totalW = PAD_X * 2 + yearSpan * BAR_STEP
    const containerH = Math.max(120, Math.floor(this.el.getBoundingClientRect().height))
    const trackH = this.scrollTrack.getBoundingClientRect().height || 14
    const canvasH = containerH - trackH

    if (totalW <= 0 || canvasH <= 0) return

    this.canvasW = totalW
    this.canvasH = canvasH
    this.barArea = canvasH - LABEL_H

    const dpr = window.devicePixelRatio || 1

    this.canvas.width = totalW * dpr
    this.canvas.height = canvasH * dpr
    setStyles(this.canvas, { width: totalW + 'px' })
    setStyles(this.canvas, { height: canvasH + 'px' })

    // Set hover bar height to match bar area (exclude labels)
    setStyles(this.hoverBar, { bottom: LABEL_H + 'px' })

    this.computeBarHeights()
    this.cacheLayout()
    this.syncThumb()
    this.draw()

    // Show canvas after first successful draw (hidden until layout resolved)
    if (this.canvas.style.visibility === 'hidden') {
      setStyles(this.canvas, { visibility: 'visible' })
    }

    if (this.activeFrom > 0) {
      this.scrollToRange(this.activeFrom, this.activeTo)
    }
  }

  private scrollToRange (from: number, to: number): void {
    const midYear = Math.floor((from + to) / 2)
    const x = PAD_X + (midYear - this.dataFrom) * BAR_STEP
    const viewW = this.scroller.clientWidth
    this.scroller.scrollLeft = Math.max(0, x - viewW / 2)
  }

  // ─── Custom scrollbar ────────────────────────────────────────

  private syncThumb (): void {
    const scrollW = this.scroller.scrollWidth
    const clientW = this.scroller.clientWidth
    if (scrollW <= clientW) {
      hide(this.scrollTrack)
      return
    }
    show(this.scrollTrack)

    const trackW = this.scrollTrack.clientWidth
    const ratio = clientW / scrollW
    const thumbW = Math.max(THUMB_MIN_W, Math.round(ratio * trackW))
    const maxScroll = scrollW - clientW
    const scrollFrac = maxScroll > 0 ? this.scroller.scrollLeft / maxScroll : 0
    const thumbX = Math.round(scrollFrac * (trackW - thumbW))

    setStyles(this.scrollThumb, { width: thumbW + 'px' })
    setStyles(this.scrollThumb, { transform: `translateX(${thumbX}px)` })
  }

  private scrollFromThumbX (trackClientX: number): void {
    const trackRect = this.scrollTrack.getBoundingClientRect()
    const trackW = trackRect.width
    const thumbW = this.scrollThumb.offsetWidth
    const x = trackClientX - trackRect.left - thumbW / 2
    const maxThumbX = trackW - thumbW
    const frac = Math.max(0, Math.min(1, x / maxThumbX))
    const maxScroll = this.scroller.scrollWidth - this.scroller.clientWidth
    this.scroller.scrollLeft = Math.round(frac * maxScroll)
  }

  // ─── Drawing (canvas — only on data/range change) ─────────────

  /** Force canvas redraw — call on theme change */
  redraw (): void {
    this.draw()
  }

  private draw (): void {
    const ctx = this.canvas.getContext('2d')

    if (!ctx) return

    const w = this.canvasW
    const cH = this.canvasH

    if (w <= 0 || cH <= 0) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, cH)

    const yearSpan = this.dataTo - this.dataFrom + 1
    if (yearSpan <= 0) return

    if (this.maxCount === 0) {
      ctx.fillStyle = palette.white15
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No data for this range', w / 2, cH / 2)
      return
    }

    const barArea = this.barArea
    const labelEvery = this.labelInterval(yearSpan)

    for (let i = 0; i < yearSpan; i++) {
      const year = this.dataFrom + i
      const x = PAD_X + i * BAR_STEP
      const barH = this.barHeights[i]

      const isActive = year >= this.activeFrom && year <= this.activeTo

      const colors = this.getBarColors(isActive)

      if (isActive) {
        ctx.fillStyle = palette.green400_08
        ctx.fillRect(x - 1, 0, BAR_STEP, barArea)
      }

      if (barH > 0) {
        ctx.fillStyle = isActive ? palette.green400_70 : palette.amber500_40
        const by = barArea - barH
        const r = Math.min(BAR_RADIUS, BAR_W / 2, barH / 2)
        ctx.beginPath()
        ctx.moveTo(x, barArea)
        ctx.lineTo(x, by + r)
        ctx.arcTo(x, by, x + r, by, r)
        ctx.arcTo(x + BAR_W, by, x + BAR_W, by + r, r)
        ctx.lineTo(x + BAR_W, barArea)
        ctx.closePath()
        ctx.fill()
      } else if (isActive) {
        ctx.fillStyle = palette.green400_30
        ctx.fillRect(x + 3, barArea - 2, BAR_W - 6, 2)
      }

      const showLabel = (year % labelEvery === 0) || i === 0 || i === yearSpan - 1
      if (showLabel) {
        ctx.fillStyle = colors.year
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(year), x + BAR_W / 2, cH - 3)
      }
    }
  }

  private getBarColors (isActive?: boolean): { year: string, bar: string} {
    const { theme } = useTheme()
    const isLightTheme = theme.get() === 'light'

    const textColorLight = isActive ?  palette.green600_80 : palette.black500_30
    const textColorDark = isActive ? palette.green500_50 : palette.white50

    return {
      year: isLightTheme ? textColorLight : textColorDark,
      bar: isLightTheme ? palette.green400_30 : palette.green600_80
    }
  }

  private labelInterval (yearSpan: number): number {
    if (yearSpan <= 50) return 5
    if (yearSpan <= 200) return 10
    if (yearSpan <= 500) return 25
    if (yearSpan <= 1000) return 50
    return 100
  }

  // ─── Hover (pure DOM — zero canvas work) ──────────────────────

  /**
   * Converts clientX → year index using only cached numbers.
   * Zero DOM queries. Pure arithmetic.
   */
  private yearFromClientX (clientX: number): number | null {
    const x = clientX - this.scrollerLeft + this.scroller.scrollLeft
    const idx = Math.floor((x - PAD_X) / BAR_STEP)
    const yearSpan = this.dataTo - this.dataFrom + 1
    if (idx < 0 || idx >= yearSpan) return null
    return this.dataFrom + idx
  }

  /**
   * Moves the CSS hover-bar div + sets its ::after height.
   * GPU-composited transform — no layout, no paint, no canvas.
   */
  private applyHover (year: number | null, clientX: number): void {
    if (year == null || this.maxCount === 0) {
      hide(this.hoverBar)
      hide(this.tooltip)
      return
    }

    const i = year - this.dataFrom
    const x = PAD_X + i * BAR_STEP
    const barH = this.barHeights[i] || 0
    // const isActive = year >= this.activeFrom && year <= this.activeTo

    // Position the highlight column
    show(this.hoverBar, 'block')
    setStyles(this.hoverBar, { transform: `translateX(${x - 1}px)` })

    // Set bar overlay height + color via CSS custom properties
    this.hoverBar.style.setProperty('--bar-h', barH > 0 ? barH + 'px' : '0px')
    this.hoverBar.style.setProperty('--bar-color', palette.green400_70)

    // Tooltip
    const count = this.yearCounts.get(year) || 0
    setText(this.tooltip, `${year}: ${count.toLocaleString()} sightings`)
    show(this.tooltip, 'block')

    const tx = clientX - this.rootLeft
    const tooltipW = 140
    setStyles(this.tooltip, { left: `${Math.max(4, Math.min(tx - tooltipW / 2, this.rootWidth - tooltipW - 4))}px` })
  }

  // ─── Events ───────────────────────────────────────────────────

  private bindEvents (): void {
    this.scroller.addEventListener('scroll', () => {
      if (!this.isDragging) this.syncThumb()
    }, { passive: true })

    // ── Hover — RAF-coalesced, always reads latest position ──────
    let lastX = 0
    let raf: number | null = null

    this.scroller.addEventListener('mousemove', (e) => {
      lastX = e.clientX
      if (raf !== null) return
      raf = requestAnimationFrame(() => {
        raf = null
        const year = this.yearFromClientX(lastX)
        if (year !== this.hoverYear) {
          this.hoverYear = year
          this.applyHover(year, lastX)
        }
      })
    })

    this.scroller.addEventListener('mouseleave', () => {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null }
      this.hoverYear = null
      hide(this.hoverBar)
      hide(this.tooltip)
    })

    // ── Click ────────────────────────────────────────────────────
    this.scroller.addEventListener('click', (e) => {
      const year = this.yearFromClientX(e.clientX)
      if (year != null && this.props.onRangeSelect) {
        this.props.onRangeSelect(year, year)
      }
    })

    // ── Tap (mobile) ─────────────────────────────────────────────
    let touchMoved = false

    this.scroller.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return
      touchMoved = false
    }, { passive: true })

    this.scroller.addEventListener('touchmove', () => {
      touchMoved = true
    }, { passive: true })

    this.scroller.addEventListener('touchend', (e) => {
      if (touchMoved) return
      const touch = e.changedTouches[0]
      if (!touch) return
      const year = this.yearFromClientX(touch.clientX)
      if (year != null && this.props.onRangeSelect) {
        this.props.onRangeSelect(year, year)
      }
    }, { passive: true })

    // ── Thumb drag (mouse) ───────────────────────────────────────
    this.scrollThumb.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.isDragging = true
      this.dragStartX = e.clientX
      this.dragStartScroll = this.scroller.scrollLeft
      addClass(this.scrollThumb, cx.scrollThumbActive)
    })

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return
      const dx = e.clientX - this.dragStartX
      const trackW = this.scrollTrack.clientWidth
      const thumbW = this.scrollThumb.offsetWidth
      const maxThumbTravel = trackW - thumbW
      if (maxThumbTravel <= 0) return
      const maxScroll = this.scroller.scrollWidth - this.scroller.clientWidth
      const scrollDelta = (dx / maxThumbTravel) * maxScroll
      this.scroller.scrollLeft = Math.max(0, Math.min(maxScroll, this.dragStartScroll + scrollDelta))
      this.syncThumb()
    })

    window.addEventListener('mouseup', () => {
      if (!this.isDragging) return
      this.isDragging = false
      removeClass(this.scrollThumb, cx.scrollThumbActive)
    })

    // ── Thumb drag (touch) ───────────────────────────────────────
    this.scrollThumb.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      this.isDragging = true
      this.dragStartX = e.touches[0].clientX
      this.dragStartScroll = this.scroller.scrollLeft
      addClass(this.scrollThumb, cx.scrollThumbActive)
    })

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - this.dragStartX
      const trackW = this.scrollTrack.clientWidth
      const thumbW = this.scrollThumb.offsetWidth
      const maxThumbTravel = trackW - thumbW
      if (maxThumbTravel <= 0) return
      const maxScroll = this.scroller.scrollWidth - this.scroller.clientWidth
      const scrollDelta = (dx / maxThumbTravel) * maxScroll
      this.scroller.scrollLeft = Math.max(0, Math.min(maxScroll, this.dragStartScroll + scrollDelta))
      this.syncThumb()
    }, { passive: true })

    window.addEventListener('touchend', () => {
      if (!this.isDragging) return
      this.isDragging = false
      removeClass(this.scrollThumb, cx.scrollThumbActive)
    })

    // ── Track click ──────────────────────────────────────────────
    this.scrollTrack.addEventListener('click', (e) => {
      if (e.target === this.scrollThumb) return
      this.scrollFromThumbX(e.clientX)
      this.syncThumb()
    })
  }
}
