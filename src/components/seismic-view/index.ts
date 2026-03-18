/* ------------------------------------------------------------------ *
 *  SeismicView — Earthquake proximity vs sighting visualizer          *
 *                                                                     *
 *  Canvas scatter plot: distance (km) vs time delta (hours)           *
 *  Each dot = one sighting–earthquake pair, sized by magnitude.       *
 *  EQL candidates highlighted in amber.                               *
 *                                                                     *
 *  Table: strongest earthquake–sighting correlations.                 *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, el, hide, show, setText, setStyles } from '@/utils/dom'
import { palette } from '@/styles/palette'
import { useSeismic, useAppStore } from '@/composables'
import { Loader } from '@/components/loader'
import { SEISMIC } from '@/data/strings'
import type { Sighting, NearbyEarthquake } from '@/types'

// ─── Canvas constants ───────────────────────────────────────────────

const SCATTER_H = 320
const PAD_X = 52
const PAD_Y = 20
const PAD_BOTTOM = 28
const MAX_HOURS = 72
const MAX_DIST_KM = 300
const DOT_MIN_R = 3
const DOT_MAX_R = 12
const EQL_DIST_LINE = 120

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

  private scatterCanvas!: HTMLCanvasElement
  private scatterTooltip!: HTMLElement

  private scatterData: ScatterPoint[] = []
  private topCorrelations: TopCorrelation[] = []
  private totalPairs = 0
  private eqlCount = 0
  private avgDist = 0
  private avgMag = 0
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

    const seismic = useSeismic()
    await seismic.load()

    const store = useAppStore()
    const sightings = store.sightings.get()

    // Load earthquake year files matching the current sighting range
    const { from, to } = store.yearRange.get()
    await seismic.ensureYears(from, to)

    this.computeData(sightings)
    this.buildContent()
    this.loaded = true

    hide(this.loaderEl)
    show(this.contentEl)

    requestAnimationFrame(() => {
      this.drawScatter()
    })
  }

  // ─── Data computation ───────────────────────────────────────────

  private computeData (sightings: Sighting[]): void {
    const seismic = useSeismic()
    const pairs = seismic.getCorrelatedPairs(sightings)

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
    }

    // Build top correlations: group by earthquake ID, count sightings
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
      .filter(e => e.sightingIds.size >= 2)
      .sort((a, b) => b.sightingIds.size - a.sightingIds.size)
      .slice(0, 8)
      .map(e => ({
        location: e.location,
        magnitude: e.magnitude,
        date: e.date,
        sightingCount: e.sightingIds.size,
        avgDistKm: Math.round(e.totalDist / e.sightingIds.size)
      }))
  }

  // ─── Build DOM ──────────────────────────────────────────────────

  private buildContent (): void {
    // Stats
    const statsBar = h('div', { className: cx.stats },
      this.createStat(SEISMIC.STAT_PAIRS, String(this.totalPairs), SEISMIC.STAT_PAIRS_SUB, palette.cyan500),
      this.createStat(SEISMIC.STAT_EQL, String(this.eqlCount), SEISMIC.STAT_EQL_SUB, palette.amber500),
      this.createStat(SEISMIC.STAT_AVG_DIST, `${this.avgDist} km`, SEISMIC.STAT_AVG_DIST_SUB, palette.green500),
      this.createStat(SEISMIC.STAT_AVG_MAG, `M${this.avgMag}`, SEISMIC.STAT_AVG_MAG_SUB, palette.cyan500)
    )

    // Scatter section
    this.scatterCanvas = el('canvas', { className: cx.canvas })
    this.scatterCanvas.height = SCATTER_H
    this.scatterTooltip = h('div', { className: cx.tooltip })
    hide(this.scatterTooltip)

    const scatterPanel = h('div', { className: cx.panel },
      this.scatterCanvas,
      this.scatterTooltip,
      this.buildLegend([
        { label: SEISMIC.LEGEND_PAIR, color: palette.cyan500 },
        { label: SEISMIC.LEGEND_EQL, color: palette.amber500 }
      ])
    )

    this.bindScatterHover()

    const scatterSection = h('div', { className: cx.section },
      h('div', { className: cx.sectionTitle }, SEISMIC.SCATTER_TITLE),
      h('div', { className: cx.sectionSub }, SEISMIC.SCATTER_SUBTITLE),
      scatterPanel
    )

    // Table section
    const tableSection = this.buildTableSection()

    this.contentEl.appendChild(statsBar)
    this.contentEl.appendChild(scatterSection)
    if (tableSection) this.contentEl.appendChild(tableSection)
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

  // ─── Scatter canvas ─────────────────────────────────────────────

  private drawScatter (): void {
    const canvas = this.scatterCanvas
    const rect = canvas.parentElement?.getBoundingClientRect()
    if (!rect) return

    const w = rect.width - 32
    if (w <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = SCATTER_H * dpr
    setStyles(canvas, { width: w + 'px', height: SCATTER_H + 'px' })

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const plotW = w - PAD_X - 16
    const plotH = SCATTER_H - PAD_Y - PAD_BOTTOM

    // Grid
    ctx.strokeStyle = palette.white08
    ctx.lineWidth = 1

    // X-axis grid + labels (hours)
    const hourSteps = [-72, -48, -24, 0, 24, 48, 72]
    ctx.font = 'bold 8px monospace'
    ctx.fillStyle = palette.white50
    ctx.textAlign = 'center'

    for (const hrs of hourSteps) {
      const x = PAD_X + ((hrs + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
      ctx.beginPath()
      ctx.moveTo(x, PAD_Y)
      ctx.lineTo(x, PAD_Y + plotH)
      ctx.stroke()
      ctx.fillText(`${hrs}h`, x, SCATTER_H - 8)
    }

    // Y-axis grid + labels (distance)
    ctx.textAlign = 'right'
    const distSteps = [0, 100, 200, 300]
    for (const km of distSteps) {
      const y = PAD_Y + (km / MAX_DIST_KM) * plotH
      ctx.beginPath()
      ctx.moveTo(PAD_X, y)
      ctx.lineTo(w - 16, y)
      ctx.stroke()
      ctx.fillText(`${km}`, PAD_X - 6, y + 3)
    }

    // Reference lines
    // Vertical: 0 hours (earthquake moment)
    ctx.strokeStyle = palette.amber500_20
    ctx.setLineDash([4, 4])
    const zeroX = PAD_X + (MAX_HOURS / (MAX_HOURS * 2)) * plotW
    ctx.beginPath()
    ctx.moveTo(zeroX, PAD_Y)
    ctx.lineTo(zeroX, PAD_Y + plotH)
    ctx.stroke()

    // Horizontal: EQL distance threshold
    ctx.strokeStyle = palette.red500_30
    const eqlY = PAD_Y + (EQL_DIST_LINE / MAX_DIST_KM) * plotH
    ctx.beginPath()
    ctx.moveTo(PAD_X, eqlY)
    ctx.lineTo(w - 16, eqlY)
    ctx.stroke()
    ctx.setLineDash([])

    // Axis labels
    ctx.fillStyle = palette.white50
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(SEISMIC.SCATTER_X, PAD_X + plotW / 2, SCATTER_H - 1)

    ctx.save()
    ctx.translate(10, PAD_Y + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(SEISMIC.SCATTER_Y, 0, 0)
    ctx.restore()

    // Sort: draw non-EQL first, EQL on top
    const sorted = [...this.scatterData].sort((a, b) => {
      if (a.isEQL === b.isEQL) return 0
      return a.isEQL ? 1 : -1
    })

    // Dots
    for (const d of sorted) {
      const x = PAD_X + ((d.hoursDelta + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
      const y = PAD_Y + (d.distKm / MAX_DIST_KM) * plotH

      // Clamp to plot area
      if (x < PAD_X || x > PAD_X + plotW) continue
      if (y < PAD_Y || y > PAD_Y + plotH) continue

      const magNorm = (d.magnitude - 4) / 4
      const r = DOT_MIN_R + magNorm * (DOT_MAX_R - DOT_MIN_R)

      ctx.globalAlpha = d.isEQL ? 0.85 : 0.35
      ctx.fillStyle = d.isEQL ? palette.amber500 : palette.cyan500
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ─── Scatter hover ──────────────────────────────────────────────

  private bindScatterHover (): void {
    const canvas = this.scatterCanvas

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const plotW = rect.width - PAD_X - 16
      const plotH = SCATTER_H - PAD_Y - PAD_BOTTOM

      // Find nearest point
      let nearest: ScatterPoint | null = null
      let minDist = Infinity

      for (const d of this.scatterData) {
        const x = PAD_X + ((d.hoursDelta + MAX_HOURS) / (MAX_HOURS * 2)) * plotW
        const y = PAD_Y + (d.distKm / MAX_DIST_KM) * plotH
        const dist = Math.hypot(mx - x, my - y)
        if (dist < 20 && dist < minDist) {
          minDist = dist
          nearest = d
        }
      }

      if (!nearest) {
        hide(this.scatterTooltip)
        return
      }

      const deltaLabel = nearest.hoursDelta > 0
        ? `${nearest.hoursDelta}h after quake`
        : `${Math.abs(nearest.hoursDelta)}h before quake`
      const eqlLabel = nearest.isEQL ? ` — ${SEISMIC.POSSIBLE_EQL}` : ''
      setText(this.scatterTooltip, `M${nearest.magnitude} — ${nearest.distKm} km — ${deltaLabel}${eqlLabel}`)
      setStyles(this.scatterTooltip, { color: nearest.isEQL ? palette.amber500 : palette.cyan500 })
      show(this.scatterTooltip)
    })

    canvas.addEventListener('mouseleave', () => {
      hide(this.scatterTooltip)
    })
  }

  // ─── Top correlations table ─────────────────────────────────────

  private buildTableSection (): HTMLElement | null {
    if (this.topCorrelations.length === 0) return null

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

    const tbody = el('tbody')
    for (const row of this.topCorrelations) {
      const tr = el('tr', { className: cx.tableRow })

      const locCell = el('td', { className: cx.tableCell })
      locCell.textContent = row.location
      setStyles(locCell, { color: palette.white50 })

      const magCell = el('td', { className: cx.tableCell })
      magCell.textContent = `M${row.magnitude}`
      setStyles(magCell, { color: this.magColor(row.magnitude) })

      const dateCell = el('td', { className: cx.tableCell })
      dateCell.textContent = row.date
      setStyles(dateCell, { color: palette.white50 })

      const sightingsCell = el('td', { className: cx.tableCell })
      sightingsCell.textContent = String(row.sightingCount)
      setStyles(sightingsCell, { color: palette.green500 })

      const distCell = el('td', { className: cx.tableCell })
      distCell.textContent = `${row.avgDistKm} km`
      setStyles(distCell, { color: palette.white50 })

      tr.appendChild(locCell)
      tr.appendChild(magCell)
      tr.appendChild(dateCell)
      tr.appendChild(sightingsCell)
      tr.appendChild(distCell)
      tbody.appendChild(tr)
    }

    const table = el('table', { className: cx.table })
    table.appendChild(thead)
    table.appendChild(tbody)

    const tablePanel = h('div', { className: cx.panel, style: 'padding: 0; overflow: hidden' },
      table
    )

    return h('div', { className: cx.section },
      h('div', { className: cx.sectionTitle }, SEISMIC.TABLE_TITLE),
      h('div', { className: cx.sectionSub }, SEISMIC.TABLE_SUBTITLE),
      tablePanel
    )
  }

  private magColor (mag: number): string {
    if (mag < 5) return palette.cyan500
    if (mag < 6) return palette.amber500
    return palette.red500
  }
}
