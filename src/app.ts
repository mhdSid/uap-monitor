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
   * Lock container height during content changes to prevent layout shift.
   * Returns a release function to call when the operation completes.
   */
  function lockHeight(container: HTMLElement): () => void {
    const prevHeight = container.offsetHeight
    if (prevHeight > 0) {
      container.style.minHeight = `${prevHeight}px`
    }
    return () => {
      requestAnimationFrame(() => { container.style.minHeight = '' })
    }
  }

  async function applyFilterAndRender(): Promise<void> {
    const version = ++renderVersion

    const releaseLoader = lockHeight(gridsContainer)
    showLoader()

    const filtered = await filterSightings(allSightings, activeFilter)

    if (version !== renderVersion) {
      releaseLoader()
      return
    }

    const releaseRender = lockHeight(gridsContainer)
    await renderSightingGrids(gridsContainer, filtered, true)
    releaseRender()
    releaseLoader()
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
  // NOTE: sourcesSection and footer are appended AFTER progressive loading
  // completes, preventing CLS from grids pushing them down during load.

  // ─ Progressive load — render each year's data as it arrives ─
  const finalSightings = await fetchProgressive(defaultFrom, newest, (partial) => {
    allSightings = partial
    renderSightingGrids(gridsContainer, partial)
    updateCount(partial.length)
  })

  // ─ Build and append below-fold content after grids are fully rendered ─
  // Deferred to avoid blocking initial render with unnecessary DOM construction.
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

  main.appendChild(sourcesSection)
  main.appendChild(renderFooter())

  allSightings = finalSightings

  // ─ Feed real sighting data to ticker ─
  ticker.setMessages(generateMessages(allSightings))
}
