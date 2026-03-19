/* ------------------------------------------------------------------ *
 *  SeismicView — Earthquake proximity vs sighting visualizer          *
 *                                                                     *
 *  Canvas scatter plot: distance (km) vs time delta (hours)           *
 *  Each dot = one sighting–earthquake pair, sized by magnitude.       *
 *  EQL candidates highlighted in amber.                               *
 *                                                                     *
 *  Theme-aware canvas (same pattern as Timeline).                     *
 *  Canvas wrapped in scroll container for narrow viewports.           *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, el, hide, show, setText, setStyles } from '@/core/dom'
import { palette } from '@/styles/palette'
import { useSeismic, useAppStore, useTheme } from '@/composables'
import { Loader } from '@/components/loader'
import { YearSelector } from '@/components/year-selector'
import { StatCard, createStatValue, StatCardGrid } from '@/components/stat-card'
import { SEISMIC } from '@/data/strings'
import type { Sighting, NearbyEarthquake } from '@/types'

// ─── Canvas constants ───────────────────────────────────────────────

const SCATTER_H = 320
const PAD_Y = 20
const PAD_BOTTOM = 42
const MAX_HOURS = 72
const MAX_DIST_KM = 300
const DOT_MIN_R = 3
const EQL_DIST_LINE = 120
const MIN_SCATTER_W = 420

// ─── Responsive helpers ─────────────────────────────────────────────

/** Y-axis label gutter — narrower on small screens */
function getPadX (canvasW: number): number {
  return canvasW < 300 ? 32 : 52
}

/** Max dot radius — smaller on narrow viewports to reduce overlap */
function getDotMaxR (canvasW: number): number {
  return canvasW < 300 ? 8 : 12
}

/** X-axis hour labels — drop ±72 on very small screens */
const HOUR_STEPS_FULL = [-72, -48, -24, 0, 24, 48, 72]
const HOUR_STEPS_COMPACT = [-48, -24, 0, 24, 48]

function getHourSteps (canvasW: number): number[] {
  return canvasW < 300 ? HOUR_STEPS_COMPACT : HOUR_STEPS_FULL
}

// ─── Theme-aware canvas colors ──────────────────────────────────────

