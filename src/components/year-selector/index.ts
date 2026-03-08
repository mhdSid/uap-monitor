import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { FILTER, ARIA } from '@/data/strings'
import { useAppStore, effect } from '@/composables'
import { Select } from '@/components/select'
import { MAX_YEAR_SPAN } from '@/data/config'
import type { SelectOption } from '@/components/select'

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

    const yearOptions: SelectOption[] = years.map(y => ({
      value: String(y),
      label: String(y)
    }))

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

    const fromSelect = new Select({
      id: 'year-from',
      name: 'year-from',
      ariaLabel: ARIA.YEAR_FROM,
      options: yearOptions,
      selected: String(Math.max(oldest, defaultFrom)),
      size: 'sm',
      color: 'primary',
      onChange: () => {
        const from = Number(fromSelect.value)
        let to = Number(toSelect.value)

        if (from > to) to = from
        if (to - from > MAX_YEAR_SPAN) to = nearestAfter(from + MAX_YEAR_SPAN)

        toSelect.value = String(to)
        store.yearRange.set({ from, to })
      }
    })

    const toSelect = new Select({
      id: 'year-to',
      name: 'year-to',
      ariaLabel: ARIA.YEAR_TO,
      options: yearOptions,
      selected: String(Math.min(newest, defaultTo)),
      size: 'sm',
      color: 'primary',
      onChange: () => {
        let from = Number(fromSelect.value)
        const to = Number(toSelect.value)

        if (to < from) from = to
        if (to - from > MAX_YEAR_SPAN) from = nearestBefore(to - MAX_YEAR_SPAN)

        fromSelect.value = String(from)
        store.yearRange.set({ from, to })
      }
    })

    const countEl = h('span', { className: cx.count }, '')

    effect(() => {
      countEl.textContent = store.displayCount.get()
    })

    // Sync selects when yearRange changes externally
    effect(() => {
      const { from, to } = store.yearRange.get()
      fromSelect.value = String(from)
      toSelect.value = String(to)
    })

    return h('div', { className: cx.root },
      fromSelect.el,
      h('span', { className: cx.separator }, '~'),
      toSelect.el,
      countEl
    )
  }
}
