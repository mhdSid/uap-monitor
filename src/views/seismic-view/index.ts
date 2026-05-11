/* ------------------------------------------------------------------ *
 *  SeismicView — Earthquake proximity vs sighting visualizer          *
 *                                                                     *
 *  Canvas heatmap: distance (km) vs time delta (hours)               *
 *  Each cell coloured by sighting-pair density (cyan → amber → red). *
 *  EQL threshold and zero-time reference lines retained.             *
 *                                                                     *
 *  Theme-aware canvas (same pattern as Timeline).                     *
 *  Canvas wrapped in scroll container for narrow viewports.           *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { cx as appCx } from '../app/cx'
import { Component } from '@/core'
import { h, el, hide, show, setText, setStyles } from '@/core/dom'
import { palette } from '@/styles/palette'
import { useSeismic, useAppStore, useTheme } from '@/composables'
import { Loader } from '@/components/loader'
import { Footer } from '@/components/footer'
import { YearSelector } from '@/components/year-selector'
import { StatCard, createStatValue, StatCardGrid } from '@/components/stat-card'
import { SEISMIC } from '@/data/strings'
import type { Sighting, NearbyEarthquake } from '@/types'
import { Alert } from '@/components/alert'
import { AlertVariant } from '@/enums'

// ─── Canvas constants ───────────────────────────────────────────────

const SCATTER_H = 320
const PAD_Y = 20
const PAD_BOTTOM = 42
const MAX_HOURS = 72
const MAX_DIST_KM = 300
const EQL_DIST_LINE = 120
const MIN_SCATTER_W = 420

/** Number of horizontal time bins (144h / 24 = 6h per bin) */
const BINS_X = 24
/** Number of vertical distance bins (300km / 16 ≈ 18.75km per bin) */
const BINS_Y = 16

// ─── Responsive helpers ─────────────────────────────────────────────

/** Y-axis label gutter — narrower on small screens */
function getPadX (canvasW: number): number {
  return canvasW < 300 ? 32 : 52
}

/** X-axis hour labels — drop ±72 on very small screens */
const HOUR_STEPS_FULL = [-72, -48, -24, 0, 24, 48, 72]
const HOUR_STEPS_COMPACT = [-48, -24, 0, 24, 48]

function getHourSteps (canvasW: number): number[] {
  return canvasW < 300 ? HOUR_STEPS_COMPACT : HOUR_STEPS_FULL
}

// ─── Heatmap color helpers ──────────────────────────────────────────

function lerp3 (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ]
}

/**
 * Maps a normalised density value (0–1) to an rgba string.
 * Ramp: cyan (sparse) → amber (moderate) → red (dense).
 * Light and dark themes use slightly different base shades.
 */
function heatColor (t: number, isLight: boolean): string {
  const stops: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ] = isLight
    ? [[8, 145, 178], [217, 119, 6], [220, 38, 38]]   // cyan-600 / amber-600 / red-600
    : [[34, 211, 238], [245, 158, 11], [239, 68, 68]]  // cyan-500 / amber-500 / red-500

  const [r, g, b] = t <= 0.5
    ? lerp3(stops[0], stops[1], t * 2)
    : lerp3(stops[1], stops[2], (t - 0.5) * 2)

  const alpha = 0.12 + t * 0.78
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── Theme-aware canvas colors ──────────────────────────────────────

interface CanvasColors {
  text: string
  grid: string
  refLine: string
  refLineEql: string
  magLow: string
  magMid: string
  magHigh: string
}

function getCanvasColors (): CanvasColors {
  const { isLightTheme } = useTheme()
  const isLight = isLightTheme()

  return isLight
    ? {
      text: palette.black500_30,
      grid: palette.black_08,
      refLine: palette.amber600_20,
      refLineEql: palette.red600_30,
      magLow: palette.cyan600,
      magMid: palette.amber600,
      magHigh: palette.red600
    }
    : {
      text: palette.white50,
      grid: palette.white08,
      refLine: palette.amber500_20,
      refLineEql: palette.red500_30,
      magLow: palette.cyan500,
      magMid: palette.amber500,
      magHigh: palette.red500
    }
}

