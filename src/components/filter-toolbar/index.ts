import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { Continent, SightingShape, DataSourceId } from '@/enums'
import { CONTINENT_LABELS, FILTER, ARIA } from '@/data/strings'
import { useAppStore, useDebounce } from '@/composables'
import { Checkbox } from '@/components/checkbox'
import { colors } from '@/styles/palette'
import type { SightingFilter } from '@/types'

// ─── Source chip config (uses enum + palette — no anonymous strings) ─

const SOURCE_CHIPS: { id: DataSourceId; label: string; color: string }[] = [
  { id: DataSourceId.NUFORC,     label: DataSourceId.NUFORC,     color: colors.sourceNuforc },
  { id: DataSourceId.HATCH_UDB,  label: DataSourceId.HATCH_UDB,  color: colors.sourceHatch },
  { id: DataSourceId.CHRONOLOGY, label: DataSourceId.CHRONOLOGY,  color: colors.sourceChronology }
]

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
      className: cx.search,
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
      }
    }) as HTMLInputElement

    this.shapeSelect = h('select', {
      className: cx.select,
      id: 'filter-shape',
      name: 'filter-shape',
      autocomplete: 'off',
      'aria-label': ARIA.FILTER_SHAPE,
      onChange: () => {
        const val = this.shapeSelect.value
        this.currentFilter.shape = val ? (val as SightingShape) : undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    }) as HTMLSelectElement

    this.shapeSelect.appendChild(h('option', { value: '' }, FILTER.ALL_SHAPES))
    for (const shape of Object.values(SightingShape)) {
      this.shapeSelect.appendChild(h('option', { value: shape }, shape.toUpperCase()))
    }

    this.continentSelect = h('select', {
      className: cx.select,
      id: 'filter-region',
      name: 'filter-region',
      autocomplete: 'off',
      'aria-label': ARIA.FILTER_REGION,
      onChange: () => {
        const val = this.continentSelect.value
        this.currentFilter.continent = val ? (val as Continent) : undefined
        this.currentFilter.country = undefined
        this.countrySelect.value = ''
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    }) as HTMLSelectElement

    this.continentSelect.appendChild(h('option', { value: '' }, FILTER.ALL_REGIONS))
    for (const [value, label] of Object.entries(CONTINENT_LABELS)) {
      this.continentSelect.appendChild(h('option', { value }, label))
    }

    this.countrySelect = h('select', {
      className: cx.select,
      id: 'filter-country',
      name: 'filter-country',
      autocomplete: 'off',
      'aria-label': 'Filter by country',
      onChange: () => {
        const val = this.countrySelect.value
        this.currentFilter.country = val || undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    }) as HTMLSelectElement

    this.countrySelect.appendChild(h('option', { value: '' }, FILTER.ALL_COUNTRIES))
    store.sightings.subscribe(() => this.updateCountryOptions())

    // ── Source chips ─────────────────────────────────────────────
    const sourceChips = SOURCE_CHIPS.map(src => {
      return new Checkbox({
        label: src.label,
        color: src.color,
        checked: true,
        onChange: (checked) => {
          const active = this.currentFilter.sources
            ?? new Set(SOURCE_CHIPS.map(s => s.id as string))
          if (checked) active.add(src.id)
          else active.delete(src.id)
          this.currentFilter.sources = active.size === SOURCE_CHIPS.length ? undefined : new Set(active)
          store.filter.set({ ...this.currentFilter })
        }
      })
    })

    return h('div', { className: cx.root, role: 'search', 'aria-label': ARIA.FILTER_BAR },
      this.searchInput,
      h('div', { className: cx.selects },
        this.shapeSelect,
        this.continentSelect,
        this.countrySelect
      ),
      h('div', { className: cx.sources },
        ...sourceChips.map(cb => cb.el)
      )
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

    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)

    const currentVal = this.countrySelect.value

    while (this.countrySelect.options.length > 1) {
      this.countrySelect.remove(1)
    }

    for (const [country, count] of sorted) {
      this.countrySelect.appendChild(
        h('option', { value: country }, `${country} (${count})`)
      )
    }

    if (currentVal) this.countrySelect.value = currentVal
  }
}
