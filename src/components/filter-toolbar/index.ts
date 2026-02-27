import { Component } from '@/core'
import { h } from '@/utils/dom'
import { Continent, SightingShape } from '@/enums'
import { CONTINENT_LABELS, FILTER, ARIA } from '@/data/strings'
import { useAppStore, useDebounce } from '@/composables'
import type { SightingFilter } from '@/types'

export class FilterToolbar extends Component {
  private currentFilter!: SightingFilter
  private searchInput!: HTMLInputElement
  private shapeSelect!: HTMLSelectElement
  private continentSelect!: HTMLSelectElement
  private emitDebounced!: ReturnType<typeof useDebounce>

  protected create(): HTMLElement {
    this.currentFilter = {}
    const store = useAppStore()

    const emit = (): void => {
      store.filter.set({ ...this.currentFilter })
    }

    this.emitDebounced = useDebounce(emit, 300)

    this.searchInput = h('input', {
      className: 'filter-toolbar__search',
      id: 'filter-search',
      name: 'filter-search',
      type: 'text',
      autocomplete: 'off',
      placeholder: FILTER.SEARCH_PLACEHOLDER,
      'aria-label': ARIA.SEARCH,
      onInput: () => {
        const val = this.searchInput.value.trim()
        this.currentFilter.search = val || undefined
        this.emitDebounced()
      },
    }) as HTMLInputElement

    this.shapeSelect = h('select', {
      className: 'filter-toolbar__select',
      id: 'filter-shape',
      name: 'filter-shape',
      autocomplete: 'off',
      'aria-label': ARIA.FILTER_SHAPE,
      onChange: () => {
        const val = this.shapeSelect.value
        this.currentFilter.shape = val ? (val as SightingShape) : undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      },
    }) as HTMLSelectElement

    this.shapeSelect.appendChild(h('option', { value: '' }, FILTER.ALL_SHAPES))
    for (const shape of Object.values(SightingShape)) {
      this.shapeSelect.appendChild(h('option', { value: shape }, shape.toUpperCase()))
    }

    this.continentSelect = h('select', {
      className: 'filter-toolbar__select',
      id: 'filter-region',
      name: 'filter-region',
      autocomplete: 'off',
      'aria-label': ARIA.FILTER_REGION,
      onChange: () => {
        const val = this.continentSelect.value
        this.currentFilter.continent = val ? (val as Continent) : undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      },
    }) as HTMLSelectElement

    this.continentSelect.appendChild(h('option', { value: '' }, FILTER.ALL_REGIONS))
    for (const [value, label] of Object.entries(CONTINENT_LABELS)) {
      this.continentSelect.appendChild(h('option', { value }, label))
    }

    return h('div', { className: 'filter-toolbar', role: 'search', 'aria-label': ARIA.FILTER_BAR },
      this.searchInput,
      h('div', { className: 'filter-toolbar__selects' },
        this.shapeSelect,
        this.continentSelect,
      ),
    )
  }
}
