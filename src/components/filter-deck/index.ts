import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  FilterDeck — sticky filter deck for the monitor view               *
 *                                                                     *
 *  Tier 1 (always visible): scope chips · region chips · search +     *
 *  filters action buttons · status sentence ("WATCHING · ... ").      *
 *  Tier 2 (refine) is owned by AdvancedFilters; this component only   *
 *  toggles its visibility via callbacks.                              *
 *                                                                     *
 *  Composes ChipSelect (single-select) for both scope and region.     *
 *  Writes to store.filter.recencyDays and store.filter.continent;     *
 *  syncs the status sentence reactively from store.shownCount and     *
 *  store.filter.                                                      *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, addClass, removeClass, setText, setStyles } from '@/core/dom'
import { Button } from '@/components/button'
import { ChipSelect } from '@/components/chip'
import type { ChipItem } from '@/components/chip'
import { ButtonSize, ButtonVariant, ButtonColor, ComponentSize, Continent } from '@/enums'
import { useAppStore, effect } from '@/composables'
import {
  ARIA,
  CONTINENT_LABELS,
  CONTINENT_SHORT_LABELS,
  FILTER_DECK,
  SCOPE
} from '@/data/strings'
import { iconClose, iconSearch, iconSliders } from '@/components/icons'
import type { Scope } from '@/types'
import { detectContinent } from '@/utils/locale'

// ─── Local config ────────────────────────────────────────────────────

const SCOPE_KEYS: Scope[] = [SCOPE.KEY_ALL, SCOPE.KEY_24H, SCOPE.KEY_7D, SCOPE.KEY_30D]

const SCOPE_LABEL: Record<Scope, string> = {
  [SCOPE.KEY_ALL]: SCOPE.LABEL_ALL,
  [SCOPE.KEY_24H]: SCOPE.LABEL_24H,
  [SCOPE.KEY_7D]:  SCOPE.LABEL_7D,
  [SCOPE.KEY_30D]: SCOPE.LABEL_30D
}

const SCOPE_SENTENCE: Record<Scope, string> = {
  [SCOPE.KEY_ALL]: SCOPE.SENTENCE_ALL,
  [SCOPE.KEY_24H]: SCOPE.SENTENCE_24H,
  [SCOPE.KEY_7D]:  SCOPE.SENTENCE_7D,
  [SCOPE.KEY_30D]: SCOPE.SENTENCE_30D
}

const SCOPE_DAYS: Record<Exclude<Scope, typeof SCOPE.KEY_ALL>, number> = {
  [SCOPE.KEY_24H]: 1,
  [SCOPE.KEY_7D]:  7,
  [SCOPE.KEY_30D]: 30
}

const CONTINENT_COLOR_VARS: Record<Continent, string> = {
  [Continent.AMERICAS]:         'var(--color-continent-americas)',
  [Continent.EUROPE]:           'var(--color-continent-europe)',
  [Continent.EURASIA]:          'var(--color-continent-eurasia)',
  [Continent.ASIA_MIDDLE_EAST]: 'var(--color-continent-asia-middleeast)',
  [Continent.ASIA_PACIFIC]:     'var(--color-continent-asia-pacific)',
  [Continent.OCEANIA]:          'var(--color-continent-oceania)',
  [Continent.AFRICA]:           'var(--color-continent-africa)'
}

// ─── Props ──────────────────────────────────────────────────────────

export interface FilterDeckProps {
  /** Open AdvancedFilters and focus its search input. */
  onSearchOpen: () => void
}

// ─── Component ──────────────────────────────────────────────────────

export class FilterDeck extends Component<FilterDeckProps> {
  // Assigned in create() — class field initialisers run AFTER super(),
  // which is too late: didMount() registers an effect that reads it
  // synchronously during dependency collection.
  private store!: ReturnType<typeof useAppStore>
  private scopeChips!: ChipSelect
  private regionChips!: ChipSelect
  private clearBtn!: Button

