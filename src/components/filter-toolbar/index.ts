import { h } from '@/utils/dom'
import { Continent, SightingShape } from '@/enums'
import { CONTINENT_LABELS, FILTER, ARIA } from '@/data/strings'
import type { SightingFilter } from '@/types'

export interface FilterToolbarProps {
  onFilterChange: (filter: SightingFilter) => void
}

export function renderFilterToolbar(props: FilterToolbarProps): HTMLElement {
  const { onFilterChange } = props

  const currentFilter: SightingFilter = {}
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function emit(): void {
    onFilterChange({ ...currentFilter })
  }

  // Search input
  const searchInput = h('input', {
    className: 'filter-toolbar__search',
    id: 'filter-search',
    name: 'filter-search',
    type: 'text',
    autocomplete: 'off',
    placeholder: FILTER.SEARCH_PLACEHOLDER,
    'aria-label': ARIA.SEARCH,
    onInput: () => {
      const val = (searchInput as HTMLInputElement).value.trim()
      currentFilter.search = val || undefined
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(emit, 300)
    },
  })

  // Shape filter
  const shapeSelect = h('select', {
    className: 'filter-toolbar__select',
    id: 'filter-shape',
    name: 'filter-shape',
    autocomplete: 'off',
    'aria-label': ARIA.FILTER_SHAPE,
    onChange: () => {
      const val = (shapeSelect as HTMLSelectElement).value
      currentFilter.shape = val ? (val as SightingShape) : undefined
      emit()
    },
  })

  shapeSelect.appendChild(h('option', { value: '' }, FILTER.ALL_SHAPES))
  for (const shape of Object.values(SightingShape)) {
    shapeSelect.appendChild(h('option', { value: shape }, shape.toUpperCase()))
  }

  // Continent filter
  const continentSelect = h('select', {
    className: 'filter-toolbar__select',
    id: 'filter-region',
    name: 'filter-region',
    autocomplete: 'off',
    'aria-label': ARIA.FILTER_REGION,
    onChange: () => {
      const val = (continentSelect as HTMLSelectElement).value
      currentFilter.continent = val ? (val as Continent) : undefined
      emit()
    },
  })

  continentSelect.appendChild(h('option', { value: '' }, FILTER.ALL_REGIONS))
  for (const [value, label] of Object.entries(CONTINENT_LABELS)) {
    continentSelect.appendChild(h('option', { value }, label))
  }

  return h('div', { className: 'filter-toolbar', role: 'search', 'aria-label': ARIA.FILTER_BAR },
    searchInput,
    h('div', { className: 'filter-toolbar__selects' },
      shapeSelect,
      continentSelect,
    ),
  )
}
