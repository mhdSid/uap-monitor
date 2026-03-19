/* ------------------------------------------------------------------ *
 *  GeomagneticView — Kp index vs sighting density visualizer          *
 *                                                                     *
 *  Two canvas charts (theme-aware, same pattern as Timeline):         *
 *    1. Temporal correlation: monthly Kp heatstrip + sighting bars    *
 *    2. Kp distribution: observed vs expected sighting counts by Kp   *
 *                                                                     *
 *  All rendering via <canvas> — zero chart library dependencies.      *
 *  Canvases are wrapped in scroll containers so long datasets         *
 *  (1932–2026) remain fully accessible on small viewports.            *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, el, hide, show, setText, setStyles } from '@/core/dom'
import { palette } from '@/styles/palette'
import { useGeomagnetic, useAppStore, useTheme, yieldThread } from '@/composables'
import { Loader } from '@/components/loader'
import { YearSelector } from '@/components/year-selector'
import { StatCard, createStatValue, createStatSub, StatCardGrid } from '@/components/stat-card'
import { GEOMAGNETIC } from '@/data/strings'
import type { Sighting } from '@/types'

// ─── Canvas constants ───────────────────────────────────────────────

const BAR_GAP = 2
const BAR_MIN_W = 6
const BAR_RADIUS = 2
const LABEL_H = 20
const PAD_TOP = 8
const TIMELINE_H = 200
const DIST_H = 220
const KP_LEVELS = 10
const MIN_KP_GROUP_W = 30

// ─── Responsive helpers ─────────────────────────────────────────────

/** Y-axis label gutter — narrower on small screens */
function getPadX (canvasW: number): number {
  return canvasW < 300 ? 28 : 40
}

// ─── Theme-aware canvas colors (same pattern as Timeline) ───────────

interface CanvasColors {
  text: string
  textStrong: string
  grid: string
  barCalm: string
  barCalmHover: string
  barStorm: string
  barStormHover: string
  barExpected: string
  barOverrep: string
  barNormal: string
  barUnder: string
}

function getCanvasColors (): CanvasColors {
  const { isLightTheme } = useTheme()
  const isLight = isLightTheme()

  return isLight
    ? {
      text: palette.black500_30,
      textStrong: palette.black500_50,
      grid: palette.black_08,
      barCalm: palette.green600_30,
      barCalmHover: palette.green600_70,
      barStorm: palette.red600_70,
      barStormHover: palette.red600,
      barExpected: palette.black_15,
      barOverrep: palette.red600_70,
      barNormal: palette.amber600_70,
      barUnder: palette.green600_70
    }
    : {
      text: palette.white50,
      textStrong: palette.white50,
      grid: palette.white08,
      barCalm: palette.green500_30,
      barCalmHover: palette.green500_70,
      barStorm: palette.red500_70,
      barStormHover: palette.red500,
      barExpected: palette.white15,
      barOverrep: palette.red500_70,
      barNormal: palette.amber500_70,
      barUnder: palette.green400_70
    }
}

// ─── Types ──────────────────────────────────────────────────────────

interface MonthlyBucket {
  label: string
  avgKp: number
  maxKp: number
  sightingCount: number
  stormSightingCount: number
}

// ─── Component ──────────────────────────────────────────────────────

export class GeomagneticView extends Component {
  private loaderEl!: HTMLElement
  private contentEl!: HTMLElement
  private built = false

  // Canvas refs
  private timelineCanvas!: HTMLCanvasElement
  private timelineScrollWrapper!: HTMLElement
  private timelineTooltip!: HTMLElement
  private heatStrip!: HTMLElement
  private distCanvas!: HTMLCanvasElement
  private distScrollWrapper!: HTMLElement
  private distTooltip!: HTMLElement

  // Stat value elements (for re-render)
  private statTotalVal!: HTMLElement
  private statStormVal!: HTMLElement
  private statStormSub!: HTMLElement
  private statAvgVal!: HTMLElement
  private statPeakVal!: HTMLElement
  private statOverrepVal!: HTMLElement

