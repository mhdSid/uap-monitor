import { h, clearChildren } from '@/utils/dom'
import { renderSection } from '@/components/layout'
import { renderDataGrid } from '@/components/data-grid'
import { openSightingModal } from '@/components/sighting-modal'
import { groupByContinent } from '@/data/sightings'
import { CONTINENT_TOOLTIPS, CONTINENT_EMPTY, FILTER } from '@/data/strings'
import { useAppStore, yieldThread } from '@/composables'
import { sightingColumns } from './columns'
import type { Sighting, DataGridHandle } from '@/types'

/** Cached column definitions — reused across renders. */
let _columns: ReturnType<typeof sightingColumns> | null = null
function getColumns() {
  if (!_columns) _columns = sightingColumns()
  return _columns
}

/**
 * Monotonically increasing render version.
 * Each call to renderSightingGrids increments this;
 * if a yield resumes and the version has changed, the render aborts.
 */
let currentRenderVersion = 0

/** Active grid handles from the most recent render, keyed by continent. */
let activeGrids: DataGridHandle<Sighting>[] = []

/**
 * Render sighting data grouped by continent into section panels.
 *
 * Reads `selectedContinent` from the store:
 * - undefined (ALL REGIONS): renders all 7 continents including empty ones.
 * - Specific continent: renders only that region's grid, hides empty grids.
 *
 * @param isRerender  Yield between groups on re-renders for responsiveness.
 */
export async function renderSightingGrids(
  container: HTMLElement,
  sightings: Sighting[],
  isRerender = false,
): Promise<void> {
  const store = useAppStore()
  const selected = store.selectedContinent.get()
  const version = ++currentRenderVersion

  clearChildren(container)
  activeGrids = []

  if (sightings.length === 0) {
    container.appendChild(
      h('div', { className: 'empty-state' },
        h('span', { className: 'empty-state__text' }, FILTER.NO_RESULTS),
      ),
    )
    return
  }

  const columns = getColumns()
  const groups = groupByContinent(sightings)

  const frag = document.createDocumentFragment()

  for (const group of groups) {
    if (version !== currentRenderVersion) return

    if (group.count > 0) {
      const grid = renderDataGrid<Sighting>({
        columns,
        data: group.items,
        onRowClick: openSightingModal,
      })
      activeGrids.push(grid)

      frag.appendChild(
        renderSection(
          {
            title: group.label,
            count: group.count,
            tooltip: CONTINENT_TOOLTIPS[group.continent],
          },
          grid.el,
        ),
      )
    } else if (!selected) {
      // Show empty continent placeholders only when viewing ALL regions
      frag.appendChild(
        renderSection(
          {
            title: group.label,
            count: group.count,
            tooltip: CONTINENT_TOOLTIPS[group.continent],
          },
          h('div', { className: 'empty-state empty-state--compact' },
            h('span', { className: 'empty-state__text' },
              CONTINENT_EMPTY[group.continent] ?? FILTER.EMPTY_DEFAULT,
            ),
          ),
        ),
      )
    }

    if (isRerender) {
      await yieldThread()
    }
  }

  container.appendChild(frag)
}

/**
 * Scroll to and highlight a sighting by its ID across all active continent grids.
 */
export function scrollToSighting(sightingId: string): boolean {
  for (const grid of activeGrids) {
    if (grid.scrollToItem(s => s.id === sightingId)) {
      return true
    }
  }
  return false
}