// ─── Types ──────────────────────────────────────────────────────────

interface ScatterPoint {
  distKm: number
  hoursDelta: number
  magnitude: number
  isEQL: boolean
}

interface TopCorrelation {
  location: string
  magnitude: number
  date: string
  sightingCount: number
  avgDistKm: number
}

// ─── Component ──────────────────────────────────────────────────────

export class SeismicView extends Component {
  private loaderEl!: HTMLElement
  private contentEl!: HTMLElement
  private built = false

  private heatCanvas!: HTMLCanvasElement
  private heatScrollWrapper!: HTMLElement
  private heatTooltip!: HTMLElement
  private tableBody!: HTMLElement

  // Stat value elements
  private statPairsVal!: HTMLElement
  private statEqlVal!: HTMLElement
  private statDistVal!: HTMLElement
  private statMagVal!: HTMLElement

  private scatterData: ScatterPoint[] = []
  private topCorrelations: TopCorrelation[] = []
  private totalPairs = 0
  private eqlCount = 0
  private avgDist = 0
  private avgMag = 0
  private loaded = false

  // Populated by drawHeatmap(), read by bindHeatmapHover()
  private heatGrid: number[][] = []
  private heatEqlGrid: number[][] = []

  private resizeObserver: ResizeObserver | null = null
  private yearSelector!: YearSelector
  private yearSelectorEl!: HTMLElement

  protected create (): HTMLElement {
    this.yearSelector = this.ownChild(new YearSelector({}))
    this.yearSelectorEl = this.yearSelector.el
    this.loaderEl = h('div', { className: appCx.viewLoader }, new Loader({}).el)
    this.contentEl = h('div', { className: appCx.appViewContent })
    hide(this.contentEl)

    return h('div', { className: [cx.root, appCx.appView].join(' ') },
      this.yearSelectorEl,
      this.loaderEl,
      this.contentEl
    )
  }

  // ─── Public API ─────────────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return

    const seismic = useSeismic()
    await seismic.load()

    const store = useAppStore()
    const sightings = store.sightings.get()
    const { from, to } = store.yearRange.get()

    await seismic.ensureYears(from, to)
    await this.computeData(sightings)

    if (!this.built) {
      this.buildContent()
      this.built = true
    }

    this.updateStats()
    this.updateTable()

    this.loaded = true
    hide(this.loaderEl)
    show(this.contentEl)

    requestAnimationFrame(() => { this.drawHeatmap() })
    this.bindResizeObserver()

    // Re-compute when sightings change (year range or filter)
    this.own(store.sightings.subscribe(async (newSightings) => {
      if (!this.loaded) return
      const { from: f, to: t } = store.yearRange.get()
      await seismic.ensureYears(f, t)
      await this.computeData(newSightings)
      this.updateStats()
      this.updateTable()
      requestAnimationFrame(() => this.drawHeatmap())
    }))

    // Show/hide loader during year-range refetches
    this.own(store.loading.subscribe((loading) => {
      if (!this.loaded) return
      if (loading) {
        show(this.loaderEl)
        hide(this.contentEl)
      } else {
        hide(this.loaderEl)
        show(this.contentEl)
      }
    }))

