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
const BAR_GAP = 1
const MINIMAP_H = 14
const LABEL_H = 14
const MIN_VIEW_SPAN = 5
const CLICK_THRESHOLD = 4
const ZOOM_FACTOR = 0.15

// ─── Component ──────────────────────────────────────────────────────

export class Timeline extends Component<TimelineProps> {
  private canvas!: HTMLCanvasElement
  private tooltip!: HTMLElement
  private yearCounts: Map<number, number> = new Map()

  // Full data bounds
  private dataFrom = 1900
  private dataTo = 2024

  // Visible viewport
  private viewFrom = 1900
  private viewTo = 2024

  // Active (loaded) range highlight
  private activeFrom = 0
  private activeTo = 0

  // Interaction state
  private hoverYear: number | null = null
  private isPanning = false
  private panStartX = 0
  private panStartViewFrom = 0
  private panStartViewTo = 0
  private panTotalDelta = 0
  private mounted = false

  protected create(): HTMLElement {
    this.canvas = document.createElement('canvas')
    this.canvas.className = cx.canvas

    this.tooltip = h('div', { className: cx.tooltip })
    this.tooltip.style.display = 'none'

    const wrapper = h('div', { className: cx.root },
      this.canvas,
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
    this.dataFrom = from
    this.dataTo = to
    this.viewFrom = from
    this.viewTo = to
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
    this.dataFrom = availableFrom
    this.dataTo = availableTo
    this.viewFrom = availableFrom
    this.viewTo = availableTo
    this.scheduleDraw()
  }

  /**
   * Set year counts directly from manifest data (shows ALL years).
   */
  setManifestCounts(counts: Map<number, number>, availableFrom: number, availableTo: number): void {
    this.yearCounts = new Map(counts)
    this.dataFrom = availableFrom
    this.dataTo = availableTo
    // Default view: show most recent 150 years or full range if smaller
    const span = availableTo - availableFrom
    if (span > 150) {
      this.viewFrom = availableTo - 150
      this.viewTo = availableTo
    } else {
      this.viewFrom = availableFrom
      this.viewTo = availableTo
    }
    this.scheduleDraw()
  }

  // ─── Canvas sizing ─────────────────────────────────────────────

  private syncCanvasSize(): void {
    const rect = this.el.getBoundingClientRect()
    if (rect.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(rect.width)
    const hPx = Math.round(rect.height)
    if (this.canvas.width !== w * dpr || this.canvas.height !== hPx * dpr) {
      this.canvas.width = w * dpr
      this.canvas.height = hPx * dpr
      this.canvas.style.width = w + 'px'
      this.canvas.style.height = hPx + 'px'
    }
  }

  private scheduleDraw(): void {
    if (!this.mounted) return
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

    this.drawBars(ctx, w, cH)
    this.drawMinimap(ctx, w, cH)
  }

  private drawBars(ctx: CanvasRenderingContext2D, w: number, cH: number): void {
    const barArea = cH - MINIMAP_H - LABEL_H - 4
    const viewSpan = this.viewTo - this.viewFrom + 1
    if (viewSpan <= 0) return

    const barW = Math.max(1, (w - viewSpan * BAR_GAP) / viewSpan)
    const barMaxH = barArea - 4

    // Find max count in visible range for scaling
    let maxCount = 0
    for (let y = this.viewFrom; y <= this.viewTo; y++) {
      const c = this.yearCounts.get(y) || 0
      if (c > maxCount) maxCount = c
    }

    if (maxCount === 0) {
      ctx.fillStyle = palette.white15
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No data for this range', w / 2, barArea / 2)
      return
    }

    for (let i = 0; i < viewSpan; i++) {
      const year = this.viewFrom + i
      const count = this.yearCounts.get(year) || 0
      const x = i * (barW + BAR_GAP)
      const barH = count > 0
        ? BAR_MIN_H + (count / maxCount) * (barMaxH - BAR_MIN_H)
        : 0

      const isActive = year >= this.activeFrom && year <= this.activeTo
      const isHovered = year === this.hoverYear

      // Active range background
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

      // Year labels (sparse to avoid overlap)
      const labelEvery = this.labelInterval(viewSpan, barW)
      if (labelEvery > 0 && (year % labelEvery === 0 || i === 0 || i === viewSpan - 1)) {
        ctx.fillStyle = isActive ? palette.green500_50 : palette.white20
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        const label = viewSpan > 200 ? String(year) : String(year).slice(-2)
        ctx.fillText(label, x + barW / 2, barArea + LABEL_H - 2)
      }
    }
  }

  /** Decide how often to show a year label based on available space. */
  private labelInterval(viewSpan: number, barW: number): number {
    const pixelsPerLabel = barW + BAR_GAP
    if (pixelsPerLabel >= 28) return 1
    if (pixelsPerLabel >= 14) return 2
    if (pixelsPerLabel >= 7) return 5
    if (viewSpan <= 50) return 5
    if (viewSpan <= 150) return 10
    if (viewSpan <= 500) return 25
    if (viewSpan <= 1000) return 50
    return 100
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, cH: number): void {
    const y0 = cH - MINIMAP_H
    const dataSpan = this.dataTo - this.dataFrom + 1
    if (dataSpan <= 0) return

    // Background
    ctx.fillStyle = palette.white08
    ctx.fillRect(0, y0, w, MINIMAP_H)

    // Data density (tiny bars)
    let maxCount = 0
    for (const c of this.yearCounts.values()) {
      if (c > maxCount) maxCount = c
    }

    if (maxCount > 0) {
      for (const [year, count] of this.yearCounts) {
        if (year < this.dataFrom || year > this.dataTo) continue
        const frac = (year - this.dataFrom) / dataSpan
        const x = frac * w
        const bh = 2 + (count / maxCount) * (MINIMAP_H - 4)
        ctx.fillStyle = palette.green500_20
        ctx.fillRect(x, y0 + MINIMAP_H - bh, Math.max(1, w / dataSpan), bh)
      }
    }

    // Viewport indicator
    const vStart = ((this.viewFrom - this.dataFrom) / dataSpan) * w
    const vEnd = ((this.viewTo - this.dataFrom + 1) / dataSpan) * w
    const vW = Math.max(4, vEnd - vStart)

    ctx.fillStyle = palette.green400_30
    ctx.fillRect(vStart, y0, vW, MINIMAP_H)

    ctx.strokeStyle = palette.green400_70
    ctx.lineWidth = 1
    ctx.strokeRect(vStart + 0.5, y0 + 0.5, vW - 1, MINIMAP_H - 1)

    // Edge year labels on minimap
    ctx.fillStyle = palette.white20
    ctx.font = '8px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(String(this.dataFrom), 2, y0 + MINIMAP_H - 3)
    ctx.textAlign = 'right'
    ctx.fillText(String(this.dataTo), w - 2, y0 + MINIMAP_H - 3)
  }

  // ─── Zoom / Pan ───────────────────────────────────────────────

  private zoom(centerX: number, delta: number): void {
    const rect = this.canvas.getBoundingClientRect()
    const frac = centerX / rect.width
    const viewSpan = this.viewTo - this.viewFrom + 1
    const dataSpan = this.dataTo - this.dataFrom + 1

    const change = Math.max(1, Math.round(viewSpan * ZOOM_FACTOR)) * Math.sign(delta)
    const leftChange = Math.round(change * frac)
    const rightChange = change - leftChange

    let newFrom = this.viewFrom + leftChange
    let newTo = this.viewTo - rightChange

    // Enforce min span
    if (newTo - newFrom + 1 < MIN_VIEW_SPAN) {
      const mid = Math.round((newFrom + newTo) / 2)
      newFrom = mid - Math.floor(MIN_VIEW_SPAN / 2)
      newTo = newFrom + MIN_VIEW_SPAN - 1
    }

    // Enforce max span (full data range)
    if (newTo - newFrom + 1 > dataSpan) {
      newFrom = this.dataFrom
      newTo = this.dataTo
    }

    // Clamp to data bounds
    if (newFrom < this.dataFrom) {
      newTo += this.dataFrom - newFrom
      newFrom = this.dataFrom
    }
    if (newTo > this.dataTo) {
      newFrom -= newTo - this.dataTo
      newTo = this.dataTo
    }
    newFrom = Math.max(newFrom, this.dataFrom)
    newTo = Math.min(newTo, this.dataTo)

    this.viewFrom = newFrom
    this.viewTo = newTo
    this.scheduleDraw()
  }

  private pan(deltaYears: number): void {
    const viewSpan = this.viewTo - this.viewFrom
    let newFrom = this.viewFrom + deltaYears
    let newTo = this.viewTo + deltaYears

    if (newFrom < this.dataFrom) {
      newFrom = this.dataFrom
      newTo = newFrom + viewSpan
    }
    if (newTo > this.dataTo) {
      newTo = this.dataTo
      newFrom = newTo - viewSpan
    }

    this.viewFrom = Math.max(newFrom, this.dataFrom)
    this.viewTo = Math.min(newTo, this.dataTo)
    this.scheduleDraw()
  }

  // ─── Events ───────────────────────────────────────────────────

  private yearFromX(clientX: number): number | null {
    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const viewSpan = this.viewTo - this.viewFrom + 1
    if (viewSpan <= 0) return null
    const barW = rect.width / viewSpan
    const idx = Math.floor(x / barW)
    if (idx < 0 || idx >= viewSpan) return null
    return this.viewFrom + idx
  }

  private bindEvents(): void {
    // ── Wheel: zoom ──────────────────────────────────────────────
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      this.zoom(x, e.deltaY)
    }, { passive: false })

    // ── Mouse: pan + click ──────────────────────────────────────
    this.canvas.addEventListener('mousedown', (e) => {
      this.isPanning = true
      this.panStartX = e.clientX
      this.panStartViewFrom = this.viewFrom
      this.panStartViewTo = this.viewTo
      this.panTotalDelta = 0
      this.canvas.style.cursor = 'grabbing'
    })

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStartX
        this.panTotalDelta = Math.abs(dx)
        const rect = this.canvas.getBoundingClientRect()
        const viewSpan = this.panStartViewTo - this.panStartViewFrom + 1
        const yearsPerPx = viewSpan / rect.width
        const deltaYears = Math.round(-dx * yearsPerPx)

        const viewSpanConst = this.panStartViewTo - this.panStartViewFrom
        let newFrom = this.panStartViewFrom + deltaYears
        let newTo = this.panStartViewTo + deltaYears

        if (newFrom < this.dataFrom) {
          newFrom = this.dataFrom
          newTo = newFrom + viewSpanConst
        }
        if (newTo > this.dataTo) {
          newTo = this.dataTo
          newFrom = newTo - viewSpanConst
        }

        this.viewFrom = Math.max(newFrom, this.dataFrom)
        this.viewTo = Math.min(newTo, this.dataTo)
        this.scheduleDraw()
      } else {
        const year = this.yearFromX(e.clientX)
        if (year !== this.hoverYear) {
          this.hoverYear = year
          this.draw()
          this.updateTooltip(e, year)
        }
      }
    })

    const endPan = (e: MouseEvent) => {
      if (!this.isPanning) return
      this.isPanning = false
      this.canvas.style.cursor = ''

      // If barely moved, treat as click
      if (this.panTotalDelta < CLICK_THRESHOLD) {
        const year = this.yearFromX(e.clientX)
        if (year != null && this.props.onRangeSelect) {
          this.props.onRangeSelect(year, year)
        }
      }
    }

    this.canvas.addEventListener('mouseup', endPan)
    this.canvas.addEventListener('mouseleave', (e) => {
      if (this.isPanning) endPan(e)
      this.hoverYear = null
      this.tooltip.style.display = 'none'
      this.draw()
    })

    // ── Touch: pan + pinch zoom ─────────────────────────────────
    let lastTouchX = 0
    let lastPinchDist = 0
    let touchCount = 0

    this.canvas.addEventListener('touchstart', (e) => {
      touchCount = e.touches.length
      if (touchCount === 1) {
        this.isPanning = true
        lastTouchX = e.touches[0].clientX
        this.panStartViewFrom = this.viewFrom
        this.panStartViewTo = this.viewTo
        this.panTotalDelta = 0
      } else if (touchCount === 2) {
        this.isPanning = false
        lastPinchDist = Math.abs(e.touches[0].clientX - e.touches[1].clientX)
      }
    }, { passive: true })

    this.canvas.addEventListener('touchmove', (e) => {
      if (touchCount === 1 && this.isPanning) {
        const dx = e.touches[0].clientX - lastTouchX
        this.panTotalDelta += Math.abs(dx)
        const rect = this.canvas.getBoundingClientRect()
        const viewSpan = this.viewTo - this.viewFrom + 1
        const yearsPerPx = viewSpan / rect.width
        this.pan(Math.round(-dx * yearsPerPx))
        lastTouchX = e.touches[0].clientX
      } else if (touchCount === 2 && e.touches.length === 2) {
        const dist = Math.abs(e.touches[0].clientX - e.touches[1].clientX)
        const delta = lastPinchDist - dist
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const rect = this.canvas.getBoundingClientRect()
        this.zoom(midX - rect.left, delta)
        lastPinchDist = dist
      }
    }, { passive: true })

    this.canvas.addEventListener('touchend', (e) => {
      if (touchCount === 1 && this.panTotalDelta < CLICK_THRESHOLD * 2) {
        const year = this.yearFromX(lastTouchX)
        if (year != null && this.props.onRangeSelect) {
          this.props.onRangeSelect(year, year)
        }
      }
      this.isPanning = false
      touchCount = e.touches.length
    }, { passive: true })
  }

  private updateTooltip(e: MouseEvent, year: number | null): void {
    if (year == null || this.isPanning) {
      this.tooltip.style.display = 'none'
      return
    }
    const count = this.yearCounts.get(year) || 0
    this.tooltip.textContent = `${year}: ${count.toLocaleString()} sightings`
    this.tooltip.style.display = 'block'

    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    this.tooltip.style.left = `${Math.min(x, rect.width - 140)}px`
  }
}
