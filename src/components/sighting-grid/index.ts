import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  SightingGrids — continent-grouped grids with infinite scroll       *
 *                                                                     *
 *  Renders sightings grouped by continent into collapsible sections.  *
 *  Supports progressive rendering with version-based cancellation.    *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, clearChildren } from '@/utils/dom'
import { Section } from '@/components/layout'
import { DataGrid } from '@/components/data-grid'
import { SightingModal } from '@/components/sighting-modal'
import { groupByContinent } from '@/data/sightings'
import { CONTINENT_TOOLTIPS, CONTINENT_EMPTY, FILTER } from '@/data/strings'
import { useAppStore, yieldThread } from '@/composables'
import { sightingColumns } from './columns'
import type { Sighting, DataGridColumn } from '@/types'

export class SightingGrids extends Component {
  private columns!: DataGridColumn<Sighting>[]
  private renderVersion = 0
  private activeGrids!: DataGrid<Sighting>[]

  protected create(): HTMLElement {
    this.columns = sightingColumns()
    this.activeGrids = []
    return h('div', { className: 'grids-container' })
  }

  // ─── Public API ─────────────────────────────────────────────────

  async render(sightings: Sighting[], isRerender = false): Promise<void> {
    const store = useAppStore()
    const selected = store.selectedContinent.get()
    const version = ++this.renderVersion

    clearChildren(this.el)
    this.activeGrids = []

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

    for (const group of groups) {
      if (version !== this.renderVersion) return

      if (group.count > 0) {
        const grid = new DataGrid<Sighting>({
          columns: this.columns,
          data: group.items,
          onRowClick: (s, trigger) => SightingModal.open(s, trigger)
        })
        this.activeGrids.push(grid)

        frag.appendChild(
          new Section({
            title: group.label,
            count: group.count,
            tooltip: CONTINENT_TOOLTIPS[group.continent],
            content: grid.el
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

  scrollToSighting(sightingId: string): boolean {
    for (const grid of this.activeGrids) {
      if (grid.scrollToItem(s => s.id === sightingId)) return true
    }
    return false
  }

  showLoader(loader: HTMLElement): void {
    clearChildren(this.el)
    this.el.appendChild(loader)
  }

  lockHeight(): () => void {
    const prev = this.el.offsetHeight
    if (prev > 0) this.el.style.minHeight = `${prev}px`
    return () => {
      requestAnimationFrame(() => { this.el.style.minHeight = '' })
    }
  }
}