  // Data
  private monthlyData: MonthlyBucket[] = []
  private kpDistObserved: number[] = []
  private kpDistExpected: number[] = []
  private loaded = false
  private timelineHoverIdx = -1

  // Resize observer for responsive canvas redraw
  private resizeObserver: ResizeObserver | null = null

  private yearSelectorEl!: HTMLElement

  protected create (): HTMLElement {
    this.yearSelectorEl = new YearSelector({}).el
    this.loaderEl = h('div', { className: cx.loader }, new Loader({}).el)
    this.contentEl = h('div', { className: cx.content })
    hide(this.contentEl)

    return h('div', { className: cx.root },
      this.yearSelectorEl,
      this.loaderEl,
      this.contentEl
    )
  }

  // ─── Public API ─────────────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return

    const geo = useGeomagnetic()
    await geo.load()

    const store = useAppStore()
    const sightings = store.sightings.get()

    // Yield before heavy computation so spinner renders
    await yieldThread()
    this.computeData(sightings)

    if (!this.built) {
      this.buildContent()
      this.built = true
    }
    this.updateStats()

    this.loaded = true
    hide(this.loaderEl)
    show(this.contentEl)

    requestAnimationFrame(() => {
      this.drawTimeline()
      this.drawDistribution()
    })

    this.bindResizeObserver()

    // Re-compute when sightings change (year range or filter)
    store.sightings.subscribe((newSightings) => {
      if (!this.loaded) return
      this.computeData(newSightings)
      this.updateStats()
      this.rebuildHeatStrip()
      requestAnimationFrame(() => {
        this.drawTimeline()
        this.drawDistribution()
      })
    })

    // Show/hide loader during year-range refetches
    store.loading.subscribe((loading) => {
      if (!this.loaded) return
      if (loading) {
        show(this.loaderEl)
        hide(this.contentEl)
      } else {
        hide(this.loaderEl)
        show(this.contentEl)
      }
    })

