import { h, mount, clearChildren } from '@/utils/dom'
import { useDataSource } from '@/composables'
import { Continent, SightingShape } from '@/enums'
import { renderHeader } from '@/components/header'
import { renderTicker } from '@/components/ticker'
import { renderLoader } from '@/components/loader'
import { renderSection } from '@/components/layout'
import { renderDataGrid } from '@/components/data-grid'
import { renderStatusTag } from '@/components/tags'
import { renderCredibilityBar } from '@/components/credibility-bar'
import { renderDataSources } from '@/components/data-sources'
import { renderFooter } from '@/components/footer'
import { openSightingModal } from '@/components/sighting-modal'
import { groupByContinent } from '@/data/sightings'
import type { Sighting, DataGridColumn, SightingFilter } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Yield to the main thread so the UI stays responsive */
function yieldThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ─── Column definitions ─────────────────────────────────────────────

function sightingColumns(): DataGridColumn<Sighting>[] {
  return [
    {
      key: 'summary',
      label: 'REPORT',
      width: '50%',
      sortable: false,
      render: (row) =>
        h('div', { className: 'cell-report' },
          h('span', { className: 'cell-report__summary' }, row.summary || '—'),
          h('span', { className: 'cell-report__meta' },
            `${row.region}${row.country ? ', ' + row.country : ''} · ${row.shape}`,
          ),
        ),
    },
    {
      key: 'credibility',
      label: 'CRED',
      width: '100px',
      align: 'right',
      render: (row) => renderCredibilityBar({ value: row.credibility }),
    },
    {
      key: 'status',
      label: 'STATUS',
      width: '80px',
      align: 'right',
      render: (row) => renderStatusTag({ status: row.status }),
    },
    {
      key: 'occurredAt',
      label: 'DATE',
      width: '90px',
      align: 'right',
      render: (row) => h('span', { className: 'cell-time' }, formatDate(row.occurredAt)),
    },
  ]
}

// ─── Year selector (FROM ~ TO) ──────────────────────────────────────

interface YearSelectorProps {
  availableYears: number[]
  defaultFrom: number
  defaultTo: number
  onRangeChange: (from: number, to: number) => void
}

function renderYearSelector(props: YearSelectorProps): HTMLElement {
  const { availableYears, defaultFrom, defaultTo, onRangeChange } = props

  if (availableYears.length === 0) {
    return h('div', { className: 'year-selector' },
      h('span', { className: 'year-selector__label' }, 'NO DATA'),
    )
  }

  function makeSelect(selected: number, label: string): HTMLSelectElement {
    const sel = document.createElement('select')
    sel.className = 'year-selector__select'
    sel.setAttribute('aria-label', label)
    for (const y of availableYears) {
      const opt = document.createElement('option')
      opt.value = String(y)
      opt.textContent = String(y)
      if (y === selected) opt.selected = true
      sel.appendChild(opt)
    }
    return sel
  }

  const fromSelect = makeSelect(Math.max(availableYears[availableYears.length - 1], defaultFrom), 'From year')
  const toSelect = makeSelect(Math.min(availableYears[0], defaultTo), 'To year')

  const countEl = h('span', { className: 'year-selector__count' }, '')

  function fireChange(): void {
    let from = Number(fromSelect.value)
    let to = Number(toSelect.value)
    if (from > to) {
      to = from
      toSelect.value = String(to)
    }
    onRangeChange(from, to)
  }

  fromSelect.addEventListener('change', fireChange)
  toSelect.addEventListener('change', fireChange)

  return h('div', { className: 'year-selector' },
    h('span', { className: 'year-selector__label' }, 'RANGE'),
    fromSelect,
    h('span', { className: 'year-selector__separator' }, '~'),
    toSelect,
    countEl,
  )
}

// ─── Filter toolbar ─────────────────────────────────────────────────

interface FilterToolbarProps {
  onFilterChange: (filter: SightingFilter) => void
}

