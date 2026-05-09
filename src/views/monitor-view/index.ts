/* ------------------------------------------------------------------ *
 *  MonitorView — Main sighting dashboard                              *
 *                                                                     *
 *  Renders from the shared reactive store (populated by app.ts).      *
 *  Subscribes to store.sightings, store.loading, store.filter for     *
 *  view-specific rendering of grids, map, timeline, and news feed.    *
 *                                                                     *
 *  Owns: Hero, Highlights, FeaturedHypothesis, FilterDeck (sticky),   *
 *        AdvancedFilters (collapsible), Timeline, SightingMap,        *
 *        SightingGrids, DataSources, Footer.                          *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { cx as appCx } from '../app/cx'
import { Component } from '@/core'
import { h, clearChildren } from '@/core/dom'
import { useAppStore, useFireball, useNuclear, useTheme, useShare, effect, filterSightings } from '@/composables'
import { AlertVariant } from '@/enums'
import { Section } from '@/components/layout'
import { DataSources } from '@/components/data-sources'
import { Alert } from '@/components/alert'
import { Footer } from '@/components/footer'
import { SightingGrids } from '@/components/sighting-grid'
import { SightingModal } from '@/components/sighting-modal'
import { SightingMap } from '@/components/sighting-map'
import { Timeline } from '@/components/timeline'
import { Highlights } from '@/components/highlights'
import { Hero } from '@/components/hero'
import { FeaturedHypothesis } from '@/components/featured-hypothesis'
import { FilterDeck } from '@/components/filter-deck'
import { AdvancedFilters } from '@/components/advanced-filters'
import { Loader } from '@/components/loader'
import { SECTION } from '@/data/strings'
import { MAX_YEAR_SPAN } from '@/data/config'

// ─── Component ──────────────────────────────────────────────────────

export class MonitorView extends Component {
  private store = useAppStore()
  private fireball = useFireball()
  private nuclear = useNuclear()

  private grids!: SightingGrids
  private sightingMap!: SightingMap
  private timeline!: Timeline
  private filterDeck!: FilterDeck
  private advancedFilters!: AdvancedFilters
  private renderVersion = 0
  private loaded = false

  protected create (): HTMLElement {
    this.grids = this.ownChild(new SightingGrids({}))

    this.sightingMap = this.ownChild(new SightingMap({
      onSightingSelect: (id) => this.grids.scrollToSighting(id)
    }))

    this.timeline = this.ownChild(new Timeline({
      onRangeSelect: (from, to) => {
        this.store.yearRange.set({ from, to })
      }
    }))

    return h('div', { className: [cx.root, appCx.appView].join(' ') },
      h('div', { className: appCx.viewLoader }, new Loader({}).el)
    )
  }

  // ─── Public API ─────────────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return

    this.buildContent()

    // Mark loaded BEFORE binding/applying so the filter.subscribe
    // callback (and the apply-once at the end of bindViewReactions)
    // don't early-return on the geo-seeded continent.
    this.loaded = true

    this.renderFromStore()
    this.bindViewReactions()
    this.handleShareUrl()

    // Data not ready yet — show loaders until pipeline completes
    if (!this.store.dataReady.get()) {
      this.showAllLoaders()
    }
  }

  /** Allow external ticker click to scroll into the grid */
  scrollToSighting (id: string): void {
    this.grids.scrollToSighting(id)
  }

  // ─── Build content ─────────────────────────────────────────────

  private buildContent (): void {
    // ── Filter deck (sticky) + advanced filter disclosure ────────
    this.advancedFilters = this.ownChild(new AdvancedFilters({}))

    this.filterDeck = this.ownChild(new FilterDeck({
      onSearchOpen: () => {
        const open = this.advancedFilters.toggle()
        if (open) {
          this.advancedFilters.focusSearch()
        }
        this.filterDeck.setFiltersOpen(open)
      }
    }))

    clearChildren(this.el)

    // ── Hero (above fold) ────────────────────────────────────────
    const hero = new Hero({
      onExplore: () => this.sightingMap.el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    this.el.appendChild(hero.el)

    this.el.appendChild(new Highlights({}).el)
    this.el.appendChild(this.ownChild(new FeaturedHypothesis({})).el)

    // ── Filter deck (sticky on scroll) + collapsible advanced ────
    this.el.appendChild(this.filterDeck.el)
    this.el.appendChild(this.advancedFilters.el)

    // ── Timeline + map + grids ───────────────────────────────────
    this.el.appendChild(this.timeline.el)
    this.el.appendChild(this.sightingMap.el)
    this.el.appendChild(this.grids.el)

    // ── Below-fold: data sources + footer ────────────────────────
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

    this.el.appendChild(
      new Section({
        title: SECTION.DATA_SOURCES,
        tooltip: SECTION.DATA_SOURCES_TOOLTIP,
        content: sourcesBody
      }).el
    )

    this.el.appendChild(new Footer({}).el)
  }

  // ─── Initial render from store ─────────────────────────────────

  private async renderFromStore (): Promise<void> {
    const sightings = this.store.sightings.get()
    const years = this.store.availableYears.get()
    const { from, to } = this.store.yearRange.get()

    // Grids (async — yields between continent sections)
    this.grids.render(sightings)

    // Yield before map work
    await new Promise<void>(r => setTimeout(r, 0))

    // Map (async — yields every 3000 markers)
    this.sightingMap.setSightings(sightings)

    const fireballs = this.fireball.getAll()
    this.sightingMap.setFireballs(fireballs.filter(f => f.lat != null))
    this.sightingMap.setNuclearFacilities(this.nuclear.getAll())

    // Yield before timeline
    await new Promise<void>(r => setTimeout(r, 0))

    // Timeline
    this.timeline.setManifestCounts(
      this.store.yearCounts.get(),
      years[years.length - 1] ?? 1900,
      years[0] ?? new Date().getFullYear()
    )
    this.timeline.setActiveRange(from, to)
  }

  // ─── View-specific reactions ───────────────────────────────────

  private bindViewReactions (): void {
    // Full re-render once data pipeline completes (covers empty initial render)
    this.own(this.store.dataReady.subscribe((ready) => {
      if (!ready || !this.loaded) return
      this.hideAllLoaders()
      // If a filter is active (e.g. geo-seeded continent), apply it
      // through onFilterChange — otherwise render the unfiltered set.
      if (this.store.hasActiveFilter.get()) {
        this.onFilterChange()
      } else {
        this.renderFromStore()
      }
    }))

    // Re-render when sightings change (year range changed by app.ts)
    this.own(this.store.sightings.subscribe((sightings) => {
      if (!this.loaded || !this.store.dataReady.get()) return
      const { from, to } = this.store.yearRange.get()

      // Year range changes drop in a fresh sighting set — re-apply
      // the active filter to it instead of rendering raw.
      if (this.store.hasActiveFilter.get()) {
        this.onFilterChange()
      } else {
        this.grids.render(sightings, true)
        this.sightingMap.setSightings(sightings)
      }
      this.timeline.setActiveRange(from, to)
    }))

    // Show/hide loaders when loading state changes
    this.own(this.store.loading.subscribe((loading) => {
      if (!this.loaded) return
      if (loading) this.showAllLoaders()
      else this.hideAllLoaders()
    }))

    // Filter — monitor-specific (grids, map, news feed)
    this.own(this.store.filter.subscribe(() => {
      if (!this.loaded) return
      this.onFilterChange()
    }))

    // Swap map tiles + redraw canvas on theme change
    const { theme } = useTheme()
    this.own(effect(() => {
      const t = theme.get()
      this.sightingMap.setTheme(t)
      this.timeline.redraw()
    }))

    // If the filter store already has state from FilterDeck's
    // geo-seeded continent (or a future URL-shared filter), the
    // `filter.subscribe` above only catches *changes* — so we apply
    // the existing state once now to filter the first paint.
    if (this.store.hasActiveFilter.get()) {
      this.onFilterChange()
    }
  }

  // ─── Loaders ───────────────────────────────────────────────────

  private showAllLoaders (): void {
    const loader = () => h('div', { className: appCx.viewLoader }, new Loader({}).el)
    this.grids.showLoader(loader())
    this.timeline.showLoader(loader())
    this.sightingMap.showLoader(loader())
  }

  private hideAllLoaders (): void {
    this.timeline.hideLoader()
    this.sightingMap.hideLoader()
  }

  // ─── Filter reaction ──────────────────────────────────────────

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

    this.store.shownCount.set(filtered.length)
  }

  // ─── Share URL handling ────────────────────────────────────────

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
}
