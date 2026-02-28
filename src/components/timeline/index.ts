import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { palette } from '@/styles/palette'
import type { Sighting } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────

export interface TimelineProps {
  onYearClick?: (year: number) => void
  onRangeSelect?: (from: number, to: number) => void
}

// ─── Constants ──────────────────────────────────────────────────────

const BAR_MIN_H = 2
const BAR_MAX_H = 80
const BAR_GAP = 1
const TIMELINE_H = 110

// ─── Component ──────────────────────────────────────────────────────

export class Timeline extends Component<TimelineProps> {
  private canvas!: HTMLCanvasElement
  private tooltip!: HTMLElement
  private yearCounts: Map<number, number> = new Map()
  private minYear = 1900
  private maxYear = 2024
  private activeFrom = 0
  private activeTo = 0
  private hoverYear: number | null = null
  private isDragging = false
  private dragStart = 0
  private mounted = false
  private pendingDraw = false

  protected create(): HTMLElement {
    this.canvas = document.createElement('canvas')
    this.canvas.className = cx.canvas

    this.tooltip = h('div', { className: cx.tooltip })
    this.tooltip.style.display = 'none'

    const wrapper = h('div', { className: cx.root },
      this.canvas,
      this.tooltip,
    )

    this.bindEvents()
    return wrapper
  }

  protected didMount(): void {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          this.mounted = true
          this.syncCanvasSize()
          this.draw()
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
    this.scheduleDraw()
  }

  setYearRange(from: number, to: number): void {
    this.minYear = from
    this.maxYear = to
    this.scheduleDraw()
  }

  setActiveRange(from: number, to: number): void {
    this.activeFrom = from
    this.activeTo = to
    this.scheduleDraw()
  }

  setAllSightings(sightings: Sighting[], availableFrom: number, availableTo: number): void {
    this.yearCounts.clear()
    for (const s of sightings) {
      const y = parseInt(s.occurredAt?.slice(0, 4), 10)
      if (!isNaN(y)) this.yearCounts.set(y, (this.yearCounts.get(y) || 0) + 1)
    }
    this.minYear = Math.max(availableFrom, 1900)
    this.maxYear = availableTo
    this.scheduleDraw()
  }

  /**
   * Set year counts directly from manifest data (shows ALL years, not just loaded range).
   */
  setManifestCounts(counts: Map<number, number>, availableFrom: number, availableTo: number): void {
    this.yearCounts = new Map(counts)
    this.minYear = Math.max(availableFrom, 1900)
    this.maxYear = availableTo
    this.scheduleDraw()
  }

  // ─── Canvas sizing ─────────────────────────────────────────────

  private syncCanvasSize(): void {
    const rect = this.el.getBoundingClientRect()
    if (rect.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(rect.width)
    const hPx = TIMELINE_H
    // Only update if dimensions actually changed
    if (this.canvas.width !== w * dpr || this.canvas.height !== hPx * dpr) {
      this.canvas.width = w * dpr
      this.canvas.height = hPx * dpr
      this.canvas.style.width = w + 'px'
      this.canvas.style.height = hPx + 'px'
    }
  }

  private scheduleDraw(): void {
    if (!this.mounted) {
      this.pendingDraw = true
      return
    }
    this.syncCanvasSize()
    this.draw()
  }

  // ─── Drawing ──────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = this.canvas.width / dpr
    const cH = this.canvas.height / dpr

    if (w <= 0 || cH <= 0) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, cH)

    const yearSpan = this.maxYear - this.minYear + 1
    if (yearSpan <= 0) return

    const barW = Math.max(1, (w - yearSpan * BAR_GAP) / yearSpan)

    // Find max count for scaling
    let maxCount = 0
    for (let y = this.minYear; y <= this.maxYear; y++) {
      const c = this.yearCounts.get(y) || 0
      if (c > maxCount) maxCount = c
    }
    if (maxCount === 0) {
      // Draw empty state hint
      ctx.fillStyle = palette.white15
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No data for this range', w / 2, cH / 2)
      return
    }

    const barArea = cH - 16 // Reserve space for year labels

    for (let i = 0; i < yearSpan; i++) {
      const year = this.minYear + i
      const count = this.yearCounts.get(year) || 0
      const x = i * (barW + BAR_GAP)
      const barH = count > 0 ? BAR_MIN_H + (count / maxCount) * (Math.min(barArea, BAR_MAX_H) - BAR_MIN_H) : 0

      // Active range highlight
      const isActive = year >= this.activeFrom && year <= this.activeTo
      const isHovered = year === this.hoverYear

      if (isActive) {
        ctx.fillStyle = isHovered ? palette.green400_30 : palette.green400_08
        ctx.fillRect(x, 0, barW + BAR_GAP, barArea)
      }

      // Bar
      if (barH > 0) {
        ctx.fillStyle = isActive
          ? (isHovered ? palette.green400 : palette.green400_70)
          : (isHovered ? palette.amber500_90 : palette.amber500_40)
        ctx.fillRect(x, barArea - barH, barW, barH)
      }

      // Year labels (sparse)
      if (yearSpan <= 30 || i % Math.ceil(yearSpan / 20) === 0) {
        ctx.fillStyle = isActive ? palette.green500_50 : palette.white20
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(year).slice(-2), x + barW / 2, cH - 3)
      }
    }
  }

  // ─── Events ───────────────────────────────────────────────────

  private yearFromX(clientX: number): number | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const yearSpan = this.maxYear - this.minYear + 1
    if (yearSpan <= 0) return null
    const barW = rect.width / yearSpan
    const idx = Math.floor(x / barW)
    if (idx < 0 || idx >= yearSpan) return null
    return this.minYear + idx
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', (e) => {
      const year = this.yearFromX(e.clientX)
      if (year !== this.hoverYear) {
        this.hoverYear = year
        this.draw()
        this.updateTooltip(e, year)
      }
    })

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverYear = null
      this.tooltip.style.display = 'none'
      this.draw()
    })

    this.canvas.addEventListener('mousedown', (e) => {
      const year = this.yearFromX(e.clientX)
      if (year != null) {
        this.isDragging = true
        this.dragStart = year
      }
    })

    this.canvas.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return
      this.isDragging = false
      const year = this.yearFromX(e.clientX)
      if (year != null) {
        const from = Math.min(this.dragStart, year)
        const to = Math.max(this.dragStart, year)
        if (this.props.onRangeSelect) {
          this.props.onRangeSelect(from, to)
        } else if (this.props.onYearClick) {
          this.props.onYearClick(year)
        }
      }
    })

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0]
      const year = this.yearFromX(touch.clientX)
      if (year != null) {
        this.isDragging = true
        this.dragStart = year
      }
    }, { passive: true })

    this.canvas.addEventListener('touchend', (e) => {
      if (!this.isDragging) return
      this.isDragging = false
      const touch = e.changedTouches[0]
      const year = this.yearFromX(touch.clientX)
      if (year != null) {
        const from = Math.min(this.dragStart, year)
        const to = Math.max(this.dragStart, year)
        if (this.props.onRangeSelect) this.props.onRangeSelect(from, to)
      }
    }, { passive: true })
  }

  private updateTooltip(e: MouseEvent, year: number | null): void {
    if (year == null) {
      this.tooltip.style.display = 'none'
      return
    }
    const count = this.yearCounts.get(year) || 0
    this.tooltip.textContent = `${year}: ${count.toLocaleString()} sightings`
    this.tooltip.style.display = 'block'

    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    this.tooltip.style.left = `${Math.min(x, rect.width - 120)}px`
  }
}