  // Status sentence parts (mutated reactively)
  private statusScopeEl!: HTMLElement
  private statusRegionEl!: HTMLElement
  private statusCountEl!: HTMLElement

  protected create (): HTMLElement {
    this.store = useAppStore()

    // ── Detect user's continent (no permission, no network) ──────
    // Only seed when the filter store has no continent yet — respects
    // URL-shared filters / WelcomeModal pre-sets, etc.
    const detected = detectContinent()
    const seedContinent = detected && !this.store.filter.get().continent
      ? detected
      : null

    if (seedContinent) {
      this.store.filter.set({
        ...this.store.filter.get(),
        continent: seedContinent
      })
    }

    const initialRegionKey: string = this.store.filter.get().continent
      ?? FILTER_DECK.REGION_ALL_KEY

    // ── Scope chips ───────────────────────────────────────────────
    const scopeItems: ChipItem[] = SCOPE_KEYS.map(k => ({
      key: k,
      label: SCOPE_LABEL[k]
    }))
    this.scopeChips = this.ownChild(new ChipSelect({
      items: scopeItems,
      activeKey: 'ALL',
      size: ComponentSize.MD,
      onChange: (key) => this.onScopeChange(key as Scope)
    }))

    // ── Region chips ──────────────────────────────────────────────
    const regionItems: ChipItem[] = [
      { key: FILTER_DECK.REGION_ALL_KEY, label: FILTER_DECK.REGION_ALL },
      ...Object.values(Continent).map<ChipItem>(c => ({
        key: c,
        label: CONTINENT_SHORT_LABELS[c],
        color: CONTINENT_COLOR_VARS[c]
      }))
    ]
    this.regionChips = this.ownChild(new ChipSelect({
      items: regionItems,
      activeKey: initialRegionKey,
      size: ComponentSize.MD,
      onChange: (key) => this.onRegionChange(key)
    }))

    // ── Action buttons (Search + Filters) ─────────────────────────
    const searchBtn = this.ownChild(new Button({
      label: FILTER_DECK.SEARCH,
      variant: ButtonVariant.OUTLINE,
      color: ButtonColor.NEUTRAL,
      size: ButtonSize.MD,
      round: true,
      icon: () => iconSearch(11),
      ariaLabel: ARIA.SEARCH,
      onClick: () => this.props.onSearchOpen()
    }))

    // ── Status sentence parts ─────────────────────────────────────
    this.statusScopeEl  = h('span', { className: cx.statusScope })
    this.statusRegionEl = h('span', { className: cx.statusRegion })
    this.statusCountEl  = h('span', { className: cx.statusCount })

    this.clearBtn = this.ownChild(new Button({
      label: FILTER_DECK.CLEAR,
      variant: ButtonVariant.GHOST,
      color: ButtonColor.NEUTRAL,
      size: ButtonSize.XS,
      icon: () => iconClose(10),
      onClick: () => this.clearAll()
    }))
    addClass(this.clearBtn.el, cx.clear, cx.clearHidden)

    // ── Compose: 2 chip rows + 1 status row ───────────────────────
    return h('div', {
      className: cx.root,
      role: 'region',
      'aria-label': ARIA.FILTER_DECK
    },
      // Row 1: SCOPE chips + actions
      h('div', { className: cx.rowChips },
        h('div', { className: cx.group },
          h('span', { className: cx.pulse, 'aria-hidden': 'true' }),
          h('span', { className: cx.groupLabel }, FILTER_DECK.SCOPE_LABEL),
          this.scopeChips.el
        ),
        h('div', { className: cx.spacer }),
        h('div', { className: cx.actions },
          searchBtn.el
        )
      ),
      // Row 2: REGION chips
      h('div', { className: cx.rowChips },
        h('div', { className: cx.group },
          h('span', { className: cx.groupLabel }, FILTER_DECK.REGION_LABEL),
          this.regionChips.el
        )
      ),
      // Row 3: status sentence + clear
      h('div', { className: cx.rowStatus },
        h('div', { className: cx.status },
          h('span', { className: cx.statusLabel }, FILTER_DECK.WATCHING),
          h('span', { className: cx.statusSep }, FILTER_DECK.STATUS_SEP),
          this.statusScopeEl,
          h('span', { className: cx.statusSep }, FILTER_DECK.STATUS_SEP),
          this.statusRegionEl,
          h('span', { className: cx.statusSep }, FILTER_DECK.STATUS_SEP),
          this.statusCountEl
        ),
        this.clearBtn.el
      )
    )
  }

