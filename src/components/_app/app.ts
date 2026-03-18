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
import { Component, createRouter, RouteName } from '@/core'
import type { Router } from '@/core'
import { h, mount, clearChildren, addClass, qs, hide, show } from '@/utils/dom'
import { useDataSource, useTicker, useAppStore, useAnalytics, useFireball, useNuclear, useRussianHistorical, useTheme, useShare, useGeomagnetic, useSeismic, batch, effect, minDelay, filterSightings } from '@/composables'
import { AlertVariant, ButtonSize } from '@/enums'
import { Header } from '@/components/header'
import { NavTabs } from '@/components/nav-tabs'
import { Ticker } from '@/components/ticker'
import { Loader } from '@/components/loader'
import { Section } from '@/components/layout'
import { DataSources } from '@/components/data-sources'
import { Alert } from '@/components/alert'
import { Footer } from '@/components/footer'
import { YearSelector } from '@/components/year-selector'
import { FilterToolbar } from '@/components/filter-toolbar'
import { SightingGrids } from '@/components/sighting-grid'
import { SightingModal } from '@/components/sighting-modal'
import { SightingMap } from '@/components/sighting-map'
import { Timeline } from '@/components/timeline'
import { NewsFeed } from '@/components/news-feed'
import { Highlights } from '@/components/highlights'
import { Hero } from '@/components/hero'
import { Drawer } from '@/components/drawer'
import { cx as drawerCx } from '@/components/drawer/cx'
import { Button } from '@/components/button'
import { iconSearch } from '@/components/icons'
import { GeomagneticView } from '@/components/geomagnetic-view'
import { SeismicView } from '@/components/seismic-view'
import { SECTION, ARIA } from '@/data/strings'
import { DEFAULT_YEAR_OFFSET, MAX_YEAR_SPAN } from '@/data/config'

import type { Sighting } from '@/types'

export class App extends Component {
  private store = useAppStore()
  private dataSource = useDataSource()
  private tickerMessages = useTicker()
  private fireball = useFireball()
  private nuclear = useNuclear()
  private russianHistorical = useRussianHistorical()
  private geomagnetic = useGeomagnetic()
  private seismic = useSeismic()

  private main!: HTMLElement
  private ticker!: Ticker
  private grids!: SightingGrids
  private newsFeed!: NewsFeed
  private sightingMap!: SightingMap
  private timeline!: Timeline
  private desktopControls!: HTMLElement
  private filterDrawer!: Drawer
  private fab!: Button
  private renderVersion = 0
  private yearRangeReady = false

  // ── Router + views ──────────────────────────────────────────────
  private router!: Router
  private navTabs!: NavTabs
  private geoView: GeomagneticView | null = null
  private seisView: SeismicView | null = null
  private geoContainer!: HTMLElement
  private seisContainer!: HTMLElement

  // ─── Shell ─────────────────────────────────────────────────────

