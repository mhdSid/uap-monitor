import { h } from '@/utils/dom'

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
