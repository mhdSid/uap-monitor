import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  AdvancedFilters — collapsible Tier-2 filter panel                  *
 *                                                                     *
 *  Wraps the existing YearSelector + FilterToolbar inside a labelled  *
 *  disclosure region. Toggled open/closed by FilterDeck via setOpen().*
 *  Search button in FilterDeck calls focusSearch() to delegate focus  *
 *  to the wrapped FilterToolbar's search input.                       *
 *                                                                     *
 *  Expansion uses CSS grid-template-rows transition (auto-fits        *
 *  intrinsic content height; no fixed max-height).                    *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, addClass, removeClass } from '@/core/dom'
import { ComponentSize } from '@/enums'
import { YearSelector } from '@/components/year-selector'
import { FilterToolbar } from '@/components/filter-toolbar'
import { FILTER_DECK } from '@/data/strings'

// ─── Component ──────────────────────────────────────────────────────

export class AdvancedFilters extends Component {
  private filterToolbar!: FilterToolbar
  private yearSelector!: YearSelector
  private isOpen = false

  protected create (): HTMLElement {
    this.yearSelector = this.ownChild(new YearSelector({
      selectSize: ComponentSize.MD
    }))

    this.filterToolbar = this.ownChild(new FilterToolbar({
      inputSize: ComponentSize.MD,
      selectSize: ComponentSize.MD
    }))

    const yearGroup = h('div', { className: cx.group },
      h('span', { className: cx.groupLabel }, FILTER_DECK.ADVANCED_YEAR_LABEL),
      this.yearSelector.el
    )

    const refineGroup = h('div', { className: cx.group },
      h('span', { className: cx.groupLabel }, FILTER_DECK.ADVANCED_TITLE),
      this.filterToolbar.el
    )

    return h('div', {
      className: cx.root,
      role: 'region',
      'aria-hidden': 'true'
    },
      h('div', { className: cx.body },
        yearGroup,
        refineGroup
      )
    )
  }

  // ─── Public API ─────────────────────────────────────────────────

  /** Toggle disclosure state. Returns the new open state. */
  toggle (): boolean {
    this.setOpen(!this.isOpen)
    return this.isOpen
  }

  setOpen (open: boolean): void {
    this.isOpen = open
    if (open) {
      addClass(this.el, cx.open)
      this.el.setAttribute('aria-hidden', 'false')
    } else {
      removeClass(this.el, cx.open)
      this.el.setAttribute('aria-hidden', 'true')
    }
  }

  get open (): boolean {
    return this.isOpen
  }

  /** Open the panel and focus the search input inside FilterToolbar. */
  focusSearch (): void {
    this.setOpen(true)
    // Wait one frame for the disclosure transition to start before focusing.
    requestAnimationFrame(() => this.filterToolbar.focusSearch())
  }
}
