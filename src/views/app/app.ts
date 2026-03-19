/* ------------------------------------------------------------------ *
 *  App — top-level orchestrator + shared data pipeline                *
 *                                                                     *
 *  Responsibilities:                                                  *
 *    1. Bootstrap: load manifests, hydrate store, fetch sightings     *
 *    2. Shared data layer: year-range refetches, Russian merge,       *
 *       fireball/nuclear store population — data consumed by ALL      *
 *       views via the reactive store                                  *
 *    3. Render app chrome: header, nav tabs, ticker                   *
 *    4. Route-based view switching via useRouter composable           *
 *                                                                     *
 *  View-specific rendering lives in dedicated view components:        *
 *    MonitorView     — sighting dashboard (hero, map, grids, etc.)    *
 *    GeomagneticView — Kp index vs sighting density                   *
 *    SeismicView     — earthquake proximity vs sightings              *
 *    IntelView       — full-page intelligence news feed               *
 * ------------------------------------------------------------------ */

import './app.css'
import { Component, RouteName, createRouter } from '@/core'
import type { Sighting } from '@/types'
import { h, mount, show, hide } from '@/core/dom'
import { useDataSource, useTicker, useAppStore, useAnalytics, useFireball, useNuclear, useRussianHistorical, useGeomagnetic, useSeismic, useGdelt, useGnews, useTwitter, useReddit, batch, minDelay } from '@/composables'
import type { RouterInstance, RouteNames } from '@/core'
import { Header } from '@/components/header'
import { NavTabs } from '@/components/nav-tabs'
import { Ticker } from '@/components/ticker'
import { MonitorView } from '@/views/monitor-view'
import { GeomagneticView } from '@/views/geomagnetic-view'
import { SeismicView } from '@/views/seismic-view'
import { IntelView } from '@/views/intel-view'
import { DEFAULT_YEAR_OFFSET } from '@/data/config'

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

  // ── Router ──────────────────────────────────────────────────────
  private router!: RouterInstance<RouteNames>
  private navTabs!: NavTabs
  private viewContainer!: HTMLElement

  // ── Monitor view reference (needed for ticker + FAB) ────────────
  private monView: MonitorView | null = null

  // ─── Shell ─────────────────────────────────────────────────────

  protected create (): HTMLElement {
    this.viewContainer = h('div', { className: 'app-view-container' })

    this.ticker = new Ticker({
      onClick: (id) => this.monView?.scrollToSighting(id)
    })

    this.navTabs = new NavTabs({
      active: RouteName.MONITOR,
      onNavigate: (route) => this.router?.navigate(route)
    })

    return h('div', { className: 'app' },
      h('div', { className: 'scanlines' }),
      new Header({}).el,
      this.navTabs.el,
      this.ticker.el,
      this.viewContainer
    )
  }

  // ─── Initialization ────────────────────────────────────────────

  async init (): Promise<void> {
    const analytics = useAnalytics()
    analytics.init()
    analytics.pageView()

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

  private initRouter (): void {
    this.router = createRouter<RouteNames>({
      base: 'https://uapmonitor.org',
      container: this.viewContainer,
      fallback: RouteName.MONITOR,

      routes: {
        [RouteName.MONITOR]: {
          path: '/',
          title: 'UAP Monitor — Global UFO & UAP Sightings Database, Map & Intelligence Platform',
          description: 'UAP Monitor aggregates 198,000+ UFO and UAP sighting reports from 15 verified sources spanning 70 AD to present. Interactive map, credibility scoring, and NASA fireball correlation.',
          factory: () => {
            const view = new MonitorView({})
            this.monView = view
            return view
          },
          onLeave: () => { this.monView = null }
        },

        [RouteName.GEOMAGNETIC]: {
          path: '/geomagnetic',
          title: 'UAP Geomagnetic Correlation — Kp Index & UFO Sighting Analysis | UAP Monitor',
          description: 'Explore the correlation between geomagnetic storm activity (Kp index) and UAP/UFO sightings. Timeline, distribution, and overrepresentation analysis from NOAA data.',
          factory: () => new GeomagneticView({})
        },

        [RouteName.SEISMIC]: {
          path: '/seismic',
          title: 'UAP Seismic Correlation — Earthquake & UFO Sighting Analysis | UAP Monitor',
          description: 'Analyze proximity between earthquakes and UAP/UFO sightings. Scatter plots, magnitude analysis, and potential earthquake lights detection from USGS data.',
          factory: () => new SeismicView({})
        },

        [RouteName.INTEL]: {
          path: '/intel',
          title: 'UAP Intelligence Feed — Real-Time UFO News from GDELT, GNews, X & Reddit | UAP Monitor',
          description: 'Real-time UAP/UFO intelligence feed combining GDELT global media monitoring, GNews, X/Twitter posts, and Reddit community reports. Filter by source, search, and sentiment analysis.',
          viewportLock: true,
          factory: () => new IntelView({})
        }
      },

      onBeforeSwitch: (_from, to) => {
        this.navTabs.setActive(to)
      },

      onAfterSwitch: (route) => {
        // Show/hide monitor FAB
        if (this.monView) {
          const fab = this.monView.getFab()
          if (route === RouteName.MONITOR) show(fab)
          else hide(fab)
        }
      }
    })

    // Activate initial route
    this.router.navigate(this.router.current())
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  destroy (): void {
    this.router?.destroy()
    super.destroy()
  }
}

// ─── Entry point ──────────────────────────────────────────────────

export async function createApp (root: HTMLElement): Promise<void> {
  const app = new App({})
  mount(root, app.el)
  await app.init()
}
