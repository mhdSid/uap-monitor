import { h, clearChildren } from '@/utils/dom'
import { yieldThread } from '@/utils/format'
import { Continent } from '@/enums'
import { renderSection } from '@/components/layout'
import { renderDataGrid } from '@/components/data-grid'
import { openSightingModal } from '@/components/sighting-modal'
import { groupByContinent } from '@/data/sightings'
import { sightingColumns } from './columns'
import type { Sighting, DataGridHandle } from '@/types'

const CONTINENT_TOOLTIPS: Record<string, string> = {
  [Continent.AMERICAS]: 'Sightings from North, Central, and South America. NUFORC is US-based so this region has the highest volume.',
  [Continent.EUROPE]: 'Sightings from European countries including UK, Turkey, and Caucasus states. GEIPAN (France) integration planned.',
  [Continent.EURASIA]: 'Sightings from Russia — spanning both European and Asian territories. Treated as a separate transcontinental region.',
  [Continent.ASIA_MIDDLE_EAST]: 'Sightings from the Middle East, Central Asia, and South Asia — including Iran, Saudi Arabia, India, Pakistan, and Afghanistan.',
  [Continent.ASIA_PACIFIC]: 'Sightings from East and Southeast Asia including Japan, China, Korea, and ASEAN nations. CJK scraper integration planned.',
  [Continent.OCEANIA]: 'Sightings from Australia, New Zealand, and Pacific Island nations.',
  [Continent.AFRICA]: 'Sightings from African nations. Historically underreported in English-language databases.',
}

const CONTINENT_EMPTY: Record<string, string> = {
  [Continent.AMERICAS]: 'No sightings in the Americas for current filters.',
  [Continent.EUROPE]: 'No sightings in Europe for current filters. GEIPAN integration will increase coverage.',
  [Continent.EURASIA]: 'No sightings in Eurasia (Russia) for current filters.',
  [Continent.ASIA_MIDDLE_EAST]: 'No sightings in the Middle East for current filters.',
  [Continent.ASIA_PACIFIC]: 'No sightings in Asia-Pacific for current filters. CJK scraper integration planned.',
  [Continent.OCEANIA]: 'No sightings in Oceania for current filters.',
  [Continent.AFRICA]: 'No sightings in Africa for current filters. Coverage is limited in English-language databases.',
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
        h('span', { className: 'empty-state__text' }, 'NO MATCHING SIGHTINGS'),
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
              CONTINENT_EMPTY[group.continent] ?? 'No sightings for current filters.',
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
