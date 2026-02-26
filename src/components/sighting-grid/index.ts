import { h, clearChildren } from '@/utils/dom'
import { yieldThread } from '@/utils/format'
import { renderSection } from '@/components/layout'
import { renderDataGrid } from '@/components/data-grid'
import { openSightingModal } from '@/components/sighting-modal'
import { groupByContinent } from '@/data/sightings'
import { sightingColumns } from './columns'
import type { Sighting } from '@/types'

/**
 * Render sighting data grouped by continent into section panels.
 * Yields between groups to keep UI responsive during large datasets.
 */
export async function renderSightingGrids(
  container: HTMLElement,
  sightings: Sighting[],
): Promise<void> {
  clearChildren(container)

  if (sightings.length === 0) {
    container.appendChild(
      h('div', { className: 'empty-state' },
        h('span', { className: 'empty-state__text' }, 'NO MATCHING SIGHTINGS'),
      ),
    )
    return
  }

  const columns = sightingColumns()
  const groups = groupByContinent(sightings)

  for (const group of groups) {
    container.appendChild(
      renderSection(
        {
          title: group.label,
          count: group.count,
          tag: h('span', { className: 'tag tag--count' }, String(group.count)),
        },
        renderDataGrid<Sighting>({
          columns,
          data: group.items,
          onRowClick: openSightingModal,
        }),
      ),
    )
    await yieldThread()
  }
}
