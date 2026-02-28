import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { FILTER, ARIA } from '@/data/strings'
import { useAppStore, effect } from '@/composables'

export class YearSelector extends Component {
  protected create(): HTMLElement {
    const store = useAppStore()
    const years = store.availableYears.get()
    const { from: defaultFrom, to: defaultTo } = store.yearRange.get()

    if (years.length === 0) {
      return h('div', { className: cx.root },
        h('span', { className: cx.label }, FILTER.NO_DATA),
      )
    }

    const makeSelect = (selected: number, label: string, id: string): HTMLSelectElement => {
      const sel = h('select', {
        className: cx.select,
        id,
        name: id,
        autocomplete: 'off',
        'aria-label': label,
      }) as HTMLSelectElement
      for (const y of years) {
        const opt = h('option', { value: String(y) }, String(y))
        if (y === selected) (opt as HTMLOptionElement).selected = true
        sel.appendChild(opt)
      }
      return sel
    }

    const fromSelect = makeSelect(
      Math.max(years[years.length - 1], defaultFrom), ARIA.YEAR_FROM, 'year-from',
    )
    const toSelect = makeSelect(
      Math.min(years[0], defaultTo), ARIA.YEAR_TO, 'year-to',
    )

    const countEl = h('span', { className: cx.count }, '')

    effect(() => {
      countEl.textContent = store.displayCount.get()
    })

    // Separate handlers: whichever select the user changes,
    // the OTHER adjusts to maintain from ≤ to
    fromSelect.addEventListener('change', () => {
      const from = Number(fromSelect.value)
      let to = Number(toSelect.value)
      if (from > to) {
        to = from
        toSelect.value = String(to)
      }
      store.yearRange.set({ from, to })
    })

    toSelect.addEventListener('change', () => {
      let from = Number(fromSelect.value)
      const to = Number(toSelect.value)
      if (to < from) {
        from = to
        fromSelect.value = String(from)
      }
      store.yearRange.set({ from, to })
    })

    return h('div', { className: cx.root },
      fromSelect,
      h('span', { className: cx.separator }, '~'),
      toSelect,
      countEl,
    )
  }
}