interface CanvasColors {
  text: string
  grid: string
  dot: string
  dotEql: string
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
      dot: palette.cyan600_35,
      dotEql: palette.amber600_70,
      refLine: palette.amber600_20,
      refLineEql: palette.red600_30,
      magLow: palette.cyan600,
      magMid: palette.amber600,
      magHigh: palette.red600
    }
    : {
      text: palette.white50,
      grid: palette.white08,
      dot: palette.cyan500_35,
      dotEql: palette.amber500_70,
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

  private scatterCanvas!: HTMLCanvasElement
  private scatterScrollWrapper!: HTMLElement
  private scatterTooltip!: HTMLElement
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

    requestAnimationFrame(() => {
      this.drawScatter()
    })

    this.bindResizeObserver()

    // Re-compute when sightings change (year range or filter)
    store.sightings.subscribe(async (newSightings) => {
      if (!this.loaded) return
      const { from: f, to: t } = store.yearRange.get()
      await seismic.ensureYears(f, t)
      await this.computeData(newSightings)
      this.updateStats()
      this.updateTable()
      requestAnimationFrame(() => this.drawScatter())
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

    // Redraw on theme change
    const { theme } = useTheme()
    theme.subscribe(() => {
      if (!this.loaded) return
      requestAnimationFrame(() => this.drawScatter())
    })
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

    // Scatter
    this.scatterCanvas = el('canvas', { className: cx.canvas })
    this.scatterCanvas.height = SCATTER_H
    this.scatterTooltip = h('div', { className: cx.tooltip })
    hide(this.scatterTooltip)

    this.scatterScrollWrapper = h('div', { className: cx.scrollWrapper },
      this.scatterCanvas
    )

    const scatterPanel = h('div', { className: cx.panel },
      this.scatterScrollWrapper,
      this.scatterTooltip,
      this.buildLegend([
        { label: SEISMIC.LEGEND_PAIR, color: 'var(--color-cyan)' },
        { label: SEISMIC.LEGEND_EQL, color: 'var(--color-amber)' }
      ]),
      this.buildScatterNote()
    )
    this.bindScatterHover()

    const scatterSection = h('div', { className: cx.section },
      el('h2', { className: cx.sectionTitle }, [SEISMIC.SCATTER_TITLE]),
      h('div', { className: cx.sectionSub }, SEISMIC.SCATTER_SUBTITLE),
      scatterPanel
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

    const tablePanel = h('div', { className: cx.panel, style: 'padding: 0; overflow: hidden' }, table)

    const tableSection = h('div', { className: cx.section },
      el('h2', { className: cx.sectionTitle }, [SEISMIC.TABLE_TITLE]),
      h('div', { className: cx.sectionSub }, SEISMIC.TABLE_SUBTITLE),
      tablePanel
    )

    this.contentEl.appendChild(statsBar)
    this.contentEl.appendChild(scatterSection)
    this.contentEl.appendChild(tableSection)
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

  // ─── Scatter note (colored bullet list) ─────────────────────────

  private buildScatterNote (): HTMLElement {
    const items: Array<{ label: string; desc: string; color: string }> = [
      { label: SEISMIC.NOTE_BLUE_LABEL, desc: SEISMIC.NOTE_BLUE_DESC, color: 'var(--color-cyan)' },
      { label: SEISMIC.NOTE_ORANGE_LABEL, desc: SEISMIC.NOTE_ORANGE_DESC, color: 'var(--color-amber)' },
      { label: SEISMIC.NOTE_SIZE_LABEL, desc: SEISMIC.NOTE_SIZE_DESC, color: 'var(--color-muted)' }
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
      rafId = requestAnimationFrame(() => {
        this.drawScatter()
      })
    })
    this.resizeObserver.observe(this.contentEl)
  }

  // ─── Scatter canvas ─────────────────────────────────────────────

  private drawScatter (): void {
    const canvas = this.scatterCanvas
    const wrapper = this.scatterScrollWrapper
    const viewportW = wrapper.getBoundingClientRect().width
    if (viewportW <= 0) return

    const contentW = Math.max(viewportW, MIN_SCATTER_W)
    const padX = getPadX(contentW)
    const dotMaxR = getDotMaxR(contentW)
    const hourSteps = getHourSteps(contentW)

    const dpr = window.devicePixelRatio || 1
    canvas.width = contentW * dpr
    canvas.height = SCATTER_H * dpr
    setStyles(canvas, { width: contentW + 'px', height: SCATTER_H + 'px' })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const c = getCanvasColors()
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

    // Grid
    ctx.strokeStyle = c.grid
    ctx.lineWidth = 1

    // X-axis grid + labels (hours)
    ctx.font = 'bold 8px monospace'
    ctx.fillStyle = c.text
    ctx.textAlign = 'center'

    for (const hrs of hourSteps) {
      const x = padX + ((hrs + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
      ctx.strokeStyle = c.grid
      ctx.beginPath()
      ctx.moveTo(x, PAD_Y)
      ctx.lineTo(x, PAD_Y + plotH)
      ctx.stroke()
      ctx.fillStyle = c.text
      ctx.fillText(`${hrs}h`, x, SCATTER_H - 20)
    }

    // Y-axis grid + labels (distance)
    ctx.textAlign = 'right'
    const distSteps = [0, 100, 200, 300]
    for (const km of distSteps) {
      const y = PAD_Y + (km / MAX_DIST_KM) * plotH
      ctx.strokeStyle = c.grid
      ctx.beginPath()
      ctx.moveTo(padX, y)
      ctx.lineTo(w - 16, y)
      ctx.stroke()
      ctx.fillStyle = c.text
      ctx.fillText(`${km}`, padX - 6, y + 3)
    }

    // Reference lines
    ctx.setLineDash([4, 4])

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

    // Axis labels
    ctx.fillStyle = c.text
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(SEISMIC.SCATTER_X, padX + plotW / 2, SCATTER_H - 4)

    ctx.save()
    ctx.translate(10, PAD_Y + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(SEISMIC.SCATTER_Y, 0, 0)
    ctx.restore()

    // Sort: non-EQL first, EQL on top
    const sorted = [...this.scatterData].sort((a, b) => {
      if (a.isEQL === b.isEQL) return 0
      return a.isEQL ? 1 : -1
    })

    for (const d of sorted) {
      const x = padX + ((d.hoursDelta + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
      const y = PAD_Y + (d.distKm / MAX_DIST_KM) * plotH

      if (x < padX || x > padX + plotW) continue
      if (y < PAD_Y || y > PAD_Y + plotH) continue

      const magNorm = (d.magnitude - 4) / 4
      const r = DOT_MIN_R + magNorm * (dotMaxR - DOT_MIN_R)

      ctx.globalAlpha = d.isEQL ? 0.85 : 0.35
      ctx.fillStyle = d.isEQL ? c.dotEql : c.dot
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ─── Scatter hover ──────────────────────────────────────────────

  private bindScatterHover (): void {
    const canvas = this.scatterCanvas

    const handleHover = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top

      const padX = getPadX(canvas.clientWidth)
      const plotW = canvas.clientWidth - padX - 16
      const plotH = SCATTER_H - PAD_Y - PAD_BOTTOM

      let nearest: ScatterPoint | null = null
      let minDist = Infinity

      for (const d of this.scatterData) {
        const x = padX + ((d.hoursDelta + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
        const y = PAD_Y + (d.distKm / MAX_DIST_KM) * plotH
        const dist = Math.hypot(mx - x, my - y)
        if (dist < 20 && dist < minDist) {
          minDist = dist
          nearest = d
        }
      }

      if (!nearest) { hide(this.scatterTooltip); return }

      const deltaLabel = nearest.hoursDelta > 0
        ? `${nearest.hoursDelta}h after quake`
        : `${Math.abs(nearest.hoursDelta)}h before quake`
      const eqlLabel = nearest.isEQL ? ` — ${SEISMIC.POSSIBLE_EQL}` : ''
      setText(this.scatterTooltip, `M${nearest.magnitude} — ${nearest.distKm} km — ${deltaLabel}${eqlLabel}`)
      show(this.scatterTooltip)
    }

    canvas.addEventListener('mousemove', (e: MouseEvent) => handleHover(e.clientX, e.clientY))
    canvas.addEventListener('mouseleave', () => { hide(this.scatterTooltip) })

    // Touch support
    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleHover(e.touches[0].clientX, e.touches[0].clientY)
      }
    }, { passive: true })
    canvas.addEventListener('touchend', () => { hide(this.scatterTooltip) }, { passive: true })
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy (): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    super.destroy()
  }
}
