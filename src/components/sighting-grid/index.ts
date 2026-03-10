import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  SightingGrids — continent-grouped grids with inline search         *
 *                                                                     *
 *  Each continent section has its own search input + data grid.       *
 *  Search uses token-based AND matching across all text fields.       *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, clearChildren } from '@/utils/dom'
import { Section } from '@/components/layout'
import { DataGrid } from '@/components/data-grid'
import { SightingModal } from '@/components/sighting-modal'
import { TextInput } from '@/components/text-input'
import { CONTINENT_TOOLTIPS, CONTINENT_EMPTY, FILTER, SECTION, ARIA } from '@/data/strings'
import { ComponentSize } from '@/enums'
import { useAppStore, useDebounce, yieldThread } from '@/composables'
import { tokenMatch } from '@/utils/search'
import { sightingColumns } from './columns'
import type { Sighting, DataGridColumn } from '@/types'
import { groupByContinent } from '@/data/sightings'
import type { Continent } from '@/enums'

// ─── Per-continent section state ────────────────────────────────────

interface ContinentSection {
  allItems: Sighting[]
  grid: DataGrid<Sighting>
  gridContainer: HTMLElement
  query: string
  applySearch: () => void
}

// ─── Shared sighting search fields ──────────────────────────────────

function matchSighting (query: string, s: Sighting): boolean {
  return tokenMatch(
    query,
    s.summary, s.description, s.location, s.region,
    s.country, s.shape, s.source, s.subSource,
    s.occurredAt?.slice(0, 10),
    ...(s.tags || [])
  )
}

// ─── Component ──────────────────────────────────────────────────────

export class SightingGrids extends Component {
  private columns!: DataGridColumn<Sighting>[]
  private renderVersion = 0
  private activeGrids!: DataGrid<Sighting>[]
  private sections = new Map<Continent, ContinentSection>()

  protected create (): HTMLElement {
    this.columns = sightingColumns()
    this.activeGrids = []
    return h('div', { className: 'grids-container' })
  }

  // ─── Public API ─────────────────────────────────────────────────

  async render (sightings: Sighting[], isRerender = false): Promise<void> {
    const store = useAppStore()
    const selected = store.selectedContinent.get()
    const version = ++this.renderVersion

    clearChildren(this.el)
    this.activeGrids = []
    this.sections.clear()

    if (sightings.length === 0) {
      this.el.appendChild(
        h('div', { className: cx.emptyState },
          h('span', { className: cx.emptyStateText }, FILTER.NO_RESULTS)
        )
      )
      return
    }

    const groups = groupByContinent(sightings)
    const frag = document.createDocumentFragment()

    frag.appendChild(h('h2', { className: cx.heading }, SECTION.SIGHTING_REPORTS))

    for (const group of groups) {
      if (version !== this.renderVersion) return

      if (group.count > 0) {
        const section = this.createContinentSection(group.continent, group.items)

        frag.appendChild(
          new Section({
            title: group.label,
            count: group.count,
            tooltip: CONTINENT_TOOLTIPS[group.continent],
            content: section.wrapper
          }).el
        )
      } else if (!selected) {
        frag.appendChild(
          new Section({
            title: group.label,
            count: group.count,
            tooltip: CONTINENT_TOOLTIPS[group.continent],
            content: h('div', { className: `${cx.emptyState} ${cx.emptyStateCompact}` },
              h('span', { className: cx.emptyStateText },
                CONTINENT_EMPTY[group.continent] ?? FILTER.EMPTY_DEFAULT
              )
            )
          }).el
        )
      }

      if (isRerender) await yieldThread()
    }

    this.el.appendChild(frag)
  }

  // ─── Per-continent section builder ──────────────────────────────

  private createContinentSection (continent: Continent, items: Sighting[]): { wrapper: HTMLElement } {
    const gridContainer = h('div', {})
    const grid = new DataGrid<Sighting>({
      columns: this.columns,
      data: items,
      onRowClick: (s, trigger) => SightingModal.open(s, trigger)
    })
    this.activeGrids.push(grid)
    gridContainer.appendChild(grid.el)

    const sectionState: ContinentSection = {
      allItems: items,
      grid,
      gridContainer,
      query: '',
      applySearch: () => {}
    }

    const applySearch = (): void => {
      clearChildren(sectionState.gridContainer)
      const q = sectionState.query

      if (!q) {
        const newGrid = new DataGrid<Sighting>({
          columns: this.columns,
          data: sectionState.allItems,
          onRowClick: (s, trigger) => SightingModal.open(s, trigger)
        })
        sectionState.grid = newGrid
        this.rebuildActiveGrids()
        sectionState.gridContainer.appendChild(newGrid.el)
        return
      }

      const filtered = sectionState.allItems.filter(s => matchSighting(q, s))

      if (filtered.length === 0) {
        sectionState.gridContainer.appendChild(
          h('div', { className: `${cx.emptyState} ${cx.emptyStateCompact}` },
            h('span', { className: cx.emptyStateText }, FILTER.NO_RESULTS)
          )
        )
        return
      }

      const newGrid = new DataGrid<Sighting>({
        columns: this.columns,
        data: filtered,
        onRowClick: (s, trigger) => SightingModal.open(s, trigger)
      })
      sectionState.grid = newGrid
      this.rebuildActiveGrids()
      sectionState.gridContainer.appendChild(newGrid.el)
    }

    sectionState.applySearch = applySearch

    const debouncedSearch = useDebounce(() => applySearch(), 200)

    const searchInput = new TextInput({
      id: `sighting-search-${continent.toLowerCase()}`,
      name: `sighting-search-${continent.toLowerCase()}`,
      placeholder: FILTER.SEARCH_PLACEHOLDER,
      ariaLabel: ARIA.SEARCH_SIGHTINGS,
      size: ComponentSize.MD,
      clearable: true,
      onInput: (val) => {
        sectionState.query = val
        if (!val) {
          debouncedSearch.flush()
          applySearch()
        } else {
          debouncedSearch()
        }
      },
      onClear: () => {
        sectionState.query = ''
        debouncedSearch.flush()
        applySearch()
      }
    })

    this.sections.set(continent, sectionState)

    const wrapper = h('div', { className: cx.sectionWrapper },
      h('div', { className: cx.searchBar }, searchInput.el),
      gridContainer
    )

    return { wrapper }
  }

  private rebuildActiveGrids (): void {
    this.activeGrids = [...this.sections.values()].map(s => s.grid)
  }

  // ─── Scroll + utilities ─────────────────────────────────────────

  scrollToSighting (sightingId: string): boolean {
    for (const grid of this.activeGrids) {
      if (grid.scrollToItem(s => s.id === sightingId)) return true
    }
    return false
  }

  showLoader (loader: HTMLElement): void {
    clearChildren(this.el)
    this.el.appendChild(loader)
  }

  lockHeight (): () => void {
    const prev = this.el.offsetHeight
    if (prev > 0) this.el.style.minHeight = `${prev}px`
    return () => {
      requestAnimationFrame(() => { this.el.style.minHeight = '' })
    }
  }
}