    // Redraw on theme change
    const { theme } = useTheme()
    this.own(theme.subscribe(() => {
      if (!this.loaded) return
      requestAnimationFrame(() => this.drawHeatmap())
    }))
  }

  // ─── Data computation ───────────────────────────────────────────

  private async computeData (sightings: Sighting[]): Promise<void> {
    const seismic = useSeismic()
    const pairs = await seismic.getCorrelatedPairsAsync(sightings)

    this.totalPairs = pairs.length
    this.scatterData = pairs.map(p => ({
      distKm: p.distanceKm,
      hoursDelta: p.hoursDelta,
      magnitude: p.earthquake.magnitude ?? 4,
      isEQL: p.isEQLCandidate
    }))

    this.eqlCount = this.scatterData.filter(d => d.isEQL).length

    if (pairs.length > 0) {
      this.avgDist = Math.round(pairs.reduce((s, p) => s + p.distanceKm, 0) / pairs.length)
      this.avgMag = +(pairs.reduce((s, p) => s + (p.earthquake.magnitude ?? 0), 0) / pairs.length).toFixed(1)
    } else {
      this.avgDist = 0
      this.avgMag = 0
    }

    this.topCorrelations = this.buildTopCorrelations(pairs)
  }

  private buildTopCorrelations (
    pairs: Array<{ sighting: Sighting } & NearbyEarthquake>
  ): TopCorrelation[] {
    const quakeMap = new Map<string, {
      location: string
      magnitude: number
      date: string
      sightingIds: Set<string>
      totalDist: number
    }>()

    for (const p of pairs) {
      const eq = p.earthquake
      const key = eq.id
      const entry = quakeMap.get(key) ?? {
        location: eq.place ?? eq.id,
        magnitude: eq.magnitude ?? 0,
        date: eq.time.slice(0, 10),
        sightingIds: new Set<string>(),
        totalDist: 0
      }
      entry.sightingIds.add(p.sighting.id)
      entry.totalDist += p.distanceKm
      quakeMap.set(key, entry)
    }

    return Array.from(quakeMap.values())
      .sort((a, b) => b.sightingIds.size - a.sightingIds.size)
      .slice(0, 15)
      .map(e => ({
        location: e.location,
        magnitude: e.magnitude,
        date: e.date,
        sightingCount: e.sightingIds.size,
        avgDistKm: Math.round(e.totalDist / e.sightingIds.size)
      }))
  }

  // ─── Build DOM (once) ───────────────────────────────────────────

  private buildContent (): void {
    // Stats
    this.statPairsVal = createStatValue()
    this.statEqlVal = createStatValue()
    this.statDistVal = createStatValue()
    this.statMagVal = createStatValue()

    const statsBar = StatCardGrid(
      new StatCard({ label: SEISMIC.STAT_PAIRS, valueEl: this.statPairsVal, sub: SEISMIC.STAT_PAIRS_SUB }).el,
      new StatCard({ label: SEISMIC.STAT_EQL, valueEl: this.statEqlVal, sub: SEISMIC.STAT_EQL_SUB }).el,
      new StatCard({ label: SEISMIC.STAT_AVG_DIST, valueEl: this.statDistVal, sub: SEISMIC.STAT_AVG_DIST_SUB }).el,
      new StatCard({ label: SEISMIC.STAT_AVG_MAG, valueEl: this.statMagVal, sub: SEISMIC.STAT_AVG_MAG_SUB }).el
    )

    // Heatmap canvas
    this.heatCanvas = el('canvas', { className: appCx.viewCanvas })
    this.heatCanvas.height = SCATTER_H
    this.heatTooltip = h('div', { className: appCx.viewTooltip })
    hide(this.heatTooltip)

    this.heatScrollWrapper = h('div', { className: appCx.viewScrollWrapper },
      this.heatCanvas
    )

    const heatPanel = h('div', { className: appCx.viewPanel },
      this.heatScrollWrapper,
      this.heatTooltip,
      this.buildLegend([
        {
          label: SEISMIC.LEGEND_DENSITY,
          color: 'linear-gradient(90deg, var(--color-cyan), var(--color-amber))'
        },
        { label: SEISMIC.LEGEND_EQL, color: 'var(--color-amber)' }
      ]),
      this.buildHeatNote()
    )

    this.bindHeatmapHover()

    const heatSection = h('div', { className: appCx.viewSection },
      el('h2', { className: appCx.viewSectionTitle }, [SEISMIC.SCATTER_TITLE]),
      h('div', { className: appCx.viewSectionSub }, SEISMIC.SCATTER_SUBTITLE),
      heatPanel
    )

    // Table
    const columns = [
      SEISMIC.TABLE_COL_LOCATION,
      SEISMIC.TABLE_COL_MAG,
      SEISMIC.TABLE_COL_DATE,
      SEISMIC.TABLE_COL_SIGHTINGS,
      SEISMIC.TABLE_COL_DIST
    ]

    const thead = el('thead')
    const headRow = el('tr')
    for (const col of columns) {
      const th = el('th', { className: cx.tableHead })
      th.textContent = col
      headRow.appendChild(th)
    }
    thead.appendChild(headRow)

    this.tableBody = el('tbody')

    const table = el('table', { className: cx.table })
    table.appendChild(thead)
    table.appendChild(this.tableBody)

    const tablePanel = h('div', { className: appCx.viewPanel, style: 'padding: 0; overflow: hidden' }, table)

    const tableSection = h('div', { className: appCx.viewSection },
      el('h2', { className: appCx.viewSectionTitle }, [SEISMIC.TABLE_TITLE]),
      h('div', { className: appCx.viewSectionSub }, SEISMIC.TABLE_SUBTITLE),
      tablePanel
    )

    this.contentEl.appendChild(statsBar)

    this.contentEl.appendChild(
      new Alert({
        variant: AlertVariant.INFO,
        title: SEISMIC.ALERT_TITLE,
        content: SEISMIC.ALERT_CONTENT,
        dismissible: true
      }).el
    )

    this.contentEl.appendChild(heatSection)
    this.contentEl.appendChild(tableSection)
    this.contentEl.appendChild(new Footer({}).el)
  }

  // ─── Stats update ───────────────────────────────────────────────

  private updateStats (): void {
    setText(this.statPairsVal, String(this.totalPairs))
    setStyles(this.statPairsVal, { color: 'var(--color-cyan)' })

    setText(this.statEqlVal, String(this.eqlCount))
    setStyles(this.statEqlVal, { color: 'var(--color-amber)' })

    setText(this.statDistVal, `${this.avgDist} km`)
    setStyles(this.statDistVal, { color: 'var(--color-green)' })

    setText(this.statMagVal, `M${this.avgMag}`)
    setStyles(this.statMagVal, { color: 'var(--color-cyan)' })
  }

  // ─── Table update ───────────────────────────────────────────────

  private updateTable (): void {
    while (this.tableBody.firstChild) this.tableBody.removeChild(this.tableBody.firstChild)

    if (this.topCorrelations.length === 0) {
      const tr = el('tr', { className: cx.tableRow })
      const td = el('td', { className: cx.tableEmpty })
      td.setAttribute('colspan', '5')
      td.textContent = SEISMIC.NO_PAIRS
      tr.appendChild(td)
      this.tableBody.appendChild(tr)
      return
    }

    for (const row of this.topCorrelations) {
      const tr = el('tr', { className: cx.tableRow })

      const locCell = el('td', { className: cx.tableCell })
      locCell.textContent = row.location

      const magCell = el('td', { className: cx.tableCell })
      magCell.textContent = `M${row.magnitude}`
      const c = getCanvasColors()
      setStyles(magCell, { color: row.magnitude < 5 ? c.magLow : row.magnitude < 6 ? c.magMid : c.magHigh })

      const dateCell = el('td', { className: cx.tableCell })
      dateCell.textContent = row.date

      const sightingsCell = el('td', { className: cx.tableCell })
      sightingsCell.textContent = String(row.sightingCount)
      setStyles(sightingsCell, { color: 'var(--color-green)' })

      const distCell = el('td', { className: cx.tableCell })
      distCell.textContent = `${row.avgDistKm} km`

      tr.appendChild(locCell)
      tr.appendChild(magCell)
      tr.appendChild(dateCell)
      tr.appendChild(sightingsCell)
      tr.appendChild(distCell)
      this.tableBody.appendChild(tr)
    }
  }

  // ─── Legend factory ─────────────────────────────────────────────

  private buildLegend (items: Array<{ label: string; color: string }>): HTMLElement {
    const legend = h('div', { className: appCx.viewLegend })
    for (const item of items) {
      const swatch = h('span', { className: `${appCx.viewLegendSwatch} ${cx.legendSwatch}` })
      setStyles(swatch, { background: item.color })
      legend.appendChild(
        h('span', { className: appCx.viewLegendItem }, swatch, item.label)
      )
    }
    return legend
  }

  // ─── Heatmap note ───────────────────────────────────────────────

  private buildHeatNote (): HTMLElement {
    const items: Array<{ label: string; desc: string; color: string }> = [
      { label: SEISMIC.NOTE_HEAT_LABEL, desc: SEISMIC.NOTE_HEAT_DESC, color: 'var(--color-cyan)' },
      { label: SEISMIC.NOTE_EQL_LINE_LABEL, desc: SEISMIC.NOTE_EQL_LINE_DESC, color: 'var(--color-amber)' }
    ]

    const list = h('ul', { className: cx.noteList })

    for (const item of items) {
      const labelSpan = h('span', { className: cx.noteLabel }, item.label)
      setStyles(labelSpan, { color: item.color })
      list.appendChild(
        h('li', { className: cx.noteItem }, labelSpan, ` ${item.desc}`)
      )
    }

    return h('div', { className: cx.note }, list)
  }

  // ─── Resize observer ───────────────────────────────────────────

  private bindResizeObserver (): void {
    let rafId = 0
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => { this.drawHeatmap() })
    })
    this.resizeObserver.observe(this.contentEl)
    this.own(() => {
      this.resizeObserver?.disconnect()
      this.resizeObserver = null
    })
  }

  // ─── Heatmap canvas ─────────────────────────────────────────────

  private drawHeatmap (): void {
    const canvas = this.heatCanvas
    const wrapper = this.heatScrollWrapper
    const viewportW = wrapper.getBoundingClientRect().width
    if (viewportW <= 0) return

    const contentW = Math.max(viewportW, MIN_SCATTER_W)
    const padX = getPadX(contentW)
    const hourSteps = getHourSteps(contentW)

    const dpr = window.devicePixelRatio || 1
    canvas.width = contentW * dpr
    canvas.height = SCATTER_H * dpr
    setStyles(canvas, { width: `${contentW}px`, height: `${SCATTER_H}px` })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const c = getCanvasColors()
    const { isLightTheme } = useTheme()
    const isLight = isLightTheme()
    const w = contentW
    const plotW = w - padX - 16
    const plotH = SCATTER_H - PAD_Y - PAD_BOTTOM

    // Empty state
    if (this.scatterData.length === 0) {
      ctx.fillStyle = c.text
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(SEISMIC.NO_PAIRS, w / 2, SCATTER_H / 2)
      return
    }

    // ── Build density grid ────────────────────────────────────────

    const grid: number[][] = Array.from({ length: BINS_Y }, () => new Array(BINS_X).fill(0))
    const eqlGrid: number[][] = Array.from({ length: BINS_Y }, () => new Array(BINS_X).fill(0))

    for (const d of this.scatterData) {
      const bx = Math.min(
        Math.max(Math.floor(((d.hoursDelta + MAX_HOURS) / (MAX_HOURS * 2)) * BINS_X), 0),
        BINS_X - 1
      )
      const by = Math.min(
        Math.max(Math.floor((d.distKm / MAX_DIST_KM) * BINS_Y), 0),
        BINS_Y - 1
      )
      grid[by][bx]++
      if (d.isEQL) eqlGrid[by][bx]++
    }

    // Store for hover reads
    this.heatGrid = grid
    this.heatEqlGrid = eqlGrid

    const maxCount = Math.max(...grid.flat(), 1)
    const cellW = plotW / BINS_X
    const cellH = plotH / BINS_Y

    // ── Draw cells ────────────────────────────────────────────────

    for (let row = 0; row < BINS_Y; row++) {
      for (let col = 0; col < BINS_X; col++) {
        const count = grid[row][col]
        if (count === 0) continue
        ctx.fillStyle = heatColor(count / maxCount, isLight)
        ctx.fillRect(
          padX + col * cellW + 0.5,
          PAD_Y + row * cellH + 0.5,
          cellW - 1,
          cellH - 1
        )
      }
    }

    // ── Grid lines + axis labels ──────────────────────────────────

    ctx.lineWidth = 1
    ctx.font = 'bold 8px monospace'

    for (const hrs of hourSteps) {
      const x = padX + ((hrs + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
      ctx.strokeStyle = c.grid
      ctx.beginPath()
      ctx.moveTo(x, PAD_Y)
      ctx.lineTo(x, PAD_Y + plotH)
      ctx.stroke()
      ctx.fillStyle = c.text
      ctx.textAlign = 'center'
      ctx.fillText(`${hrs}h`, x, SCATTER_H - 20)
    }

    const distSteps = [0, 100, 200, 300]
    for (const km of distSteps) {
      const y = PAD_Y + (km / MAX_DIST_KM) * plotH
      ctx.strokeStyle = c.grid
      ctx.beginPath()
      ctx.moveTo(padX, y)
      ctx.lineTo(w - 16, y)
      ctx.stroke()
      ctx.fillStyle = c.text
      ctx.textAlign = 'right'
      ctx.fillText(`${km}`, padX - 6, y + 3)
    }

    // ── Reference lines ───────────────────────────────────────────

    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.5

    const zeroX = padX + (MAX_HOURS / (MAX_HOURS * 2)) * plotW
    ctx.strokeStyle = c.refLine
    ctx.beginPath()
    ctx.moveTo(zeroX, PAD_Y)
    ctx.lineTo(zeroX, PAD_Y + plotH)
    ctx.stroke()

    const eqlY = PAD_Y + (EQL_DIST_LINE / MAX_DIST_KM) * plotH
    ctx.strokeStyle = c.refLineEql
    ctx.beginPath()
    ctx.moveTo(padX, eqlY)
    ctx.lineTo(w - 16, eqlY)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.lineWidth = 1

    // ── Axis labels ───────────────────────────────────────────────

    ctx.fillStyle = c.text
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(SEISMIC.SCATTER_X, padX + plotW / 2, SCATTER_H - 4)

    ctx.save()
    ctx.translate(10, PAD_Y + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(SEISMIC.SCATTER_Y, 0, 0)
    ctx.restore()
  }

  // ─── Heatmap hover ──────────────────────────────────────────────

  private bindHeatmapHover (): void {
    const canvas = this.heatCanvas

    const handleHover = (clientX: number, clientY: number): void => {
      const rect = canvas.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top

      const padX = getPadX(canvas.clientWidth)
      const plotW = canvas.clientWidth - padX - 16
      const plotH = SCATTER_H - PAD_Y - PAD_BOTTOM

      if (mx < padX || mx > padX + plotW || my < PAD_Y || my > PAD_Y + plotH) {
        hide(this.heatTooltip)
        return
      }

      const col = Math.min(Math.floor(((mx - padX) / plotW) * BINS_X), BINS_X - 1)
      const row = Math.min(Math.floor(((my - PAD_Y) / plotH) * BINS_Y), BINS_Y - 1)

      const count = this.heatGrid[row]?.[col] ?? 0
      if (count === 0) { hide(this.heatTooltip); return }

      const eqlCount = this.heatEqlGrid[row]?.[col] ?? 0
      const hPerBin = (MAX_HOURS * 2) / BINS_X
      const h0 = Math.round(-MAX_HOURS + col * hPerBin)
      const h1 = Math.round(h0 + hPerBin)
      const kmPerBin = MAX_DIST_KM / BINS_Y
      const d0 = Math.round(row * kmPerBin)
      const d1 = Math.round(d0 + kmPerBin)

      const eqlSuffix = eqlCount > 0
        ? ` — ${eqlCount} ${SEISMIC.HEAT_TOOLTIP_EQL_SUFFIX}`
        : ''

      setText(
        this.heatTooltip,
        `${count} ${SEISMIC.HEAT_TOOLTIP_SIGHTINGS} — ${h0}h to ${h1}h — ${d0}–${d1} km${eqlSuffix}`
      )
      show(this.heatTooltip)
    }

    canvas.addEventListener('mousemove', (e: MouseEvent) => handleHover(e.clientX, e.clientY))
    canvas.addEventListener('mouseleave', () => { hide(this.heatTooltip) })

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleHover(e.touches[0].clientX, e.touches[0].clientY)
      }
    }, { passive: true })
    canvas.addEventListener('touchend', () => { hide(this.heatTooltip) }, { passive: true })
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy (): void {
    super.destroy()
  }
}
