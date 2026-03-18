/* ------------------------------------------------------------------ *
 *  GeomagneticView — Kp index vs sighting density visualizer          *
 *                                                                     *
 *  Two canvas charts:                                                 *
 *    1. Temporal correlation: monthly Kp heatstrip + sighting bars    *
 *    2. Kp distribution: observed vs expected sighting counts by Kp   *
 *                                                                     *
 *  All rendering via <canvas> — zero chart library dependencies.      *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, el, hide, show, setText, setStyles } from '@/utils/dom'
import { palette } from '@/styles/palette'
import { useGeomagnetic, useAppStore } from '@/composables'
import { Loader } from '@/components/loader'
import { GEOMAGNETIC } from '@/data/strings'
import type { Sighting } from '@/types'

// ─── Canvas constants ───────────────────────────────────────────────

const BAR_GAP = 2
const BAR_MIN_W = 6
const BAR_RADIUS = 2
const LABEL_H = 20
const PAD_X = 40
const PAD_TOP = 8
const TIMELINE_H = 200
const DIST_H = 220
const KP_LEVELS = 10

// ─── Helpers ────────────────────────────────────────────────────────

function kpColor (kp: number): string {
  if (kp < 3) return palette.green500
  if (kp < 5) return palette.amber500
  return palette.red500
}

function kpBarColor (kp: number): string {
  if (kp >= 5) return palette.red500_70
  return palette.green500_30
}

function kpHeatOpacity (kp: number): number {
  return 0.15 + (kp / 9) * 0.85
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

  // Stats
  private statTotalEl!: HTMLElement
  private statStormEl!: HTMLElement
  private statAvgEl!: HTMLElement
  private statPeakEl!: HTMLElement
  private statOverrepEl!: HTMLElement

  // Timeline
  private heatStrip!: HTMLElement
  private timelineCanvas!: HTMLCanvasElement
  private timelineTooltip!: HTMLElement

  // Distribution
  private distCanvas!: HTMLCanvasElement
  private distTooltip!: HTMLElement

  private monthlyData: MonthlyBucket[] = []
  private kpDistObserved: number[] = []
  private kpDistExpected: number[] = []
  private loaded = false

  protected create (): HTMLElement {
    this.loaderEl = h('div', { className: cx.loader }, new Loader({}).el)
    this.contentEl = h('div', { style: 'display:none' })

    return h('div', { className: cx.root },
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

    this.computeData(sightings)
    this.buildContent()
    this.loaded = true

    hide(this.loaderEl)
    show(this.contentEl)

    // Defer draw to next frame so layout is resolved
    requestAnimationFrame(() => {
      this.drawTimeline()
      this.drawDistribution()
    })
  }

  // ─── Data computation ───────────────────────────────────────────

  private computeData (sightings: Sighting[]): void {
    const geo = useGeomagnetic()
    const monthly = geo.getMonthlyCorrelation(sightings)

    // Sort by month key
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

    // Kp distribution
    this.kpDistObserved = geo.getKpDistribution(sightings)

    // Expected: proportional to how often each Kp level occurs in the dataset
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

  // ─── Build DOM ──────────────────────────────────────────────────

  private buildContent (): void {
    // Stats
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

    this.statTotalEl = this.createStat(GEOMAGNETIC.STAT_TOTAL, total.toLocaleString(), GEOMAGNETIC.SOURCE, palette.green500)
    this.statStormEl = this.createStat(GEOMAGNETIC.STAT_STORM_PCT, `${stormPct}%`, `${stormTotal.toLocaleString()} sightings`, palette.red500)
    this.statAvgEl = this.createStat(GEOMAGNETIC.STAT_AVG_KP, avgKp, 'dataset period', palette.amber500)
    this.statPeakEl = this.createStat(GEOMAGNETIC.STAT_PEAK_KP, peakKp, 'maximum observed', palette.red500)
    this.statOverrepEl = this.createStat(GEOMAGNETIC.STAT_OVERREP, `${overrep}×`, GEOMAGNETIC.STAT_OVERREP_SUB, palette.red500)

    const statsBar = h('div', { className: cx.stats },
      this.statTotalEl,
      this.statStormEl,
      this.statAvgEl,
      this.statPeakEl,
      this.statOverrepEl
    )

    // Timeline section
    this.heatStrip = h('div', { className: cx.heatStrip })
    this.buildHeatStrip()

    this.timelineCanvas = el('canvas', { className: cx.canvas })
    this.timelineCanvas.height = TIMELINE_H
    this.timelineTooltip = h('div', { className: cx.tooltip })
    hide(this.timelineTooltip)

    const timelinePanel = h('div', { className: cx.panel },
      h('div', { className: cx.heatStripLabel }, GEOMAGNETIC.LABEL_KP_INDEX),
      this.heatStrip,
      this.timelineCanvas,
      this.timelineTooltip,
      this.buildLegend([
        { label: GEOMAGNETIC.LEGEND_CALM, color: palette.green500 },
        { label: GEOMAGNETIC.LEGEND_STORM, color: palette.red500 }
      ])
    )

    this.bindTimelineHover()

    const timelineSection = h('div', { className: cx.section },
      h('div', { className: cx.sectionTitle }, GEOMAGNETIC.TIMELINE_TITLE),
      h('div', { className: cx.sectionSub }, GEOMAGNETIC.TIMELINE_SUBTITLE),
      timelinePanel
    )

    // Distribution section
    this.distCanvas = el('canvas', { className: cx.canvas })
    this.distCanvas.height = DIST_H
    this.distTooltip = h('div', { className: cx.tooltip })
    hide(this.distTooltip)

    const distPanel = h('div', { className: cx.panel },
      this.distCanvas,
      this.distTooltip,
      this.buildLegend([
        { label: GEOMAGNETIC.LABEL_OBSERVED, color: palette.green500 },
        { label: GEOMAGNETIC.LABEL_EXPECTED, color: palette.white50 }
      ]),
      h('div', { className: cx.note },
        'Red bars indicate overrepresentation vs random expectation'
      )
    )

    this.bindDistHover()

    const distSection = h('div', { className: cx.section },
      h('div', { className: cx.sectionTitle }, GEOMAGNETIC.DIST_TITLE),
      h('div', { className: cx.sectionSub }, GEOMAGNETIC.DIST_SUBTITLE),
      distPanel
    )

    this.contentEl.appendChild(statsBar)
    this.contentEl.appendChild(timelineSection)
    this.contentEl.appendChild(distSection)
  }

  // ─── Stat card factory ──────────────────────────────────────────

  private createStat (label: string, value: string, sub: string, color: string): HTMLElement {
    const valueEl = h('div', { className: cx.statValue }, value)
    setStyles(valueEl, { color })

    return h('div', { className: cx.stat },
      h('div', { className: cx.statLabel }, label),
      valueEl,
      h('div', { className: cx.statSub }, sub)
    )
  }

  // ─── Kp heatmap strip ──────────────────────────────────────────

  private buildHeatStrip (): void {
    for (const bucket of this.monthlyData) {
      const cell = h('div')
      setStyles(cell, {
        flex: '1',
        background: kpColor(bucket.avgKp),
        opacity: String(kpHeatOpacity(bucket.avgKp))
      })
      cell.title = `${bucket.label}: Kp ${bucket.avgKp}`
      this.heatStrip.appendChild(cell)
    }
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

  // ─── Timeline canvas ───────────────────────────────────────────

  private drawTimeline (): void {
    const canvas = this.timelineCanvas
    const rect = canvas.parentElement?.getBoundingClientRect()
    if (!rect) return

    const w = rect.width - 32 // panel padding
    if (w <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = TIMELINE_H * dpr
    setStyles(canvas, { width: w + 'px', height: TIMELINE_H + 'px' })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const data = this.monthlyData
    if (data.length === 0) return

    const barArea = TIMELINE_H - LABEL_H - PAD_TOP
    const barW = Math.max(BAR_MIN_W, Math.floor((w - PAD_X) / data.length) - BAR_GAP)
    const step = barW + BAR_GAP
    const maxCount = Math.max(1, ...data.map(d => d.sightingCount))

    // Y-axis labels
    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = palette.white50
    ctx.textAlign = 'right'
    const ySteps = 4
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxCount / ySteps) * i)
      const y = PAD_TOP + barArea - (barArea * (i / ySteps))
      ctx.fillText(String(val), PAD_X - 6, y + 3)

      // Grid line
      ctx.strokeStyle = palette.white08
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD_X, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Bars
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      const x = PAD_X + i * step
      const barH = Math.max(0, (d.sightingCount / maxCount) * barArea)
      const y = PAD_TOP + barArea - barH

      ctx.fillStyle = kpBarColor(d.avgKp)
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

      // X-axis labels (every ~12 months)
      const labelEvery = Math.max(1, Math.floor(data.length / 10))
      if (i % labelEvery === 0 || i === data.length - 1) {
        ctx.fillStyle = palette.white50
        ctx.font = 'bold 8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(d.label, x + barW / 2, TIMELINE_H - 4)
      }
    }
  }

  // ─── Distribution canvas ────────────────────────────────────────

  private drawDistribution (): void {
    const canvas = this.distCanvas
    const rect = canvas.parentElement?.getBoundingClientRect()
    if (!rect) return

    const w = rect.width - 32
    if (w <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = DIST_H * dpr
    setStyles(canvas, { width: w + 'px', height: DIST_H + 'px' })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const barArea = DIST_H - LABEL_H - PAD_TOP
    const groupW = Math.floor((w - PAD_X) / KP_LEVELS)
    const barW = Math.max(4, Math.floor((groupW - BAR_GAP * 3) / 2))
    const maxVal = Math.max(1, ...this.kpDistObserved, ...this.kpDistExpected)

    // Y-axis
    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = palette.white50
    ctx.textAlign = 'right'
    const ySteps = 4
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxVal / ySteps) * i)
      const y = PAD_TOP + barArea - (barArea * (i / ySteps))
      ctx.fillText(String(val), PAD_X - 6, y + 3)
      ctx.strokeStyle = palette.white08
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD_X, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    for (let kp = 0; kp < KP_LEVELS; kp++) {
      const groupX = PAD_X + kp * groupW
      const obs = this.kpDistObserved[kp] ?? 0
      const exp = this.kpDistExpected[kp] ?? 0
      const ratio = exp > 0 ? obs / exp : 0

      // Expected bar (dim)
      const expH = (exp / maxVal) * barArea
      const expY = PAD_TOP + barArea - expH
      ctx.fillStyle = palette.white15
      this.drawRoundedBar(ctx, groupX, expY, barW, expH)

      // Observed bar (colored by overrepresentation)
      const obsH = (obs / maxVal) * barArea
      const obsY = PAD_TOP + barArea - obsH
      ctx.fillStyle = ratio > 1.2 ? palette.red500_70 : ratio > 0.9 ? palette.amber500_70 : palette.green400_70
      this.drawRoundedBar(ctx, groupX + barW + BAR_GAP, obsY, barW, obsH)

      // Kp label
      ctx.fillStyle = palette.white50
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(kp), groupX + groupW / 2, DIST_H - 4)
    }
  }

  private drawRoundedBar (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (h <= 0) return
    const r = Math.min(BAR_RADIUS, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    ctx.fill()
  }

  // ─── Hover interactions ─────────────────────────────────────────

  private bindTimelineHover (): void {
    const canvas = this.timelineCanvas
    let lastIdx = -1

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const data = this.monthlyData
      if (data.length === 0) return

      const barW = Math.max(BAR_MIN_W, Math.floor((rect.width - PAD_X) / data.length) - BAR_GAP)
      const step = barW + BAR_GAP
      const idx = Math.floor((x - PAD_X) / step)

      if (idx < 0 || idx >= data.length) {
        hide(this.timelineTooltip)
        lastIdx = -1
        return
      }

      if (idx === lastIdx) return
      lastIdx = idx

      const d = data[idx]
      setText(this.timelineTooltip, `${d.label} — Kp ${d.avgKp} — ${d.sightingCount} sightings`)
      setStyles(this.timelineTooltip, { color: kpColor(d.avgKp) })
      show(this.timelineTooltip)
    })

    canvas.addEventListener('mouseleave', () => {
      hide(this.timelineTooltip)
      lastIdx = -1
    })
  }

  private bindDistHover (): void {
    const canvas = this.distCanvas
    let lastKp = -1

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const groupW = Math.floor((rect.width - PAD_X) / KP_LEVELS)
      const kp = Math.floor((x - PAD_X) / groupW)

      if (kp < 0 || kp >= KP_LEVELS) {
        hide(this.distTooltip)
        lastKp = -1
        return
      }

      if (kp === lastKp) return
      lastKp = kp

      const obs = this.kpDistObserved[kp] ?? 0
      const exp = this.kpDistExpected[kp] ?? 0
      const ratio = exp > 0 ? (obs / exp).toFixed(2) : 'N/A'
      setText(this.distTooltip, `Kp ${kp}: ${obs} observed / ${exp} expected (${ratio}×)`)
      show(this.distTooltip)
    })

    canvas.addEventListener('mouseleave', () => {
      hide(this.distTooltip)
      lastKp = -1
    })
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
}
