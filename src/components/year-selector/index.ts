import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { FILTER, ARIA } from '@/data/strings'
import { useAppStore, effect } from '@/composables'

export const MAX_YEAR_SPAN = 10

export class YearSelector extends Component {
  protected create(): HTMLElement {
    const store = useAppStore()
    const years = store.availableYears.get()
    const { from: defaultFrom, to: defaultTo } = store.yearRange.get()

    if (years.length === 0) {
      return h('div', { className: cx.root },
        h('span', { className: cx.label }, FILTER.NO_DATA)
      )
    }

    const oldest = years[years.length - 1]
    const newest = years[0]

    // Find nearest available year at or after target
    const nearestAfter = (target: number): number => {
      for (let i = years.length - 1; i >= 0; i--) {
        if (years[i] >= target) return years[i]
      }
      return newest
    }

    // Find nearest available year at or before target
    const nearestBefore = (target: number): number => {
      for (let i = 0; i < years.length; i++) {
        if (years[i] <= target) return years[i]
      }
      return oldest
    }

    const makeSelect = (selected: number, label: string, id: string): HTMLSelectElement => {
      const sel = h('select', {
        className: cx.select,
        id,
        name: id,
        autocomplete: 'off',
        'aria-label': label
      }) as HTMLSelectElement
      for (const y of years) {
        const opt = h('option', { value: String(y) }, String(y))
        if (y === selected) (opt as HTMLOptionElement).selected = true
        sel.appendChild(opt)
      }
      return sel
    }

    const fromSelect = makeSelect(
      Math.max(oldest, defaultFrom), ARIA.YEAR_FROM, 'year-from'
    )
    const toSelect = makeSelect(
      Math.min(newest, defaultTo), ARIA.YEAR_TO, 'year-to'
    )

    const countEl = h('span', { className: cx.count }, '')

    effect(() => {
      countEl.textContent = store.displayCount.get()
    })

    // User changes FROM → clamp TO to from + MAX_YEAR_SPAN
    fromSelect.addEventListener('change', () => {
      const from = Number(fromSelect.value)
      let to = Number(toSelect.value)

      if (from > to) to = from
      if (to - from > MAX_YEAR_SPAN) to = nearestAfter(from + MAX_YEAR_SPAN)

      toSelect.value = String(to)
      store.yearRange.set({ from, to })
    })

    // User changes TO → clamp FROM to to - MAX_YEAR_SPAN
    toSelect.addEventListener('change', () => {
      let from = Number(fromSelect.value)
      const to = Number(toSelect.value)

      if (to < from) from = to
      if (to - from > MAX_YEAR_SPAN) from = nearestBefore(to - MAX_YEAR_SPAN)

      fromSelect.value = String(from)
      store.yearRange.set({ from, to })
    })

    // Sync selects when yearRange changes externally
    effect(() => {
      const { from, to } = store.yearRange.get()
      fromSelect.value = String(from)
      toSelect.value = String(to)
    })

    return h('div', { className: cx.root },
      fromSelect,
      h('span', { className: cx.separator }, '~'),
      toSelect,
      countEl
    )
  }
}
