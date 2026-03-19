/* ------------------------------------------------------------------ *
 *  App — top-level orchestrator + shared data pipeline                *
 *                                                                     *
 *  Responsibilities:                                                  *
 *    1. Bootstrap: load manifests, hydrate store, fetch sightings     *
 *    2. Shared data layer: year-range refetches, Russian merge,       *
 *       fireball/nuclear store population — data consumed by ALL      *
 *       views via the reactive store                                  *
 *    3. Render app chrome: header, nav tabs, ticker                   *
 *    4. Route-based view switching with lazy initialization           *
 *                                                                     *
 *  View-specific rendering lives in dedicated view components:        *
 *    MonitorView     — sighting dashboard (hero, map, grids, etc.)    *
 *    GeomagneticView — Kp index vs sighting density                   *
 *    SeismicView     — earthquake proximity vs sightings              *
 * ------------------------------------------------------------------ */

import './app.css'
import { Component, createRouter, RouteName } from '@/core'
import type { Router } from '@/core'
import type { Sighting } from '@/types'
import { h, mount, clearChildren, hide, show } from '@/utils/dom'
import { useDataSource, useTicker, useAppStore, useAnalytics, useFireball, useNuclear, useRussianHistorical, useGeomagnetic, useSeismic, useGdelt, useGnews, useTwitter, useReddit, batch, minDelay } from '@/composables'
import { Header } from '@/components/header'
import { NavTabs } from '@/components/nav-tabs'
import { Ticker } from '@/components/ticker'
import { Loader } from '@/components/loader'
import { MonitorView } from '@/views/monitor-view'
import { GeomagneticView } from '@/views/geomagnetic-view'
import { SeismicView } from '@/views/seismic-view'
import { IntelView } from '@/views/intel-view'
import { DEFAULT_YEAR_OFFSET } from '@/data/config'

// ─── View container factory ─────────────────────────────────────────

function createViewContainer (visible: boolean): HTMLElement {
  const container = h('div', { className: 'app-view-container' },
    h('div', { className: 'app-loader' }, new Loader({}).el)
  )
  if (!visible) hide(container)
  return container
}

// ─── App ────────────────────────────────────────────────────────────

export class App extends Component {
  private store = useAppStore()
  private dataSource = useDataSource()
  private tickerMessages = useTicker()
  private fireball = useFireball()
  private nuclear = useNuclear()
  private russianHistorical = useRussianHistorical()
  private geomagnetic = useGeomagnetic()
  private seismic = useSeismic()

  private ticker!: Ticker
  private yearRangeReady = false

  // ── Router + views ──────────────────────────────────────────────
  private router!: Router
  private navTabs!: NavTabs

  private monContainer!: HTMLElement
  private geoContainer!: HTMLElement
  private seisContainer!: HTMLElement
  private intelContainer!: HTMLElement

  private monView: MonitorView | null = null
  private geoView: GeomagneticView | null = null
  private seisView: SeismicView | null = null
  private intelView: IntelView | null = null

  // ─── Shell ─────────────────────────────────────────────────────

  protected create (): HTMLElement {
    const initialRoute = this.parseInitialRoute()

    this.monContainer = createViewContainer(initialRoute === RouteName.MONITOR)
    this.geoContainer = createViewContainer(initialRoute === RouteName.GEOMAGNETIC)
    this.seisContainer = createViewContainer(initialRoute === RouteName.SEISMIC)
    this.intelContainer = createViewContainer(initialRoute === RouteName.INTEL)

    this.ticker = new Ticker({
      onClick: (id) => this.monView?.scrollToSighting(id)
    })

    this.navTabs = new NavTabs({
      active: initialRoute,
      onNavigate: (route) => this.router?.navigate(route)
    })

    return h('div', { className: 'app' },
      h('div', { className: 'scanlines' }),
      new Header({}).el,
      this.navTabs.el,
      this.ticker.el,
      this.monContainer,
      this.geoContainer,
      this.seisContainer,
      this.intelContainer
    )
  }

  // ─── Initialization ────────────────────────────────────────────

  async init (): Promise<void> {
    // ── All independent network fetches — parallelize ──
    await Promise.all([
      this.dataSource.loadManifests(),
      this.fireball.load(),
      this.nuclear.load(),
      this.russianHistorical.load(),
      this.geomagnetic.load(),
      this.seismic.load(),
      useGdelt().load(),
      useGnews().load(),
      useTwitter().load(),
      useReddit().load()
    ])

    // ── Sequential: each step depends on the one before ──
    this.hydrateStore()
    await this.progressiveLoad()
    this.finalizeData()
    this.bindDataReactions()

    // ── Router: enable view switching after data is ready ──
    this.initRouter()

    setTimeout(() => {
      const analytics = useAnalytics()
      analytics.init()
      analytics.pageView()
    }, 1)
  }

  // ─── Phase: Hydrate store ──────────────────────────────────────

  private hydrateStore (): void {
    const years = this.dataSource.getAvailableYears()
    const newest = years[0] ?? new Date().getFullYear()
    const defaultFrom = newest - DEFAULT_YEAR_OFFSET

    batch(() => {
      this.store.availableYears.set(years)
      this.store.totalCount.set(this.dataSource.getTotalCount())
      this.store.sources.set(this.dataSource.getSources())
      this.store.yearCounts.set(this.dataSource.getYearCounts())
      this.store.yearRange.set({ from: defaultFrom, to: newest })
    })
  }

