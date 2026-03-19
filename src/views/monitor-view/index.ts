/* ------------------------------------------------------------------ *
 *  MonitorView — Main sighting dashboard                              *
 *                                                                     *
 *  Renders from the shared reactive store (populated by app.ts).      *
 *  Subscribes to store.sightings, store.loading, store.filter for     *
 *  view-specific rendering of grids, map, timeline, and news feed.    *
 *                                                                     *
 *  Owns: Hero, Highlights, controls, Timeline, SightingMap,           *
 *        SightingGrids, DataSources, Footer.                          *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, clearChildren, addClass, qs } from '@/utils/dom'
import { useAppStore, useFireball, useNuclear, useTheme, useShare, effect, filterSightings } from '@/composables'
import { AlertVariant, ButtonSize } from '@/enums'
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
import { Highlights } from '@/components/highlights'
import { Hero } from '@/components/hero'
import { Drawer } from '@/components/drawer'
import { cx as drawerCx } from '@/components/drawer/cx'
import { Button } from '@/components/button'
import { Loader } from '@/components/loader'
import { iconSearch } from '@/components/icons'
import { SECTION, ARIA } from '@/data/strings'
import { MAX_YEAR_SPAN } from '@/data/config'

// ─── Component ──────────────────────────────────────────────────────

export class MonitorView extends Component {
  private store = useAppStore()
  private fireball = useFireball()
  private nuclear = useNuclear()

  private grids!: SightingGrids
  private sightingMap!: SightingMap
  private timeline!: Timeline
  private desktopControls!: HTMLElement
  private filterDrawer!: Drawer
  private fab!: Button
  private renderVersion = 0
  private loaded = false

  protected create (): HTMLElement {
    this.grids = new SightingGrids({})

    this.sightingMap = new SightingMap({
      onSightingSelect: (id) => this.grids.scrollToSighting(id)
    })

    this.timeline = new Timeline({
      onRangeSelect: (from, to) => {
        this.store.yearRange.set({ from, to })
      }
    })

    return h('div', { className: cx.root },
      h('div', { className: cx.loader }, new Loader({}).el)
    )
  }

  // ─── Public API ─────────────────────────────────────────────────

  async load (): Promise<void> {
    if (this.loaded) return

    this.buildContent()
    this.renderFromStore()
    this.bindViewReactions()
    this.handleShareUrl()

    this.loaded = true
  }

  /** Allow external ticker click to scroll into the grid */
  scrollToSighting (id: string): void {
    this.grids.scrollToSighting(id)
  }

  /** Expose FAB for external show/hide by the app shell */
  getFab (): HTMLElement {
    return this.fab.el
  }

  // ─── Build content ─────────────────────────────────────────────

  private buildContent (): void {
    // ── Desktop: inline controls (hidden on SP via CSS) ──────────
    this.desktopControls = h('form', {
      className: `${cx.controlsForm} ${cx.controlsFormDesktop}`,
      autocomplete: 'off',
      onSubmit: (e: Event) => e.preventDefault()
    },
      new YearSelector({}).el,
      new FilterToolbar({}).el
    )

    // ── SP: drawer-wrapped controls (hidden on desktop via CSS) ──
    const drawerToolbar = new FilterToolbar({})
    const drawerForm = h('form', {
      className: cx.controlsForm,
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
    addClass(this.fab.el, cx.fab)

    clearChildren(this.el)

    // ── Hero (above fold) ────────────────────────────────────────
    const hero = new Hero({
      onExplore: () => this.sightingMap.el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    this.el.appendChild(hero.el)

    this.el.appendChild(new Highlights({}).el)
    this.el.appendChild(this.desktopControls)
    this.el.appendChild(this.filterDrawer.el)
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

    // FAB appended to view root (fixed position, floats above everything)
    this.el.appendChild(this.fab.el)
  }

  // ─── Initial render from store ─────────────────────────────────

  private renderFromStore (): void {
    const sightings = this.store.sightings.get()
    const years = this.store.availableYears.get()
    const { from, to } = this.store.yearRange.get()

    // Grids
    this.grids.render(sightings)

    // Map
    this.sightingMap.setSightings(sightings)

    const fireballs = this.fireball.getAll()
    this.sightingMap.setFireballs(fireballs.filter(f => f.lat != null))
    this.sightingMap.setNuclearFacilities(this.nuclear.getAll())

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
    // Re-render when sightings change (year range changed by app.ts)
    this.store.sightings.subscribe((sightings) => {
      if (!this.loaded) return
      const { from, to } = this.store.yearRange.get()

      this.grids.render(sightings, true)
      this.sightingMap.setSightings(sightings)
      this.timeline.setActiveRange(from, to)
    })

    // Show/hide loaders when loading state changes
    this.store.loading.subscribe((loading) => {
      if (!this.loaded) return
      if (loading) this.showAllLoaders()
      else this.hideAllLoaders()
    })

    // Filter — monitor-specific (grids, map, news feed)
    this.store.filter.subscribe(() => {
      if (!this.loaded) return
      this.onFilterChange()
    })

    // Swap map tiles + redraw canvas on theme change
    const { theme } = useTheme()
    effect(() => {
      const t = theme.get()
      this.sightingMap.setTheme(t)
      this.timeline.redraw()
    })
  }

  // ─── Loaders ───────────────────────────────────────────────────

  private showAllLoaders (): void {
    const loader = () => h('div', { className: cx.loader }, new Loader({}).el)
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
