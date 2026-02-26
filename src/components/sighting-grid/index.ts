import { h, clearChildren } from '@/utils/dom'
import { yieldThread } from '@/utils/format'
import { renderSection } from '@/components/layout'
import { renderDataGrid } from '@/components/data-grid'
import { openSightingModal } from '@/components/sighting-modal'
import { groupByContinent } from '@/data/sightings'
import { CONTINENT_TOOLTIPS, CONTINENT_EMPTY, FILTER } from '@/data/strings'
import { sightingColumns } from './columns'
import type { Sighting, DataGridHandle } from '@/types'

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
 * Always renders all 7 continents — empty ones show a status message.
 * Yields between groups to keep UI responsive during large datasets.
 * Automatically cancels if a newer render starts mid-flight.
 */
export async function renderSightingGrids(
  container: HTMLElement,
  sightings: Sighting[],
): Promise<void> {
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

  const columns = sightingColumns()
  const groups = groupByContinent(sightings)

  for (const group of groups) {
    // Abort if a newer render has started
    if (version !== currentRenderVersion) return

    if (group.count > 0) {
      const grid = renderDataGrid<Sighting>({
        columns,
        data: group.items,
        onRowClick: openSightingModal,
      })
      activeGrids.push(grid)

      container.appendChild(
        renderSection(
          {
            title: group.label,
            count: group.count,
            tooltip: CONTINENT_TOOLTIPS[group.continent],
          },
          grid.el,
        ),
      )
    } else {
      container.appendChild(
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

    await yieldThread()
  }
}

/**
 * Scroll to and highlight a sighting by its ID across all active continent grids.
 * Returns true if the sighting was found and scrolled to.
 */
export function scrollToSighting(sightingId: string): boolean {
  for (const grid of activeGrids) {
    if (grid.scrollToItem(s => s.id === sightingId)) {
      return true
    }
  }
  return false
}
