/* ------------------------------------------------------------------ *
 *  App — top-level orchestrator                                       *
 *                                                                     *
 *  Lifecycle:                                                         *
 *    1. create()       → Build the DOM shell (header, ticker, loader) *
 *    2. init()         → Load data, hydrate store, render grids       *
 *                                                                     *
 *  Internal flow:                                                     *
 *    loadManifests → hydrateStore → buildControls → progressiveLoad   *
 *    → buildBelowFold → finalize                                     *
 * ------------------------------------------------------------------ */

import './app.css'
import { Component } from '@/core'
import { h, mount, clearChildren } from '@/utils/dom'
import { useDataSource, useTicker, useAppStore, useAnalytics, batch, minDelay, filterSightings } from '@/composables'
import { AlertVariant } from '@/enums'
import { Header } from '@/components/header'
import { Ticker } from '@/components/ticker'
import { Loader } from '@/components/loader'
import { Section } from '@/components/layout'
import { DataSources } from '@/components/data-sources'
import { Alert } from '@/components/alert'
import { Footer } from '@/components/footer'
import { YearSelector } from '@/components/year-selector'
import { FilterToolbar } from '@/components/filter-toolbar'
import { SightingGrids } from '@/components/sighting-grid'
import { SightingMap } from '@/components/sighting-map'
import { Timeline } from '@/components/timeline'
import { WelcomeModal } from '@/components/welcome-modal'
import { SECTION } from '@/data/strings'

import type { Sighting } from '@/types'

export class App extends Component {
  private store = useAppStore()
  private dataSource = useDataSource()
  private tickerMessages = useTicker()

  private main!: HTMLElement
  private ticker!: Ticker
  private grids!: SightingGrids
  private sightingMap!: SightingMap
  private timeline!: Timeline
  private renderVersion = 0
  private yearRangeReady = false

  // ─── Shell ─────────────────────────────────────────────────────

  protected create(): HTMLElement {
    this.main = h('main', { className: 'app-main', role: 'main' },
      h('div', { className: 'app-loader' }, new Loader({}).el)
    )

    this.ticker = new Ticker({
      onClick: (id) => this.grids.scrollToSighting(id)
    })

    this.grids = new SightingGrids({})

    this.sightingMap = new SightingMap({})

    this.timeline = new Timeline({
      onRangeSelect: (from, to) => {
        this.store.yearRange.set({ from, to })
      }
    })

    return h('div', { className: 'app' },
      h('div', { className: 'scanlines' }),
      new Header({}).el,
      this.ticker.el,
      this.main
    )
  }

  // ─── Initialization ────────────────────────────────────────────

  async init(): Promise<void> {
    const analytics = useAnalytics()
    analytics.init()
    analytics.pageView()

    this.showWelcome()
    await this.loadManifests()
    this.hydrateStore()
    this.buildControls()
    this.bindReactions()
    await this.progressiveLoad()
    this.buildBelowFold()
    this.finalize()
  }

  // ─── Phase: Load manifests ─────────────────────────────────────

  private async loadManifests(): Promise<void> {
    await this.dataSource.loadManifests()
  }

  // ─── Phase: Hydrate store ──────────────────────────────────────

  private hydrateStore(): void {
    const years = this.dataSource.getAvailableYears()
    const newest = years[0] ?? new Date().getFullYear()
    const defaultFrom = newest - 5

    batch(() => {
      this.store.availableYears.set(years)
      this.store.totalCount.set(this.dataSource.getTotalCount())
      this.store.sources.set(this.dataSource.getSources())
      this.store.yearRange.set({ from: defaultFrom, to: newest })
    })
  }

  // ─── Phase: Build controls ─────────────────────────────────────

  private buildControls(): void {
    const controlsForm = h('form', {
      className: 'controls-form',
      autocomplete: 'off',
      onSubmit: (e: Event) => e.preventDefault()
    },
      new YearSelector({}).el,
      new FilterToolbar({}).el
    )

    this.showAllLoaders()

    clearChildren(this.main)
    this.main.appendChild(controlsForm)
    this.main.appendChild(this.timeline.el)
    this.main.appendChild(this.sightingMap.el)
    this.main.appendChild(this.grids.el)
  }

  // ─── Phase: Bind reactions ─────────────────────────────────────