    // Redraw on theme change (canvas colors differ)
    const { theme } = useTheme()
    theme.subscribe(() => {
      if (!this.loaded) return
      requestAnimationFrame(() => {
        this.drawTimeline()
        this.drawDistribution()
      })
    })
  }

  // ─── Data computation ───────────────────────────────────────────

  private computeData (sightings: Sighting[]): void {
    const geo = useGeomagnetic()
    const monthly = geo.getMonthlyCorrelation(sightings)

    const keys = Array.from(monthly.keys()).sort()
    this.monthlyData = keys.map(key => {
      const val = monthly.get(key)!
      return {
        label: key,
        avgKp: val.avgKp,
        maxKp: val.maxKp,
        sightingCount: val.sightingCount,
        stormSightingCount: val.stormSightingCount
      }
    })

    this.kpDistObserved = geo.getKpDistribution(sightings)

    const allRecords = geo.getAll()
    const kpFreq = new Array<number>(KP_LEVELS).fill(0)
    let totalIntervals = 0
    for (const rec of allRecords) {
      for (const kp of rec.kp) {
        if (kp !== null) {
          const bucket = Math.min(9, Math.floor(kp))
          kpFreq[bucket]++
          totalIntervals++
        }
      }
    }

    const totalObserved = this.kpDistObserved.reduce((a, b) => a + b, 0)
    this.kpDistExpected = kpFreq.map(f =>
      totalIntervals > 0 ? Math.round((f / totalIntervals) * totalObserved) : 0
    )
  }

  // ─── Build DOM (once) ───────────────────────────────────────────

  private buildContent (): void {
    // Stats (values set by updateStats)
    this.statTotalVal = createStatValue()
    this.statStormVal = createStatValue()
    this.statStormSub = createStatSub()
    this.statAvgVal = createStatValue()
    this.statPeakVal = createStatValue()
    this.statOverrepVal = createStatValue()

    const statsBar = StatCardGrid(
      new StatCard({ label: GEOMAGNETIC.STAT_TOTAL, valueEl: this.statTotalVal, sub: GEOMAGNETIC.SOURCE }).el,
      new StatCard({ label: GEOMAGNETIC.STAT_STORM_PCT, valueEl: this.statStormVal, sub: this.statStormSub }).el,
      new StatCard({ label: GEOMAGNETIC.STAT_AVG_KP, valueEl: this.statAvgVal, sub: 'dataset period' }).el,
      new StatCard({ label: GEOMAGNETIC.STAT_PEAK_KP, valueEl: this.statPeakVal, sub: 'maximum observed' }).el,
      new StatCard({ label: GEOMAGNETIC.STAT_OVERREP, valueEl: this.statOverrepVal, sub: GEOMAGNETIC.STAT_OVERREP_SUB }).el
    )

    // Timeline section
    this.heatStrip = h('div', { className: cx.heatStrip })
    this.buildHeatStrip()

    this.timelineCanvas = el('canvas', { className: cx.canvas })
    this.timelineCanvas.height = TIMELINE_H
    this.timelineTooltip = h('div', { className: cx.tooltip })
    hide(this.timelineTooltip)

    this.timelineScrollWrapper = h('div', { className: cx.scrollWrapper },
      this.heatStrip,
      this.timelineCanvas
    )

    const timelinePanel = h('div', { className: cx.panel },
      h('div', { className: cx.heatStripLabel }, GEOMAGNETIC.LABEL_KP_INDEX),
      this.timelineScrollWrapper,
      this.timelineTooltip,
      this.buildLegend([
        { label: GEOMAGNETIC.LEGEND_CALM, color: 'var(--color-green)' },
        { label: GEOMAGNETIC.LEGEND_STORM, color: 'var(--color-red)' }
      ])
    )
    this.bindTimelineHover()

    const timelineSection = h('div', { className: cx.section },
      el('h2', { className: cx.sectionTitle }, [GEOMAGNETIC.TIMELINE_TITLE]),
      h('div', { className: cx.sectionSub }, GEOMAGNETIC.TIMELINE_SUBTITLE),
      timelinePanel
    )

    // Distribution section
    this.distCanvas = el('canvas', { className: cx.canvas })
    this.distCanvas.height = DIST_H
    this.distTooltip = h('div', { className: cx.tooltip })
    hide(this.distTooltip)

    this.distScrollWrapper = h('div', { className: cx.scrollWrapper },
      this.distCanvas
    )

    const distPanel = h('div', { className: cx.panel },
      this.distScrollWrapper,
      this.distTooltip,
      this.buildLegend([
        { label: GEOMAGNETIC.LABEL_OBSERVED, color: 'var(--color-green)' },
        { label: GEOMAGNETIC.LABEL_EXPECTED, color: 'var(--color-muted)' }
      ]),
      h('div', { className: cx.note },
        'Red bars indicate overrepresentation vs random expectation'
      )
    )
    this.bindDistHover()

    const distSection = h('div', { className: cx.section },
      el('h2', { className: cx.sectionTitle }, [GEOMAGNETIC.DIST_TITLE]),
      h('div', { className: cx.sectionSub }, GEOMAGNETIC.DIST_SUBTITLE),
      distPanel
    )

    this.contentEl.appendChild(statsBar)
    this.contentEl.appendChild(timelineSection)
    this.contentEl.appendChild(distSection)
  }

  // ─── Stats update ───────────────────────────────────────────────

  private updateStats (): void {
    const total = this.monthlyData.reduce((s, d) => s + d.sightingCount, 0)
    const stormTotal = this.monthlyData.reduce((s, d) => s + d.stormSightingCount, 0)
    const stormPct = total > 0 ? ((stormTotal / total) * 100).toFixed(1) : '0'
    const avgKp = this.monthlyData.length > 0
      ? (this.monthlyData.reduce((s, d) => s + d.avgKp, 0) / this.monthlyData.length).toFixed(1)
      : '0'
    const peakKp = this.monthlyData.length > 0
      ? Math.max(...this.monthlyData.map(d => d.maxKp)).toFixed(1)
      : '0'
    const overrep = this.computeOverrepresentation()

    setText(this.statTotalVal, total.toLocaleString())
    setStyles(this.statTotalVal, { color: 'var(--color-green)' })

    setText(this.statStormVal, `${stormPct}%`)
    setStyles(this.statStormVal, { color: 'var(--color-red)' })
    if (this.statStormSub instanceof HTMLElement) {
      setText(this.statStormSub, `${stormTotal.toLocaleString()} sightings`)
    }

    setText(this.statAvgVal, avgKp)
    setStyles(this.statAvgVal, { color: 'var(--color-amber)' })

    setText(this.statPeakVal, peakKp)
    setStyles(this.statPeakVal, { color: 'var(--color-red)' })

    setText(this.statOverrepVal, `${overrep}×`)
    setStyles(this.statOverrepVal, { color: 'var(--color-red)' })
  }

  // ─── Kp heatmap strip ──────────────────────────────────────────

  private buildHeatStrip (): void {
    for (const bucket of this.monthlyData) {
      const cell = h('div')
      const kp = bucket.avgKp
      const color = kp < 3 ? 'var(--color-green)' : kp < 5 ? 'var(--color-amber)' : 'var(--color-red)'
      setStyles(cell, {
        flex: '1 0 auto',
        minWidth: (BAR_MIN_W + BAR_GAP) + 'px',
        background: color,
        opacity: String(0.15 + (kp / 9) * 0.85)
      })
      cell.title = `${bucket.label}: Kp ${bucket.avgKp}`
      this.heatStrip.appendChild(cell)
    }
  }

  private rebuildHeatStrip (): void {
    while (this.heatStrip.firstChild) this.heatStrip.removeChild(this.heatStrip.firstChild)
    this.buildHeatStrip()
  }

  // ─── Legend factory ─────────────────────────────────────────────

  private buildLegend (items: Array<{ label: string; color: string }>): HTMLElement {
    const legend = h('div', { className: cx.legend })
    for (const item of items) {
      const swatch = h('span', { className: cx.legendSwatch })
      setStyles(swatch, { background: item.color })
      legend.appendChild(
        h('span', { className: cx.legendItem }, swatch, item.label)
      )
    }
    return legend
  }

  // ─── Resize observer ───────────────────────────────────────────

  private bindResizeObserver (): void {
    let rafId = 0
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        this.drawTimeline()
        this.drawDistribution()
      })
    })
    this.resizeObserver.observe(this.contentEl)
  }

  // ─── Timeline canvas ───────────────────────────────────────────

  private drawTimeline (): void {
    const canvas = this.timelineCanvas
    const wrapper = this.timelineScrollWrapper
    const viewportW = wrapper.getBoundingClientRect().width
    if (viewportW <= 0) return

    const data = this.monthlyData
    if (data.length === 0) return

    const padX = getPadX(viewportW)
    const step = BAR_MIN_W + BAR_GAP
    const contentW = Math.max(viewportW, data.length * step + padX)

    const dpr = window.devicePixelRatio || 1
    canvas.width = contentW * dpr
    canvas.height = TIMELINE_H * dpr
    setStyles(canvas, { width: contentW + 'px', height: TIMELINE_H + 'px' })

    // Sync heatStrip width with canvas
    setStyles(this.heatStrip, { width: contentW + 'px' })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const c = getCanvasColors()
    const w = contentW
    const barArea = TIMELINE_H - LABEL_H - PAD_TOP
    const barW = Math.max(BAR_MIN_W, Math.floor((w - padX) / data.length) - BAR_GAP)
    const barStep = barW + BAR_GAP
    const maxCount = Math.max(1, ...data.map(d => d.sightingCount))

    // Y-axis
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'right'
    const ySteps = 4
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxCount / ySteps) * i)
      const y = PAD_TOP + barArea - (barArea * (i / ySteps))
      ctx.fillStyle = c.text
      ctx.fillText(String(val), padX - 6, y + 3)
      ctx.strokeStyle = c.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padX, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Bars
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const x = padX + i * barStep
      const barH = Math.max(0, (d.sightingCount / maxCount) * barArea)
      const y = PAD_TOP + barArea - barH
      const isHover = i === this.timelineHoverIdx

      // Hover highlight column
      if (isHover) {
        ctx.fillStyle = c.grid
        ctx.fillRect(x - 1, PAD_TOP, barStep, barArea)
      }

      ctx.fillStyle = d.avgKp >= 5
        ? (isHover ? c.barStormHover : c.barStorm)
        : (isHover ? c.barCalmHover : c.barCalm)
      if (barH > 0) {
        const r = Math.min(BAR_RADIUS, barW / 2, barH / 2)
        ctx.beginPath()
        ctx.moveTo(x, PAD_TOP + barArea)
        ctx.lineTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r)
        ctx.arcTo(x + barW, y, x + barW, y + r, r)
        ctx.lineTo(x + barW, PAD_TOP + barArea)
        ctx.closePath()
        ctx.fill()
      }

      const labelEvery = Math.max(1, Math.floor(data.length / 10))
      if (i % labelEvery === 0 || i === data.length - 1) {
        ctx.fillStyle = c.text
        ctx.font = 'bold 8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(d.label, x + barW / 2, TIMELINE_H - 4)
      }
    }
  }

  // ─── Distribution canvas ────────────────────────────────────────

  private drawDistribution (): void {
    const canvas = this.distCanvas
    const wrapper = this.distScrollWrapper
    const viewportW = wrapper.getBoundingClientRect().width
    if (viewportW <= 0) return

    const padX = getPadX(viewportW)
    const contentW = Math.max(viewportW, KP_LEVELS * MIN_KP_GROUP_W + padX)

    const dpr = window.devicePixelRatio || 1
    canvas.width = contentW * dpr
    canvas.height = DIST_H * dpr
    setStyles(canvas, { width: contentW + 'px', height: DIST_H + 'px' })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const c = getCanvasColors()
    const w = contentW
    const barArea = DIST_H - LABEL_H - PAD_TOP
    const groupW = Math.floor((w - padX) / KP_LEVELS)
    const barW = Math.max(4, Math.floor((groupW - BAR_GAP * 3) / 2))
    const maxVal = Math.max(1, ...this.kpDistObserved, ...this.kpDistExpected)

    // Y-axis
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'right'
    const ySteps = 4
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxVal / ySteps) * i)
      const y = PAD_TOP + barArea - (barArea * (i / ySteps))
      ctx.fillStyle = c.text
      ctx.fillText(String(val), padX - 6, y + 3)
      ctx.strokeStyle = c.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padX, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    for (let kp = 0; kp < KP_LEVELS; kp++) {
      const groupX = padX + kp * groupW
      const obs = this.kpDistObserved[kp] ?? 0
      const exp = this.kpDistExpected[kp] ?? 0
      const ratio = exp > 0 ? obs / exp : 0

      // Expected bar (dim)
      const expH = (exp / maxVal) * barArea
      const expY = PAD_TOP + barArea - expH
      ctx.fillStyle = c.barExpected
      this.drawRoundedBar(ctx, groupX, expY, barW, expH)

      // Observed bar (colored by overrepresentation)
      const obsH = (obs / maxVal) * barArea
      const obsY = PAD_TOP + barArea - obsH
      ctx.fillStyle = ratio > 1.2 ? c.barOverrep : ratio > 0.9 ? c.barNormal : c.barUnder
      this.drawRoundedBar(ctx, groupX + barW + BAR_GAP, obsY, barW, obsH)

      // Kp label
      ctx.fillStyle = c.text
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(kp), groupX + groupW / 2, DIST_H - 4)
    }
  }

  private drawRoundedBar (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, bh: number): void {
    if (bh <= 0) return
    const r = Math.min(BAR_RADIUS, w / 2, bh / 2)
    ctx.beginPath()
    ctx.moveTo(x, y + bh)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + bh)
    ctx.closePath()
    ctx.fill()
  }

  // ─── Hover interactions ─────────────────────────────────────────

  private bindTimelineHover (): void {
    const canvas = this.timelineCanvas
    let lastIdx = -1

    const handleHover = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const data = this.monthlyData
      if (data.length === 0) { hide(this.timelineTooltip); return }

      const padX = getPadX(this.timelineScrollWrapper.getBoundingClientRect().width)
      const barW = Math.max(BAR_MIN_W, Math.floor((canvas.clientWidth - padX) / data.length) - BAR_GAP)
      const step = barW + BAR_GAP
      const idx = Math.floor((x - padX) / step)

      if (idx < 0 || idx >= data.length) {
        if (lastIdx !== -1) {
          this.timelineHoverIdx = -1
          lastIdx = -1
          hide(this.timelineTooltip)
          this.drawTimeline()
        }
        return
      }
      if (idx === lastIdx) return
      lastIdx = idx
      this.timelineHoverIdx = idx

      const d = data[idx]
      setText(this.timelineTooltip, `${d.label} — Kp ${d.avgKp} — ${d.sightingCount} sightings`)
      show(this.timelineTooltip)
      this.drawTimeline()
    }

    const clearHover = () => {
      if (lastIdx !== -1) {
        this.timelineHoverIdx = -1
        lastIdx = -1
        hide(this.timelineTooltip)
        this.drawTimeline()
      }
    }

    canvas.addEventListener('mousemove', (e: MouseEvent) => handleHover(e.clientX))
    canvas.addEventListener('mouseleave', clearHover)

    // Touch support
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) handleHover(e.touches[0].clientX)
    }, { passive: true })
    canvas.addEventListener('touchend', clearHover, { passive: true })
  }

  private bindDistHover (): void {
    const canvas = this.distCanvas
    let lastKp = -1

    const handleHover = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const padX = getPadX(this.distScrollWrapper.getBoundingClientRect().width)
      const groupW = Math.floor((canvas.clientWidth - padX) / KP_LEVELS)
      const kp = Math.floor((x - padX) / groupW)

      if (kp < 0 || kp >= KP_LEVELS) { hide(this.distTooltip); lastKp = -1; return }
      if (kp === lastKp) return
      lastKp = kp

      const obs = this.kpDistObserved[kp] ?? 0
      const exp = this.kpDistExpected[kp] ?? 0
      const ratio = exp > 0 ? (obs / exp).toFixed(2) : 'N/A'
      setText(this.distTooltip, `Kp ${kp}: ${obs} observed / ${exp} expected (${ratio}×)`)
      show(this.distTooltip)
    }

    canvas.addEventListener('mousemove', (e: MouseEvent) => handleHover(e.clientX))
    canvas.addEventListener('mouseleave', () => { hide(this.distTooltip); lastKp = -1 })

    // Touch support
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) handleHover(e.touches[0].clientX)
    }, { passive: true })
    canvas.addEventListener('touchend', () => { hide(this.distTooltip); lastKp = -1 }, { passive: true })
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private computeOverrepresentation (): string {
    let obsHigh = 0
    let expHigh = 0
    for (let kp = 5; kp < KP_LEVELS; kp++) {
      obsHigh += this.kpDistObserved[kp] ?? 0
      expHigh += this.kpDistExpected[kp] ?? 0
    }
    return expHigh > 0 ? (obsHigh / expHigh).toFixed(1) : '0'
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy (): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    super.destroy()
  }
}
