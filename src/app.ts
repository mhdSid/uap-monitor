import { h, mount, clearChildren } from '@/utils/dom'
import { useDataSource, filterSightings } from '@/composables'
import { AlertVariant } from '@/enums'
import { renderHeader } from '@/components/header'
import { renderTicker } from '@/components/ticker'
import { renderLoader } from '@/components/loader'
import { renderSection } from '@/components/layout'
import { renderDataSources } from '@/components/data-sources'
import { renderAlert } from '@/components/alert'
import { renderFooter } from '@/components/footer'
import { renderYearSelector } from '@/components/year-selector'
import { renderFilterToolbar } from '@/components/filter-toolbar'
import { renderSightingGrids } from '@/components/sighting-grid'
import type { Sighting, SightingFilter } from '@/types'

// ─── App entry ──────────────────────────────────────────────────────

export async function createApp(root: HTMLElement): Promise<void> {
  const main = h('main', { className: 'app-main', role: 'main' },
    h('div', { className: 'app-loader' }, renderLoader()),
  )

  const app = h('div', { className: 'app' },
    h('div', { className: 'scanlines' }),
    renderHeader(),
    renderTicker(),
    main,
  )

  mount(root, app)

  // ─ Fetch initial data (progressive — render as each year loads) ─
  const { fetchYearRange, fetchProgressive, getSources, nuforc } = useDataSource()

  await nuforc.loadManifest()
  const availableYears = nuforc.getAvailableYears()
  const newest = availableYears[0] ?? new Date().getFullYear()
  const defaultFrom = newest - 1

  clearChildren(main)

  // ─ State ─
  let allSightings: Sighting[] = []
  let activeFilter: SightingFilter = {}
  let isLoading = false
  let renderVersion = 0

  // ─ Containers ─
  const gridsContainer = h('div', { className: 'grids-container' })

  function updateCount(shown: number): void {
    const el = main.querySelector('.year-selector__count')
    if (el) {
      el.textContent = `${shown.toLocaleString()} / ${nuforc.getTotalCount().toLocaleString()}`
    }
  }

  function showLoader(): void {
    clearChildren(gridsContainer)
    gridsContainer.appendChild(h('div', { className: 'app-loader' }, renderLoader()))
  }

  async function applyFilterAndRender(): Promise<void> {
    const version = ++renderVersion

    showLoader()

    const filtered = await filterSightings(allSightings, activeFilter)

    if (version !== renderVersion) return

    await renderSightingGrids(gridsContainer, filtered)
    updateCount(filtered.length)
  }

  // ─ Year selector ─
  const yearSelector = renderYearSelector({
    availableYears,
    defaultFrom,
    defaultTo: newest,
    onRangeChange: async (from, to) => {
      if (isLoading) return
      isLoading = true
      showLoader()

      allSightings = await fetchYearRange(from, to)
      isLoading = false

      await applyFilterAndRender()
    },
  })

  // ─ Filter toolbar ─
  const filterToolbar = renderFilterToolbar({
    onFilterChange: (filter) => {
      activeFilter = filter
      applyFilterAndRender()
    },
  })

  // ─ Assemble layout ─
  main.appendChild(yearSelector)
  main.appendChild(filterToolbar)
  main.appendChild(gridsContainer)

  gridsContainer.appendChild(h('div', { className: 'app-loader' }, renderLoader()))

  // Progressive load — render each year's data as it arrives
  const finalSightings = await fetchProgressive(defaultFrom, newest, (partial) => {
    allSightings = partial
    renderSightingGrids(gridsContainer, partial)
    updateCount(partial.length)
  })

  allSightings = finalSightings

  // ─ Data sources panel ─
  const sourcesBody = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })

  sourcesBody.appendChild(
    renderAlert({
      variant: AlertVariant.INFO,
      title: 'INTELLIGENCE SOURCES',
      content: 'UAP Monitor aggregates data from multiple open-source intelligence feeds. Green indicators are live. Disabled sources are planned integrations — hover any source for details.',
      dismissible: true,
    }),
  )

  sourcesBody.appendChild(renderDataSources({ sources: getSources() }))

  main.appendChild(renderSection({ title: 'DATA SOURCES' }, sourcesBody))

  main.appendChild(renderFooter())
}