function renderFilterToolbar(props: FilterToolbarProps): HTMLElement {
  const { onFilterChange } = props

  let currentFilter: SightingFilter = {}
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function emit(): void {
    onFilterChange({ ...currentFilter })
  }

  // Search input
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.className = 'filter-toolbar__search'
  searchInput.placeholder = 'SEARCH REPORTS...'
  searchInput.setAttribute('aria-label', 'Search sighting reports')
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim()
    currentFilter.search = val || undefined
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(emit, 300)
  })

  // Shape filter
  const shapeSelect = document.createElement('select')
  shapeSelect.className = 'filter-toolbar__select'
  shapeSelect.setAttribute('aria-label', 'Filter by shape')
  const shapeAll = document.createElement('option')
  shapeAll.value = ''
  shapeAll.textContent = 'ALL SHAPES'
  shapeSelect.appendChild(shapeAll)

  for (const shape of Object.values(SightingShape)) {
    const opt = document.createElement('option')
    opt.value = shape
    opt.textContent = shape.toUpperCase()
    shapeSelect.appendChild(opt)
  }

  shapeSelect.addEventListener('change', () => {
    currentFilter.shape = shapeSelect.value ? (shapeSelect.value as SightingShape) : undefined
    emit()
  })

  // Continent filter
  const continentSelect = document.createElement('select')
  continentSelect.className = 'filter-toolbar__select'
  continentSelect.setAttribute('aria-label', 'Filter by region')
  const contAll = document.createElement('option')
  contAll.value = ''
  contAll.textContent = 'ALL REGIONS'
  continentSelect.appendChild(contAll)

  const continentLabels: Record<string, string> = {
    [Continent.AMERICAS]: 'AMERICAS',
    [Continent.ASIA]: 'ASIA-PACIFIC',
    [Continent.EUROPE]: 'EUROPE',
    [Continent.OCEANIA]: 'OCEANIA',
    [Continent.AFRICA]: 'AFRICA',
  }

  for (const [value, label] of Object.entries(continentLabels)) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    continentSelect.appendChild(opt)
  }

  continentSelect.addEventListener('change', () => {
    currentFilter.continent = continentSelect.value ? (continentSelect.value as Continent) : undefined
    emit()
  })

  return h('div', { className: 'filter-toolbar', role: 'search', 'aria-label': 'Filter sighting reports' },
    searchInput,
    h('div', { className: 'filter-toolbar__selects' },
      shapeSelect,
      continentSelect,
    ),
  )
}

// ─── Non-blocking filter + render pipeline ──────────────────────────

async function filterSightings(
  all: Sighting[],
  filter: SightingFilter,
): Promise<Sighting[]> {
  const hasFilter = filter.search || filter.shape || filter.continent || filter.minCredibility

  if (!hasFilter) return all

  const searchLower = filter.search?.toLowerCase()
  const result: Sighting[] = []

  // Process in chunks of 5000 to avoid blocking
  const CHUNK = 5000
  for (let i = 0; i < all.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, all.length)
    for (let j = i; j < end; j++) {
      const s = all[j]
      if (searchLower) {
        const match =
          s.summary.toLowerCase().includes(searchLower) ||
          s.region.toLowerCase().includes(searchLower) ||
          s.country.toLowerCase().includes(searchLower) ||
          s.location.toLowerCase().includes(searchLower) ||
          s.shape.toLowerCase().includes(searchLower)
        if (!match) continue
      }
      if (filter.shape && s.shape !== filter.shape) continue
      if (filter.continent && s.continent !== filter.continent) continue
      if (filter.minCredibility && s.credibility < filter.minCredibility) continue
      result.push(s)
    }

    // Yield every chunk so UI stays responsive
    if (end < all.length) await yieldThread()
  }

  return result
}

async function renderSightingGrids(
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

  // Render each group with a yield between to keep UI responsive
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

  // ─ Fetch initial data ─
  const { fetchSightings, fetchYearRange, getSources, nuforc } = useDataSource()
  const initialSightings = await fetchSightings()

  clearChildren(main)

  // ─ State ─
  let allSightings: Sighting[] = initialSightings
  let activeFilter: SightingFilter = {}
  let isLoading = false
  let renderVersion = 0 // guards stale renders

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

    // Bail if a newer render was triggered while we were filtering
    if (version !== renderVersion) return

    await renderSightingGrids(gridsContainer, filtered)
    updateCount(filtered.length)
  }

  // ─ Year selector ─
  const availableYears = nuforc.getAvailableYears()
  const newest = availableYears[0] ?? new Date().getFullYear()
  const defaultFrom = newest - 1

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

  // Initial render
  await renderSightingGrids(gridsContainer, initialSightings)
  updateCount(initialSightings.length)

  // Data sources panel
  main.appendChild(
    renderSection(
      { title: 'DATA SOURCES' },
      renderDataSources({ sources: getSources() }),
    ),
  )

  main.appendChild(renderFooter())
}
