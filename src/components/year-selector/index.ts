import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setText } from '@/core/dom'
import { FILTER, ARIA } from '@/data/strings'
import { useAppStore, effect } from '@/composables'
import { Select } from '@/components/select'
import { MAX_YEAR_SPAN } from '@/data/config'
import { ComponentSize } from '@/enums'
import type { SelectOption } from '@/components/select'

export interface YearSelectorProps {
  selectSize?: ComponentSize
}

export class YearSelector extends Component<YearSelectorProps> {
  private fromSelect!: Select
  private toSelect!: Select
  private populated = false

  protected create (): HTMLElement {
    const store = useAppStore()
    const selectSize = this.props.selectSize ?? ComponentSize.SM

    this.fromSelect = new Select({
      id: 'year-from',
      name: 'year-from',
      ariaLabel: ARIA.YEAR_FROM,
      options: [],
      size: selectSize,
      color: 'primary',
      onChange: () => {
        if (!this.populated) return
        this.onFromChange(store)
      }
    })

    this.toSelect = new Select({
      id: 'year-to',
      name: 'year-to',
      ariaLabel: ARIA.YEAR_TO,
      options: [],
      size: selectSize,
      color: 'primary',
      onChange: () => {
        if (!this.populated) return
        this.onToChange(store)
      }
    })

    const countEl = h('span', { className: cx.count }, '')

    this.own(effect(() => {
      setText(countEl, store.displayCount.get())
    }))

    // Populate selects when availableYears arrives (or immediately if already set)
    this.own(effect(() => {
      const years = store.availableYears.get()
      if (years.length === 0) return
      this.populateSelects(years, store)
    }))

    // Sync selects when yearRange changes externally
    this.own(effect(() => {
      const { from, to } = store.yearRange.get()
      this.fromSelect.value = String(from)
      this.toSelect.value = String(to)
    }))

    return h('div', { className: cx.root },
      this.fromSelect.el,
      h('span', { className: cx.separator }, '~'),
      this.toSelect.el,
      countEl
    )
  }

  private populateSelects (years: number[], store: ReturnType<typeof useAppStore>): void {
    const { from, to } = store.yearRange.get()
    const oldest = years[years.length - 1]
    const newest = years[0]

    const options: SelectOption[] = years.map(y => ({
      value: String(y),
      label: String(y)
    }))

    this.fromSelect.setOptions(options)
    this.toSelect.setOptions(options)

    this.fromSelect.value = String(Math.max(oldest, from))
    this.toSelect.value = String(Math.min(newest, to))

    this.populated = true
  }

  private onFromChange (store: ReturnType<typeof useAppStore>): void {
    const years = store.availableYears.get()
    const newest = years[0]

    const from = Number(this.fromSelect.value)
    let to = Number(this.toSelect.value)

    if (from > to) to = this.nearestAfter(years, Math.min(from + MAX_YEAR_SPAN, newest))
    if (to - from > MAX_YEAR_SPAN) to = this.nearestAfter(years, from + MAX_YEAR_SPAN)

    this.toSelect.value = String(to)
    store.yearRange.set({ from, to })
  }

  private onToChange (store: ReturnType<typeof useAppStore>): void {
    const years = store.availableYears.get()
    const oldest = years[years.length - 1]

    let from = Number(this.fromSelect.value)
    const to = Number(this.toSelect.value)

    if (to < from) from = this.nearestBefore(years, Math.max(to - MAX_YEAR_SPAN, oldest))
    if (to - from > MAX_YEAR_SPAN) from = this.nearestBefore(years, to - MAX_YEAR_SPAN)

    this.fromSelect.value = String(from)
    store.yearRange.set({ from, to })
  }

  private nearestAfter (years: number[], target: number): number {
    for (let i = years.length - 1; i >= 0; i--) {
      if (years[i] >= target) return years[i]
    }
    return years[0]
  }

  private nearestBefore (years: number[], target: number): number {
    for (let i = 0; i < years.length; i++) {
      if (years[i] <= target) return years[i]
    }
    return years[years.length - 1]
  }
}
