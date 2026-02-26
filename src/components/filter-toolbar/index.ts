import { h } from '@/utils/dom'
import { Continent, SightingShape } from '@/enums'
import type { SightingFilter } from '@/types'

export interface FilterToolbarProps {
  onFilterChange: (filter: SightingFilter) => void
}

const CONTINENT_LABELS: Record<string, string> = {
  [Continent.AMERICAS]: 'AMERICAS',
  [Continent.EUROPE]: 'EUROPE',
  [Continent.EURASIA]: 'EURASIA',
  [Continent.ASIA_MIDDLE_EAST]: 'ASIA — MIDDLE EAST',
  [Continent.ASIA_PACIFIC]: 'ASIA — PACIFIC',
  [Continent.OCEANIA]: 'OCEANIA',
  [Continent.AFRICA]: 'AFRICA',
}

export function renderFilterToolbar(props: FilterToolbarProps): HTMLElement {
  const { onFilterChange } = props

  const currentFilter: SightingFilter = {}
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

  for (const [value, label] of Object.entries(CONTINENT_LABELS)) {
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