  private bindReactions(): void {
    this.store.filter.subscribe(() => this.onFilterChange())

    this.store.yearRange.subscribe(async () => {
      if (!this.yearRangeReady) return
      if (this.store.loading.get()) return
      await this.onYearRangeChange()
    })
  }

  // ─── Phase: Progressive load ───────────────────────────────────

  private async progressiveLoad(): Promise<Sighting[]> {
    const { from, to } = this.store.yearRange.get()

    return this.dataSource.fetchProgressive(from, to, (partial) => {
      this.store.sightings.set(partial)
      this.store.shownCount.set(partial.length)
      this.grids.render(partial)
    })
  }

  // ─── Phase: Below-fold content ─────────────────────────────────

  private buildBelowFold(): void {
    const sourcesBody = h('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '10px' }
    })

    sourcesBody.appendChild(
      new Alert({
        variant: AlertVariant.INFO,
        title: SECTION.INTEL_TITLE,
        content: SECTION.INTEL_CONTENT,
        dismissible: true
      }).el
    )

    sourcesBody.appendChild(
      new DataSources({ sources: this.store.sources.get() }).el
    )

    this.main.appendChild(
      new Section({
        title: SECTION.DATA_SOURCES,
        tooltip: SECTION.DATA_SOURCES_TOOLTIP,
        content: sourcesBody
      }).el
    )

    this.main.appendChild(new Footer({}).el)
  }

  // ─── Phase: Finalize ───────────────────────────────────────────

  private finalize(): void {
    const sightings = this.store.sightings.get()
    const years = this.store.availableYears.get()
    const { from, to } = this.store.yearRange.get()

    batch(() => {
      this.store.shownCount.set(sightings.length)
      this.store.totalCount.set(this.dataSource.getTotalCount())
    })

    this.ticker.setMessages(
      this.tickerMessages.generateMessages(sightings)
    )

    // Populate map and timeline
    this.sightingMap.setSightings(sightings)
    this.timeline.setManifestCounts(
      this.dataSource.getYearCounts(),
      years[years.length - 1] ?? 1900,
      years[0] ?? new Date().getFullYear()
    )
    this.timeline.setActiveRange(from, to)
    this.hideAllLoaders()

    this.yearRangeReady = true
  }

  // ─── Phase: Show welcome ───────────────────────────────────────

  private showWelcome(): void {
    WelcomeModal.show()
  }

  // ─── Reactions ─────────────────────────────────────────────────

  private showAllLoaders(): void {
    const loader = () => h('div', { className: 'app-loader' }, new Loader({}).el)
    this.grids.showLoader(loader())
    this.timeline.showLoader(loader())
    this.sightingMap.showLoader(loader())
  }

  private hideAllLoaders(): void {
    this.timeline.hideLoader()
    this.sightingMap.hideLoader()
  }

  private async onFilterChange(): Promise<void> {
    const version = ++this.renderVersion
    const release = this.grids.lockHeight()

    this.showAllLoaders()

    const filtered = await minDelay(() =>
      filterSightings(this.store.sightings.get(), this.store.filter.get())
    )

    if (version !== this.renderVersion) {
      release()
      return
    }

    const releaseRender = this.grids.lockHeight()
    await this.grids.render(filtered, true)
    releaseRender()
    release()

    this.sightingMap.setSightings(filtered)
    this.hideAllLoaders()
    this.store.shownCount.set(filtered.length)
  }

  private async onYearRangeChange(): Promise<void> {
    this.store.loading.set(true)
    this.showAllLoaders()

    const { from, to } = this.store.yearRange.get()
    const sightings = await minDelay(() => this.dataSource.fetchYearRange(from, to))

    batch(() => {
      this.store.sightings.set(sightings)
      this.store.shownCount.set(sightings.length)
      this.store.loading.set(false)
    })

    await this.grids.render(sightings, true)

    this.sightingMap.setSightings(sightings)
    this.timeline.setActiveRange(from, to)
    this.hideAllLoaders()

    this.ticker.setMessages(
      this.tickerMessages.generateMessages(sightings)
    )
  }
}

// ─── Entry point ──────────────────────────────────────────────────

export async function createApp(root: HTMLElement): Promise<void> {
  const app = new App({})
  mount(root, app.el)
  await app.init()
}
