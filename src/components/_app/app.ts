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
import { useDataSource, useTicker, useAppStore, useAnalytics, useFireball, useRussianHistorical, useTheme, useShare, batch, effect, minDelay, filterSightings } from '@/composables'
import { AlertVariant, ButtonSize } from '@/enums'
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
import { SightingModal } from '@/components/sighting-modal'
import { SightingMap } from '@/components/sighting-map'
import { Timeline } from '@/components/timeline'
import { NewsFeed } from '@/components/news-feed'
import { Highlights } from '@/components/highlights'
import { Hero } from '@/components/hero'
import { Drawer } from '@/components/drawer'
import { Button } from '@/components/button'
import { iconSearch } from '@/components/icons'
import { SECTION, ARIA } from '@/data/strings'
import { DEFAULT_YEAR_OFFSET } from '@/data/config'

import type { Sighting } from '@/types'

export class App extends Component {
  private store = useAppStore()
  private dataSource = useDataSource()
  private tickerMessages = useTicker()
  private fireball = useFireball()
  private russianHistorical = useRussianHistorical()

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

  // ─── Shell ─────────────────────────────────────────────────────

  protected create(): HTMLElement {
    this.main = h('main', { className: 'app-main', role: 'main' },
      h('div', { className: 'app-loader' }, new Loader({}).el)
    )

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

    // ── All are independent network fetches — parallelize ──
    await Promise.all([
      this.loadManifests(),
      this.newsFeed.load(),
      this.fireball.load(),
      this.russianHistorical.load()
    ])

    // ── Sequential: each step depends on the one before ──
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
    const defaultFrom = newest - DEFAULT_YEAR_OFFSET

    batch(() => {
      this.store.availableYears.set(years)
      this.store.totalCount.set(this.dataSource.getTotalCount())
      this.store.sources.set(this.dataSource.getSources())
      this.store.yearRange.set({ from: defaultFrom, to: newest })
    })
  }

  // ─── Phase: Build controls ─────────────────────────────────────

  private buildControls(): void {
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
        const panel = this.filterDrawer.el.querySelector('.drawer__panel')
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
    this.fab.el.classList.add('fab')

    this.showAllLoaders()

    clearChildren(this.main)

    // ── Hero (above fold — first thing users see) ────────────────
    const hero = new Hero({
      onExplore: () => this.sightingMap.el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    this.main.appendChild(hero.el)

    this.main.appendChild(this.desktopControls)
    this.main.appendChild(this.filterDrawer.el)
    this.main.appendChild(this.timeline.el)
    this.main.appendChild(new Highlights({}).el)
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

  private bindReactions(): void {
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

  private finalize(): void {
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

  private handleShareUrl(): void {
    const share = useShare()
    const sharedId = share.parseShareParam()
    if (!sharedId) return

    const sighting = this.store.sightings.get().find(s => s.id === sharedId)
    if (sighting) {
      share.clearShareParam()
      // Delay to let render settle
      requestAnimationFrame(() => {
        SightingModal.open(sighting, document.body)
      })
    }
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
