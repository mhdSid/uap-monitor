import { h, mount, clearChildren } from '@/utils/dom'
import { useDataSource, filterSightings, useTicker, useAppStore, batch, minDelay } from '@/composables'
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

// ─── App entry ──────────────────────────────────────────────────────

export async function createApp(root: HTMLElement): Promise<void> {
  const store = useAppStore()

  // ─ App shell (visible immediately) ────────────────────────────
  const main = h('main', { className: 'app-main', role: 'main' },
    h('div', { className: 'app-loader' }, renderLoader()),
  )

  const ticker = renderTicker({
    onClick: (sightingId) => scrollToSighting(sightingId),
  })
  const { generateMessages } = useTicker()

  mount(root, h('div', { className: 'app' },
    h('div', { className: 'scanlines' }),
    renderHeader(),
    ticker.el,
    main,
  ))

  // ─ Load manifest → hydrate store ──────────────────────────────
  const dataSource = useDataSource()
  const { fetchYearRange, fetchProgressive, getSources, loadManifests } = dataSource

  await loadManifests()

  const years = dataSource.getAvailableYears()
  const newest = years[0] ?? new Date().getFullYear()
  const defaultFrom = newest - 1

  batch(() => {
    store.availableYears.set(years)
    store.totalCount.set(dataSource.getTotalCount())
    store.sources.set(getSources())
    store.yearRange.set({ from: defaultFrom, to: newest })
  })

  // ─ UI helpers ─────────────────────────────────────────────────
  const gridsContainer = h('div', { className: 'grids-container' })
  let renderVersion = 0

  function showLoader(): void {
    clearChildren(gridsContainer)
    gridsContainer.appendChild(h('div', { className: 'app-loader' }, renderLoader()))
  }

  function lockHeight(container: HTMLElement): () => void {
    const prev = container.offsetHeight
    if (prev > 0) container.style.minHeight = `${prev}px`
    return () => {
      requestAnimationFrame(() => { container.style.minHeight = '' })
    }
  }

  // ─ Filter reaction ────────────────────────────────────────────
  // Async filter + re-render when store.filter changes.
  // Uses renderVersion to cancel stale renders.

  async function applyFilterAndRender(skipDelay = false): Promise<void> {
    const version = ++renderVersion

    const releaseLoader = lockHeight(gridsContainer)
    showLoader()

    const doFilter = () => filterSightings(
      store.sightings.get(),
      store.filter.get(),
    )

    const filtered = skipDelay
      ? await doFilter()
      : await minDelay(doFilter)

    if (version !== renderVersion) {
      releaseLoader()
      return
    }

    const releaseRender = lockHeight(gridsContainer)
    await renderSightingGrids(gridsContainer, filtered, true)
    releaseRender()
    releaseLoader()

    store.shownCount.set(filtered.length)
  }

  store.filter.subscribe(() => {
    applyFilterAndRender()
  })

  // ─ Year range reaction ────────────────────────────────────────
  // Fetch data for new range + re-render.
  // Skips the first change (initial hydration — handled by progressive load below).

  let yearRangeReady = false

  store.yearRange.subscribe(async () => {
    if (!yearRangeReady) return
    if (store.loading.get()) return

    store.loading.set(true)
    showLoader()

    const { from, to } = store.yearRange.get()
    const sightings = await minDelay(() => fetchYearRange(from, to))

    batch(() => {
      store.sightings.set(sightings)
      store.shownCount.set(sightings.length)
      store.loading.set(false)
    })

    await applyFilterAndRender(true)
    ticker.setMessages(generateMessages(store.sightings.get()))
  })

  // ─ Build skeleton ─────────────────────────────────────────────
  const controlsForm = h('form', {
    className: 'controls-form',
    autocomplete: 'off',
    onSubmit: (e: Event) => e.preventDefault(),
  },
    renderYearSelector(),
    renderFilterToolbar(),
  )

  gridsContainer.appendChild(h('div', { className: 'app-loader' }, renderLoader()))

  clearChildren(main)
  main.appendChild(controlsForm)
  main.appendChild(gridsContainer)

  // ─ Progressive load ───────────────────────────────────────────
  const finalSightings = await fetchProgressive(defaultFrom, newest, (partial) => {
    store.sightings.set(partial)
    store.shownCount.set(partial.length)
    renderSightingGrids(gridsContainer, partial)
  })

  // ─ Below-fold content (deferred until grids are done) ─────────
  const sourcesBody = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })

  sourcesBody.appendChild(
    renderAlert({
      variant: AlertVariant.INFO,
      title: SECTION.INTEL_TITLE,
      content: SECTION.INTEL_CONTENT,
      dismissible: true,
    }),
  )

  sourcesBody.appendChild(renderDataSources({ sources: store.sources.get() }))

  main.appendChild(
    renderSection({
      title: SECTION.DATA_SOURCES,
      tooltip: SECTION.DATA_SOURCES_TOOLTIP,
    }, sourcesBody),
  )
  main.appendChild(renderFooter())

  // ─ Finalize ───────────────────────────────────────────────────
  batch(() => {
    store.sightings.set(finalSightings)
    store.shownCount.set(finalSightings.length)
    store.totalCount.set(dataSource.getTotalCount())
  })

  ticker.setMessages(generateMessages(store.sightings.get()))

  // Enable year-range subscription now that initial load is done
  yearRangeReady = true
}
