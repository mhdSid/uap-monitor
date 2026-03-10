import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { Continent, SightingShape, DataSourceId } from '@/enums'
import { CONTINENT_LABELS, FILTER, ARIA } from '@/data/strings'
import { useAppStore, useDebounce } from '@/composables'
import { TextInput } from '@/components/text-input'
import { Select } from '@/components/select'
import type { SelectOption } from '@/components/select'
import { Checkbox } from '@/components/checkbox'
import { colors } from '@/styles/palette'
import { ComponentSize } from '@/enums'
import type { SightingFilter } from '@/types'

// ─── Source chip config (uses enum + palette — no anonymous strings) ─

const SOURCE_CHIPS: { id: DataSourceId; label: string; color: string }[] = [
  { id: DataSourceId.NUFORC,     label: DataSourceId.NUFORC,     color: colors.sourceNuforc },
  { id: DataSourceId.HATCH_UDB,  label: DataSourceId.HATCH_UDB,  color: colors.sourceHatch },
  { id: DataSourceId.CHRONOLOGY, label: DataSourceId.CHRONOLOGY,  color: colors.sourceChronology }
]

// ─── Option builders ────────────────────────────────────────────────

function shapeOptions (): SelectOption[] {
  return [
    { value: '', label: FILTER.ALL_SHAPES },
    ...Object.values(SightingShape).map(s => ({ value: s, label: s.toUpperCase() }))
  ]
}

function continentOptions (): SelectOption[] {
  return [
    { value: '', label: FILTER.ALL_REGIONS },
    ...Object.entries(CONTINENT_LABELS).map(([value, label]) => ({ value, label }))
  ]
}

// ─── Component ──────────────────────────────────────────────────────

export interface FilterToolbarProps {
  inputSize?: ComponentSize
  selectSize?: ComponentSize
}

export class FilterToolbar extends Component<FilterToolbarProps> {
  private currentFilter!: SightingFilter
  private searchInput!: TextInput
  private shapeSelect!: Select
  private continentSelect!: Select
  private countrySelect!: Select
  private emitDebounced!: ReturnType<typeof useDebounce>

  protected create (): HTMLElement {
    this.currentFilter = {}
    const store = useAppStore()
    const inputSize = this.props.inputSize ?? ComponentSize.MD
    const selectSize = this.props.selectSize ?? ComponentSize.MD

    const emit = (): void => {
      store.filter.set({ ...this.currentFilter })
    }

    this.emitDebounced = useDebounce(emit, 300)

    // ── Search ──────────────────────────────────────────────────
    this.searchInput = new TextInput({
      id: 'filter-search',
      name: 'filter-search',
      placeholder: FILTER.SEARCH_PLACEHOLDER,
      ariaLabel: ARIA.SEARCH,
      autofocus: true,
      size: inputSize,
      clearable: true,
      onInput: (val) => {
        this.currentFilter.search = val || undefined
        if (!val) {
          this.emitDebounced.flush()
          store.filter.set({ ...this.currentFilter })
        } else {
          this.emitDebounced()
        }
      },
      onClear: () => {
        this.currentFilter.search = undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    })

    // ── Shape ────────────────────────────────────────────────────
    this.shapeSelect = new Select({
      id: 'filter-shape',
      name: 'filter-shape',
      ariaLabel: ARIA.FILTER_SHAPE,
      options: shapeOptions(),
      size: selectSize,
      onChange: (val) => {
        this.currentFilter.shape = val ? (val as SightingShape) : undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    })

    // ── Continent ────────────────────────────────────────────────
    this.continentSelect = new Select({
      id: 'filter-region',
      name: 'filter-region',
      ariaLabel: ARIA.FILTER_REGION,
      options: continentOptions(),
      size: selectSize,
      onChange: (val) => {
        this.currentFilter.continent = val ? (val as Continent) : undefined
        this.currentFilter.country = undefined
        this.countrySelect.value = ''
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    })

    // ── Country ──────────────────────────────────────────────────
    this.countrySelect = new Select({
      id: 'filter-country',
      name: 'filter-country',
      ariaLabel: ARIA.FILTER_COUNTRY,
      options: [{ value: '', label: FILTER.ALL_COUNTRIES }],
      size: selectSize,
      onChange: (val) => {
        this.currentFilter.country = val || undefined
        this.emitDebounced.flush()
        store.filter.set({ ...this.currentFilter })
      }
    })

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
      this.searchInput.el,
      h('div', { className: cx.selects },
        this.shapeSelect.el,
        this.continentSelect.el,
        this.countrySelect.el
      ),
      h('div', { className: cx.sources },
        ...sourceChips.map(cb => cb.el)
      )
    )
  }

  focusSearch (): void {
    this.searchInput.focus()
  }

  private updateCountryOptions (): void {
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

    const options: SelectOption[] = [
      { value: '', label: FILTER.ALL_COUNTRIES },
      ...sorted.map(([country, count]) => ({
        value: country,
        label: `${country} (${count})`
      }))
    ]

    this.countrySelect.setOptions(options)
  }
}
