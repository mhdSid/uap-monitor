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
  private countrySelect!: HTMLSelectElement
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
        // Clear country when continent changes
        this.currentFilter.country = undefined
        this.countrySelect.value = ''
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      },
    }) as HTMLSelectElement

    this.continentSelect.appendChild(h('option', { value: '' }, FILTER.ALL_REGIONS))
    for (const [value, label] of Object.entries(CONTINENT_LABELS)) {
      this.continentSelect.appendChild(h('option', { value }, label))
    }

    this.countrySelect = h('select', {
      className: 'filter-toolbar__select',
      id: 'filter-country',
      name: 'filter-country',
      autocomplete: 'off',
      'aria-label': 'Filter by country',
      onChange: () => {
        const val = this.countrySelect.value
        this.currentFilter.country = val || undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      },
    }) as HTMLSelectElement

    this.countrySelect.appendChild(h('option', { value: '' }, 'ALL COUNTRIES'))

    // Populate countries from loaded sightings reactively
    store.sightings.subscribe(() => this.updateCountryOptions())

    return h('div', { className: 'filter-toolbar', role: 'search', 'aria-label': ARIA.FILTER_BAR },
      this.searchInput,
      h('div', { className: 'filter-toolbar__selects' },
        this.shapeSelect,
        this.continentSelect,
        this.countrySelect,
      ),
    )
  }

  private updateCountryOptions(): void {
    const store = useAppStore()
    const sightings = store.sightings.get()
    const counts = new Map<string, number>()

    for (const s of sightings) {
      if (s.country && s.country !== 'Unknown') {
        counts.set(s.country, (counts.get(s.country) || 0) + 1)
      }
    }

    // Sort by count descending, take top 50
    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)

    const currentVal = this.countrySelect.value

    // Clear and rebuild
    while (this.countrySelect.options.length > 1) {
      this.countrySelect.remove(1)
    }

    for (const [country, count] of sorted) {
      this.countrySelect.appendChild(
        h('option', { value: country }, `${country} (${count})`),
      )
    }

    // Restore selection if still valid
    if (currentVal) this.countrySelect.value = currentVal
  }
}
