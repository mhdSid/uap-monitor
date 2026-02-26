import { h, mount, clearChildren } from '@/utils/dom'
import { useDataSource, filterSightings, useTicker } from '@/composables'
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
import { renderSightingGrids, scrollToSighting } from '@/components/sighting-grid'
import { SECTION } from '@/data/strings'
import type { Sighting, SightingFilter } from '@/types'

// ─── App entry ──────────────────────────────────────────────────────

export async function createApp(root: HTMLElement): Promise<void> {
  const main = h('main', { className: 'app-main', role: 'main' },
    h('div', { className: 'app-loader' }, renderLoader()),
  )

  const ticker = renderTicker({
    onClick: (sightingId) => scrollToSighting(sightingId),
  })
  const { generateMessages } = useTicker()

  const app = h('div', { className: 'app' },
    h('div', { className: 'scanlines' }),
    renderHeader(),
    ticker.el,
    main,
  )

  mount(root, app)

  // ─ Fetch manifest ─
  const { fetchYearRange, fetchProgressive, getSources, nuforc } = useDataSource()

  await nuforc.loadManifest()
  const availableYears = nuforc.getAvailableYears()
  const newest = availableYears[0] ?? new Date().getFullYear()
  const defaultFrom = newest - 1

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

  /**
   * Smoothly transition the grids container height when content changes,
   * preventing sections below from jumping.
   */
  function preserveHeight(container: HTMLElement, fn: () => void): void {
    const prevHeight = container.offsetHeight
    if (prevHeight > 0) {
      container.style.minHeight = `${prevHeight}px`
    }

    fn()

    // Release the min-height after content has rendered
    requestAnimationFrame(() => {
      container.style.minHeight = ''
    })
  }

  async function applyFilterAndRender(): Promise<void> {
    const version = ++renderVersion

    preserveHeight(gridsContainer, showLoader)

    const filtered = await filterSightings(allSightings, activeFilter)

    if (version !== renderVersion) return

    preserveHeight(gridsContainer, () => {
      renderSightingGrids(gridsContainer, filtered)
    })
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

  // ─ Data sources panel (built now, part of initial skeleton) ─
  const sourcesBody = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })

  sourcesBody.appendChild(
    renderAlert({
      variant: AlertVariant.INFO,
      title: SECTION.INTEL_TITLE,
      content: SECTION.INTEL_CONTENT,
      dismissible: true,
    }),
  )

  sourcesBody.appendChild(renderDataSources({ sources: getSources() }))

  const sourcesSection = renderSection({
    title: SECTION.DATA_SOURCES,
    tooltip: SECTION.DATA_SOURCES_TOOLTIP,
  }, sourcesBody)

  // ─ Wrap controls in a form (prevents browser autofill warnings) ─
  const controlsForm = h('form', {
    className: 'controls-form',
    autocomplete: 'off',
    onSubmit: (e: Event) => e.preventDefault(),
  },
    yearSelector,
    filterToolbar,
  )

  // ─ Assemble complete layout skeleton at once ─
  // Loader goes into gridsContainer BEFORE appending to DOM
  // so the container has height from the first paint
  gridsContainer.appendChild(h('div', { className: 'app-loader' }, renderLoader()))

  clearChildren(main)
  main.appendChild(controlsForm)
  main.appendChild(gridsContainer)
  main.appendChild(sourcesSection)
  main.appendChild(renderFooter())

  // ─ Progressive load — render each year's data as it arrives ─
  const finalSightings = await fetchProgressive(defaultFrom, newest, (partial) => {
    allSightings = partial
    preserveHeight(gridsContainer, () => {
      renderSightingGrids(gridsContainer, partial)
    })
    updateCount(partial.length)
  })

  allSightings = finalSightings

  // ─ Feed real sighting data to ticker ─
  ticker.setMessages(generateMessages(allSightings))
}
