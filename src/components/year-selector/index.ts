import { h } from '@/utils/dom'
import { FILTER, ARIA } from '@/data/strings'

export interface YearSelectorProps {
  availableYears: number[]
  defaultFrom: number
  defaultTo: number
  onRangeChange: (from: number, to: number) => void
}

export function renderYearSelector(props: YearSelectorProps): HTMLElement {
  const { availableYears, defaultFrom, defaultTo, onRangeChange } = props

  if (availableYears.length === 0) {
    return h('div', { className: 'year-selector' },
      h('span', { className: 'year-selector__label' }, FILTER.NO_DATA),
    )
  }

  function makeSelect(selected: number, label: string, id: string): HTMLSelectElement {
    const sel = h('select', {
      className: 'year-selector__select',
      id,
      name: id,
      autocomplete: 'off',
      'aria-label': label,
    }) as HTMLSelectElement
    for (const y of availableYears) {
      const opt = h('option', { value: String(y) }, String(y))
      if (y === selected) (opt as HTMLOptionElement).selected = true
      sel.appendChild(opt)
    }
    return sel
  }

  const fromSelect = makeSelect(Math.max(availableYears[availableYears.length - 1], defaultFrom), ARIA.YEAR_FROM, 'year-from')
  const toSelect = makeSelect(Math.min(availableYears[0], defaultTo), ARIA.YEAR_TO, 'year-to')

  const countEl = h('span', { className: 'year-selector__count' }, '')

  function fireChange(): void {
    const from = Number(fromSelect.value)
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
    fromSelect,
    h('span', { className: 'year-selector__separator' }, '~'),
    toSelect,
    countEl,
  )
}