  protected create (): HTMLElement {
    // Detect initial route early to avoid monitor flash on direct URL
    const initialHash = window.location.hash.replace(/^#/, '')
    const isDirectGeo = initialHash === '/geomagnetic'
    const isDirectSeis = initialHash === '/seismic'
    const initialRoute = isDirectGeo
      ? RouteName.GEOMAGNETIC
      : isDirectSeis
        ? RouteName.SEISMIC
        : RouteName.MONITOR

    this.main = h('main', { className: 'app-main', role: 'main' },
      h('div', { className: 'app-loader' }, new Loader({}).el)
    )

    // Hide main if landing on a non-monitor route
    if (initialRoute !== RouteName.MONITOR) {
      hide(this.main)
    }

    this.ticker = new Ticker({
      onClick: (id) => this.grids.scrollToSighting(id)
    })

    this.grids = new SightingGrids({})
    this.newsFeed = new NewsFeed({})

    this.sightingMap = new SightingMap({
      onSightingSelect: (id) => this.grids.scrollToSighting(id)
    })

    this.timeline = new Timeline({
      onRangeSelect: (from, to) => {
        this.store.yearRange.set({ from, to })
      }
    })

    // ── View containers for geomagnetic / seismic ────────────────
    // Include a loader so direct URL access shows spinner immediately
    this.geoContainer = h('div', { className: 'app-view-container' },
      h('div', { className: 'app-loader' }, new Loader({}).el)
    )
    if (initialRoute !== RouteName.GEOMAGNETIC) hide(this.geoContainer)

    this.seisContainer = h('div', { className: 'app-view-container' },
      h('div', { className: 'app-loader' }, new Loader({}).el)
    )
    if (initialRoute !== RouteName.SEISMIC) hide(this.seisContainer)

    // ── Nav tabs ─────────────────────────────────────────────────
    this.navTabs = new NavTabs({
      active: initialRoute,
      onNavigate: (route) => this.router?.navigate(route)
    })

    return h('div', { className: 'app' },
      h('div', { className: 'scanlines' }),
      new Header({}).el,
      this.navTabs.el,
      this.ticker.el,
      this.main,
      this.geoContainer,
      this.seisContainer
    )
  }

  // ─── Initialization ────────────────────────────────────────────

  async init (): Promise<void> {
    const analytics = useAnalytics()
    analytics.init()
    analytics.pageView()

    // ── All are independent network fetches — parallelize ──
    await Promise.all([
      this.loadManifests(),
      this.newsFeed.load(),
      this.fireball.load(),
      this.nuclear.load(),
      this.russianHistorical.load(),
      this.geomagnetic.load(),
      this.seismic.load()
    ])

    // ── Sequential: each step depends on the one before ──
    this.hydrateStore()
    this.buildControls()
    this.bindReactions()

    await this.progressiveLoad()
    this.buildBelowFold()
    this.finalize()

    // ── Router: enable view switching after main view is ready ──
    this.initRouter()
  }

  // ─── Phase: Load manifests ─────────────────────────────────────

  private async loadManifests (): Promise<void> {
    await this.dataSource.loadManifests()
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
      this.store.yearRange.set({ from: defaultFrom, to: newest })
    })
  }

  // ─── Phase: Build controls ─────────────────────────────────────

  private buildControls (): void {
    // ── Desktop: inline controls under hero (hidden on SP via CSS) ─
    this.desktopControls = h('form', {
      className: 'controls-form controls-form--desktop',
      autocomplete: 'off',
      onSubmit: (e: Event) => e.preventDefault()
    },
      new YearSelector({}).el,
      new FilterToolbar({}).el
    )

    // ── SP: drawer-wrapped controls (hidden on desktop via CSS) ──
    const drawerToolbar = new FilterToolbar({})
    const drawerForm = h('form', {
      className: 'controls-form',
      autocomplete: 'off',
      onSubmit: (e: Event) => e.preventDefault()
    },
      new YearSelector({}).el,
      drawerToolbar.el
    )

    this.filterDrawer = new Drawer({
      content: drawerForm,
      onOpen: () => {
        const panel = qs(`.${drawerCx.panel}`, this.filterDrawer.el)
        if (panel) {
          panel.addEventListener('transitionend', () => {
            drawerToolbar.focusSearch()
          }, { once: true })
        }
      },
      onClose: () => this.fab.el.focus()
    })

    // ── FAB (mobile only) — opens drawer ────────────────────────
    this.fab = new Button({
      label: ARIA.FILTER_TOGGLE,
      variant: 'filled',
      color: 'primary',
      size: ButtonSize.XL,
      round: true,
      icon: () => iconSearch(22),
      onClick: () => this.filterDrawer.toggle()
    })
    addClass(this.fab.el, 'fab')

    this.showAllLoaders()

    clearChildren(this.main)

    // ── Hero (above fold — first thing users see) ────────────────
    const hero = new Hero({
      onExplore: () => this.sightingMap.el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    this.main.appendChild(hero.el)

    this.main.appendChild(new Highlights({}).el)
    this.main.appendChild(this.desktopControls)
    this.main.appendChild(this.filterDrawer.el)
    this.main.appendChild(this.timeline.el)
    this.main.appendChild(this.sightingMap.el)

    // ── Intelligence feed (merged GDELT + GNews) ─────────────────
    const feedCount = this.newsFeed.getCount()
    this.main.appendChild(
      new Section({
        title: SECTION.INTEL_FEED,
        tooltip: SECTION.INTEL_FEED_TOOLTIP,
        count: feedCount || undefined,
        content: this.newsFeed.el
      }).el
    )

    this.main.appendChild(this.grids.el)

    // FAB appended to app root (fixed position, floats above everything)
    this.el.appendChild(this.fab.el)
  }

  // ─── Phase: Bind reactions ─────────────────────────────────────

  private bindReactions (): void {
    this.store.filter.subscribe(() => this.onFilterChange())

    this.store.yearRange.subscribe(async () => {
      if (!this.yearRangeReady) return
      if (this.store.loading.get()) return
      await this.onYearRangeChange()
    })

    // Swap map tiles + redraw canvas on theme change
    const { theme } = useTheme()
    effect(() => {
      const t = theme.get()
      this.sightingMap.setTheme(t)
      this.timeline.redraw()
    })
  }

  // ─── Phase: Progressive load ───────────────────────────────────

  private async progressiveLoad (): Promise<Sighting[]> {
    const { from, to } = this.store.yearRange.get()

    return this.dataSource.fetchProgressive(from, to, (partial) => {
      this.store.sightings.set(partial)
      this.store.shownCount.set(partial.length)
      this.grids.render(partial)
    })
  }

  // ─── Phase: Below-fold content ─────────────────────────────────

  private buildBelowFold (): void {
    // ── Data sources section ────────────────────────────────────
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

  private finalize (): void {
    // Merge Russian Historical sightings into main dataset
    const russianSightings = this.russianHistorical.getAll()
    if (russianSightings.length > 0) {
      const current = this.store.sightings.get()
      const ids = new Set(current.map(s => s.id))
      const newOnes = russianSightings.filter(s => !ids.has(s.id))
      if (newOnes.length > 0) {
        this.store.sightings.set([...current, ...newOnes])
      }
    }

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

    const fireballs = this.fireball.getAll()
    this.store.fireballs.set(fireballs)
    this.sightingMap.setFireballs(fireballs.filter(f => f.lat != null))

    this.sightingMap.setNuclearFacilities(this.nuclear.getAll())

    this.timeline.setManifestCounts(
      this.dataSource.getYearCounts(),
      years[years.length - 1] ?? 1900,
      years[0] ?? new Date().getFullYear()
    )
    this.timeline.setActiveRange(from, to)
    this.hideAllLoaders()

    this.yearRangeReady = true

    // ── Handle share URL: ?s=<sightingId> ───────────────────────
    this.handleShareUrl()
  }

  private handleShareUrl (): void {
    const share = useShare()
    const parsed = share.parseShareParam()
    if (!parsed) return

    const { id, year } = parsed
    share.clearShareParam()

    // Try current sightings first
    const match = this.store.sightings.get().find(s => s.id === id)
    if (match) {
      requestAnimationFrame(() => SightingModal.open(match, document.body))
      return
    }

    // Sighting not in current range — load the right year window
    if (!year) return

    const years = this.store.availableYears.get()
    const oldest = years[years.length - 1] ?? 1900
    const newest = years[0] ?? new Date().getFullYear()
    const from = Math.max(oldest, year)
    const to = Math.min(newest, from + MAX_YEAR_SPAN)

    this.store.yearRange.set({ from, to })

    // Wait for loading to complete, then open
    const unsub = this.store.loading.subscribe((loading) => {
      if (loading) return
      unsub()
      const sighting = this.store.sightings.get().find(s => s.id === id)
      if (sighting) {
        requestAnimationFrame(() => SightingModal.open(sighting, document.body))
      }
    })
  }

  // ─── Reactions ─────────────────────────────────────────────────

  private showAllLoaders (): void {
    const loader = () => h('div', { className: 'app-loader' }, new Loader({}).el)
    this.grids.showLoader(loader())
    this.timeline.showLoader(loader())
    this.sightingMap.showLoader(loader())
  }

  private hideAllLoaders (): void {
    this.timeline.hideLoader()
    this.sightingMap.hideLoader()
  }

  private async onFilterChange (): Promise<void> {
    const version = ++this.renderVersion
    const release = this.grids.lockHeight()

    const filtered = await filterSightings(
      this.store.sightings.get(), this.store.filter.get()
    )

    if (version !== this.renderVersion) {
      release()
      return
    }

    const releaseRender = this.grids.lockHeight()
    await this.grids.render(filtered, true)
    releaseRender()
    release()

    this.sightingMap.setSightings(filtered, this.store.hasActiveFilter.get())

    const filter = this.store.filter.get()
    this.newsFeed.applyFilter(filter)

    this.store.shownCount.set(filtered.length)
  }

  private async onYearRangeChange (): Promise<void> {
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

  // ─── Router ─────────────────────────────────────────────────────

  private initRouter (): void {
    this.router = createRouter()

    this.router.onChange((route) => {
      this.switchView(route)
    })

    // Handle initial route (e.g. user lands on #/geomagnetic directly)
    const initial = this.router.current()
    if (initial !== RouteName.MONITOR) {
      this.switchView(initial)
    }
  }

  private switchView (route: RouteName): void {
    this.navTabs.setActive(route)

    // Hide all view containers
    hide(this.main)
    hide(this.geoContainer)
    hide(this.seisContainer)

    // Hide FAB on non-monitor views
    if (this.fab) {
      if (route === RouteName.MONITOR) show(this.fab.el)
      else hide(this.fab.el)
    }

    switch (route) {
      case RouteName.MONITOR:
        show(this.main)
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
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  destroy (): void {
    this.router?.destroy()
    this.geoView?.destroy()
    this.seisView?.destroy()
    super.destroy()
  }
}

// ─── Entry point ──────────────────────────────────────────────────

export async function createApp (root: HTMLElement): Promise<void> {
  const app = new App({})
  mount(root, app.el)
  await app.init()
}
