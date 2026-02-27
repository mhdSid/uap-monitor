import { h } from '@/utils/dom'
import { Continent, SightingShape } from '@/enums'
import { CONTINENT_LABELS, FILTER, ARIA } from '@/data/strings'
import { useAppStore, useDebounce } from '@/composables'
import type { SightingFilter } from '@/types'

export function renderFilterToolbar(): HTMLElement {
  const store = useAppStore()

  const currentFilter: SightingFilter = {}

  function emit(): void {
    store.filter.set({ ...currentFilter })
  }

  const emitDebounced = useDebounce(emit, 300)

  // Search input — debounced to avoid thrashing on every keystroke
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
      emitDebounced()
    },
  })

  // Shape filter — immediate (discrete selection, no typing)
  const shapeSelect = h('select', {
    className: 'filter-toolbar__select',
    id: 'filter-shape',
    name: 'filter-shape',
    autocomplete: 'off',
    'aria-label': ARIA.FILTER_SHAPE,
    onChange: () => {
      const val = (shapeSelect as HTMLSelectElement).value
      currentFilter.shape = val ? (val as SightingShape) : undefined
      emitDebounced.flush()
      emit()
    },
  })

  shapeSelect.appendChild(h('option', { value: '' }, FILTER.ALL_SHAPES))
  for (const shape of Object.values(SightingShape)) {
    shapeSelect.appendChild(h('option', { value: shape }, shape.toUpperCase()))
  }

  // Continent filter — immediate
  const continentSelect = h('select', {
    className: 'filter-toolbar__select',
    id: 'filter-region',
    name: 'filter-region',
    autocomplete: 'off',
    'aria-label': ARIA.FILTER_REGION,
    onChange: () => {
      const val = (continentSelect as HTMLSelectElement).value
      currentFilter.continent = val ? (val as Continent) : undefined
      emitDebounced.flush()
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