  // ─── Phase: Progressive load (shared — populates store) ────────

  private async progressiveLoad (): Promise<void> {
    const { from, to } = this.store.yearRange.get()

    await this.dataSource.fetchProgressive(from, to, (partial) => {
      this.store.sightings.set(partial)
      this.store.shownCount.set(partial.length)
    })
  }

  // ─── Phase: Finalize shared data ───────────────────────────────

  private finalizeData (): void {
    // Merge Russian Historical sightings within current year range
    const { from, to } = this.store.yearRange.get()
    const current = this.store.sightings.get()
    const merged = this.mergeRussianHistorical(current, from, to)
    if (merged !== current) {
      this.store.sightings.set(merged)
    }

    const sightings = this.store.sightings.get()

    batch(() => {
      this.store.shownCount.set(sightings.length)
      this.store.totalCount.set(this.dataSource.getTotalCount())
    })

    // Populate fireball store (used by sighting modal across all views)
    const fireballs = this.fireball.getAll()
    this.store.fireballs.set(fireballs)

    // Ticker — app chrome, not view-specific
    this.ticker.setMessages(
      this.tickerMessages.generateMessages(sightings)
    )
  }

  // ─── Phase: Bind data reactions (shared across all views) ──────

  private bindDataReactions (): void {
    this.store.yearRange.subscribe(async () => {
      if (!this.yearRangeReady) return
      if (this.store.loading.get()) return
      await this.onYearRangeChange()
    })

    this.yearRangeReady = true
  }

  private async onYearRangeChange (): Promise<void> {
    this.store.loading.set(true)

    const { from, to } = this.store.yearRange.get()
    const sightings = await minDelay(() => this.dataSource.fetchYearRange(from, to))

    // Re-merge Russian historical for new year range
    const merged = this.mergeRussianHistorical(sightings, from, to)

    batch(() => {
      this.store.sightings.set(merged)
      this.store.shownCount.set(merged.length)
      this.store.loading.set(false)
    })

    // Update ticker with new sightings
    this.ticker.setMessages(
      this.tickerMessages.generateMessages(merged)
    )
  }

  /** Merge Russian historical sightings within [from, to] into a sightings array. */
  private mergeRussianHistorical (sightings: Sighting[], from: number, to: number): Sighting[] {
    const russianSightings = this.russianHistorical.getAll()
    if (russianSightings.length === 0) return sightings

    const ids = new Set(sightings.map(s => s.id))
    const newOnes = russianSightings.filter(s => {
      if (ids.has(s.id)) return false
      const year = parseInt(s.occurredAt?.slice(0, 4) ?? '0', 10)
      return year >= from && year <= to
    })

    return newOnes.length > 0 ? [...sightings, ...newOnes] : sightings
  }

  // ─── Router ────────────────────────────────────────────────────

  private parseInitialRoute (): RouteName {
    const path = window.location.pathname
    if (path === '/geomagnetic') return RouteName.GEOMAGNETIC
    if (path === '/seismic') return RouteName.SEISMIC
    if (path === '/intel') return RouteName.INTEL
    return RouteName.MONITOR
  }

  private initRouter (): void {
    this.router = createRouter()

    this.router.onChange((route) => {
      this.switchView(route)
    })

    // Activate the initial view (always — including MONITOR)
    this.switchView(this.router.current())
  }

  private switchView (route: RouteName): void {
    this.navTabs.setActive(route)

    // Hide all view containers
    hide(this.monContainer)
    hide(this.geoContainer)
    hide(this.seisContainer)
    hide(this.intelContainer)

    // Hide monitor FAB on non-monitor views
    if (this.monView) {
      const fab = this.monView.getFab()
      if (route === RouteName.MONITOR) show(fab)
      else hide(fab)
    }

    switch (route) {
      case RouteName.MONITOR:
        show(this.monContainer)
        if (!this.monView) {
          this.monView = new MonitorView({})
          clearChildren(this.monContainer)
          this.monContainer.appendChild(this.monView.el)
          this.monView.load()
        }
        break

      case RouteName.GEOMAGNETIC:
        show(this.geoContainer)
        if (!this.geoView) {
          this.geoView = new GeomagneticView({})
          clearChildren(this.geoContainer)
          this.geoContainer.appendChild(this.geoView.el)
          this.geoView.load()
        }
        break

      case RouteName.SEISMIC:
        show(this.seisContainer)
        if (!this.seisView) {
          this.seisView = new SeismicView({})
          clearChildren(this.seisContainer)
          this.seisContainer.appendChild(this.seisView.el)
          this.seisView.load()
        }
        break

      case RouteName.INTEL:
        show(this.intelContainer)
        if (!this.intelView) {
          this.intelView = new IntelView({})
          clearChildren(this.intelContainer)
          this.intelContainer.appendChild(this.intelView.el)
          this.intelView.load()
        }
        break
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  destroy (): void {
    this.router?.destroy()
    this.monView?.destroy()
    this.geoView?.destroy()
    this.seisView?.destroy()
    this.intelView?.destroy()
    super.destroy()
  }
}

// ─── Entry point ──────────────────────────────────────────────────

export async function createApp (root: HTMLElement): Promise<void> {
  const app = new App({})
  mount(root, app.el)
  await app.init()
}