  protected didMount (): void {
    this.own(effect(() => this.syncStatus()))
  }

  // ─── Public API ─────────────────────────────────────────────────

  /** Reflect AdvancedFilters open/closed state on the FILTERS button. */
  setFiltersOpen (open: boolean): void {
    // if (open) addClass(this.filtersBtn.el, cx.filtersOpen)
    // else removeClass(this.filtersBtn.el, cx.filtersOpen)
  }

  // ─── Internals ──────────────────────────────────────────────────

  private onScopeChange (key: Scope): void {
    const next = { ...this.store.filter.get() }
    if (key === SCOPE.KEY_ALL) {
      next.recencyDays = undefined
    } else {
      next.recencyDays = SCOPE_DAYS[key]
    }
    this.store.filter.set(next)
  }

  private onRegionChange (key: string): void {
    const next = { ...this.store.filter.get() }
    if (key === FILTER_DECK.REGION_ALL_KEY) {
      next.continent = undefined
    } else {
      next.continent = key as Continent
    }
    // Reset country when region changes (mirrors prior FilterToolbar behaviour).
    next.country = undefined
    this.store.filter.set(next)
  }

  private clearAll (): void {
    this.store.filter.set({})
    this.scopeChips.value = SCOPE.KEY_ALL
    this.regionChips.value = FILTER_DECK.REGION_ALL_KEY
  }

  private syncStatus (): void {
    const f = this.store.filter.get()
    const shown = this.store.shownCount.get()

    // Scope sentence
    const scopeKey = FilterDeck.scopeFromDays(f.recencyDays)
    setText(this.statusScopeEl, SCOPE_SENTENCE[scopeKey])

    // Region sentence + tinted color via custom property
    if (f.continent) {
      setText(this.statusRegionEl, CONTINENT_LABELS[f.continent])
      setStyles(this.statusRegionEl, {
        color: CONTINENT_COLOR_VARS[f.continent]
      })
    } else {
      setText(this.statusRegionEl, FILTER_DECK.GLOBAL)
      this.statusRegionEl.style.removeProperty('color')
    }

    // Count
    setText(this.statusCountEl, `${shown.toLocaleString()} ${FILTER_DECK.REPORTS}`)

    // Clear button visibility — only visible when something is filtered.
    const hasFilter = !!(
      f.recencyDays ||
      f.continent ||
      f.search ||
      f.shape ||
      f.country ||
      f.minCredibility ||
      f.sources
    )
    if (hasFilter) removeClass(this.clearBtn.el, cx.clearHidden)
    else addClass(this.clearBtn.el, cx.clearHidden)

    // Mirror "advanced active" visual state on the FILTERS button.
    // const advancedActive = !!(
    //   f.search || f.shape || f.country || f.minCredibility || f.sources
    // )
    // if (advancedActive) addClass(this.filtersBtn.el, cx.filtersActive)
    // else removeClass(this.filtersBtn.el, cx.filtersActive)
  }

  private static scopeFromDays (days: number | undefined): Scope {
    if (days == null) return SCOPE.KEY_ALL
    if (days <= 1) return SCOPE.KEY_24H
    if (days <= 7) return SCOPE.KEY_7D
    if (days <= 30) return SCOPE.KEY_30D
    return SCOPE.KEY_ALL
  }
}
