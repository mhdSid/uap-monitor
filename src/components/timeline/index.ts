import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { palette } from '@/styles/palette'
import type { Sighting } from '@/types'

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
const THUMB_MIN_W = 48 // minimum thumb width — comfortably tappable

// ─── Component ──────────────────────────────────────────────────────

export class Timeline extends Component<TimelineProps> {
  private scroller!: HTMLElement
  private canvas!: HTMLCanvasElement
  private tooltip!: HTMLElement

  // Custom scrollbar
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

  // Thumb drag state
  private isDragging = false
  private dragStartX = 0
  private dragStartScroll = 0

  protected create(): HTMLElement {
    this.canvas = document.createElement('canvas')
    this.canvas.className = cx.canvas

    this.tooltip = h('div', { className: cx.tooltip })
    this.tooltip.style.display = 'none'

    this.scroller = h('div', { className: cx.scroller }, this.canvas)

    this.scrollThumb = h('div', { className: cx.scrollThumb })
    this.scrollTrack = h('div', { className: cx.scrollTrack }, this.scrollThumb)

    const wrapper = h('div', { className: cx.root },
      this.scroller,
      this.scrollTrack,
      this.tooltip
    )

    this.bindEvents()
    return wrapper
  }

  protected didMount(): void {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          this.mounted = true
          this.resize()
        }
      }
    })
    ro.observe(this.el)
  }

  // ─── Public API ─────────────────────────────────────────────────

  setSightings(sightings: Sighting[]): void {
    this.yearCounts.clear()
    for (const s of sightings) {
      const y = parseInt(s.occurredAt?.slice(0, 4), 10)
      if (!isNaN(y)) this.yearCounts.set(y, (this.yearCounts.get(y) || 0) + 1)
    }
    this.resize()
  }

  setYearRange(from: number, to: number): void {
    this.dataFrom = from
    this.dataTo = to
    this.resize()
  }

  setActiveRange(from: number, to: number): void {
    this.activeFrom = from
    this.activeTo = to
    this.draw()
    this.scrollToRange(from, to)
  }

  setAllSightings(sightings: Sighting[], availableFrom: number, availableTo: number): void {
    this.yearCounts.clear()
    for (const s of sightings) {
      const y = parseInt(s.occurredAt?.slice(0, 4), 10)
      if (!isNaN(y)) this.yearCounts.set(y, (this.yearCounts.get(y) || 0) + 1)
    }
    this.dataFrom = availableFrom
    this.dataTo = availableTo
    this.resize()
  }

  setManifestCounts(counts: Map<number, number>, availableFrom: number, availableTo: number): void {
    this.yearCounts = new Map(counts)
    this.dataFrom = availableFrom
    this.dataTo = availableTo
    this.resize()
  }

  // ─── Layout ───────────────────────────────────────────────────

  private resize(): void {
    if (!this.mounted) return

    const yearSpan = this.dataTo - this.dataFrom + 1
    const totalW = PAD_X * 2 + yearSpan * BAR_STEP
    const containerH = Math.max(120, Math.floor(this.el.getBoundingClientRect().height))
    const trackH = this.scrollTrack.getBoundingClientRect().height || 14
    const canvasH = containerH - trackH

    this.canvasW = totalW
    this.canvasH = canvasH

    const dpr = window.devicePixelRatio || 1
    this.canvas.width = totalW * dpr
    this.canvas.height = canvasH * dpr
    this.canvas.style.width = totalW + 'px'
    this.canvas.style.height = canvasH + 'px'

    this.syncThumb()
    this.draw()

    if (this.activeFrom > 0) {
      this.scrollToRange(this.activeFrom, this.activeTo)
    }
  }

  private scrollToRange(from: number, to: number): void {
    const midYear = Math.floor((from + to) / 2)
    const x = PAD_X + (midYear - this.dataFrom) * BAR_STEP
    const viewW = this.scroller.clientWidth
    this.scroller.scrollLeft = Math.max(0, x - viewW / 2)
  }

  // ─── Custom scrollbar ────────────────────────────────────────

  private syncThumb(): void {
    const scrollW = this.scroller.scrollWidth
    const clientW = this.scroller.clientWidth
    if (scrollW <= clientW) {
      this.scrollTrack.style.display = 'none'
      return
    }
    this.scrollTrack.style.display = ''

    const trackW = this.scrollTrack.clientWidth
    const ratio = clientW / scrollW
    const thumbW = Math.max(THUMB_MIN_W, Math.round(ratio * trackW))
    const maxScroll = scrollW - clientW
    const scrollFrac = maxScroll > 0 ? this.scroller.scrollLeft / maxScroll : 0
    const thumbX = Math.round(scrollFrac * (trackW - thumbW))

    this.scrollThumb.style.width = thumbW + 'px'
    this.scrollThumb.style.transform = `translateX(${thumbX}px)`
  }

  private scrollFromThumbX(trackClientX: number): void {
    const trackRect = this.scrollTrack.getBoundingClientRect()
    const trackW = trackRect.width
    const thumbW = this.scrollThumb.offsetWidth
    const x = trackClientX - trackRect.left - thumbW / 2
    const maxThumbX = trackW - thumbW
    const frac = Math.max(0, Math.min(1, x / maxThumbX))
    const maxScroll = this.scroller.scrollWidth - this.scroller.clientWidth
    this.scroller.scrollLeft = Math.round(frac * maxScroll)
  }

  // ─── Drawing ──────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = this.canvasW
    const cH = this.canvasH

    if (w <= 0 || cH <= 0) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, cH)

    const yearSpan = this.dataTo - this.dataFrom + 1
    if (yearSpan <= 0) return

    const barArea = cH - LABEL_H

    // Max count for scaling
    let maxCount = 0
    for (let y = this.dataFrom; y <= this.dataTo; y++) {
      const c = this.yearCounts.get(y) || 0
      if (c > maxCount) maxCount = c
    }

    if (maxCount === 0) {
      ctx.fillStyle = palette.white15
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No data for this range', w / 2, cH / 2)
      return
    }

    const barMaxH = barArea - 8
    const labelEvery = this.labelInterval(yearSpan)

    for (let i = 0; i < yearSpan; i++) {
      const year = this.dataFrom + i
      const count = this.yearCounts.get(year) || 0
      const x = PAD_X + i * BAR_STEP

      const isActive = year >= this.activeFrom && year <= this.activeTo
      const isHovered = year === this.hoverYear
      const barH = count > 0
        ? BAR_MIN_H + (count / maxCount) * (barMaxH - BAR_MIN_H)
        : 0

      // Active range band
      if (isActive) {
        ctx.fillStyle = isHovered ? palette.green400_30 : palette.green400_08
        ctx.fillRect(x - 1, 0, BAR_STEP, barArea)
      }

      // Bar (rounded top)
      if (barH > 0) {
        ctx.fillStyle = isHovered
          ? (isActive ? palette.green400 : palette.amber500_90)
          : (isActive ? palette.green400_70 : palette.amber500_40)

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

      // Year labels
      const showLabel = (year % labelEvery === 0) || i === 0 || i === yearSpan - 1
      if (showLabel) {
        ctx.fillStyle = isActive ? palette.green500_50 : palette.white20
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(year), x + BAR_W / 2, cH - 3)
      }
    }
  }

  private labelInterval(yearSpan: number): number {
    if (yearSpan <= 50) return 5
    if (yearSpan <= 200) return 10
    if (yearSpan <= 500) return 25
    if (yearSpan <= 1000) return 50
    return 100
  }

  // ─── Events ───────────────────────────────────────────────────

  private yearFromX(clientX: number): number | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const idx = Math.floor((x - PAD_X) / BAR_STEP)
    const yearSpan = this.dataTo - this.dataFrom + 1
    if (idx < 0 || idx >= yearSpan) return null
    return this.dataFrom + idx
  }

  private bindEvents(): void {
    // ── Scroller → sync thumb ────────────────────────────────────
    this.scroller.addEventListener('scroll', () => {
      if (!this.isDragging) this.syncThumb()
    }, { passive: true })

    // ── Hover (desktop) ──────────────────────────────────────────
    this.canvas.addEventListener('mousemove', (e) => {
      const year = this.yearFromX(e.clientX)
      if (year !== this.hoverYear) {
        this.hoverYear = year
        this.draw()
        this.showTooltip(e.clientX, year)
      }
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverYear = null
      this.tooltip.style.display = 'none'
      this.draw()
    })

    // ── Click bar (desktop) ──────────────────────────────────────
    this.canvas.addEventListener('click', (e) => {
      const year = this.yearFromX(e.clientX)
      if (year != null && this.props.onRangeSelect) {
        this.props.onRangeSelect(year, year)
      }
    })

    // ── Tap bar (mobile) — distinguish scroll from tap ───────────
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
      const year = this.yearFromX(touch.clientX)
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
      this.scrollThumb.classList.add(cx.scrollThumbActive)
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
      this.scrollThumb.classList.remove(cx.scrollThumbActive)
    })

    // ── Thumb drag (touch) ───────────────────────────────────────
    this.scrollThumb.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      this.isDragging = true
      this.dragStartX = e.touches[0].clientX
      this.dragStartScroll = this.scroller.scrollLeft
      this.scrollThumb.classList.add(cx.scrollThumbActive)
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
      this.scrollThumb.classList.remove(cx.scrollThumbActive)
    })

    // ── Track click (jump to position) ───────────────────────────
    this.scrollTrack.addEventListener('click', (e) => {
      if (e.target === this.scrollThumb) return
      this.scrollFromThumbX(e.clientX)
      this.syncThumb()
    })
  }

  private showTooltip(clientX: number, year: number | null): void {
    if (year == null) {
      this.tooltip.style.display = 'none'
      return
    }
    const count = this.yearCounts.get(year) || 0
    this.tooltip.textContent = `${year}: ${count.toLocaleString()} sightings`
    this.tooltip.style.display = 'block'

    const rootRect = this.el.getBoundingClientRect()
    const x = clientX - rootRect.left
    const tooltipW = 140
    this.tooltip.style.left = `${Math.max(4, Math.min(x - tooltipW / 2, rootRect.width - tooltipW - 4))}px`
  }
}
