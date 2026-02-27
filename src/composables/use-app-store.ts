/**
 * Application store — single source of truth for all app-level reactive state.
 *
 * Components read signals via `store.xxx.get()` and write via `store.xxx.set()`.
 * Orchestration code (app.ts) uses `.subscribe()` for imperative async flows
 * and `effect()` for simple DOM bindings.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  filter-toolbar ──► store.filter.set()                  │
 * │  year-selector  ──► store.yearRange.set()               │
 * │                                                         │
 * │  app.ts         ──  store.filter.subscribe() ──► render │
 * │                 ──  store.yearRange.subscribe() ──► fetch│
 * │                 ──  effect(() => DOM binding)            │
 * │                                                         │
 * │  sighting-grid  ◄── store.selectedContinent.get()       │
 * └─────────────────────────────────────────────────────────┘
 */

import type { Sighting, SightingFilter, DataSource } from '@/types'
import type { Continent } from '@/enums'
import { signal, computed } from './use-store'
import type { Signal, ReadonlySignal } from './use-store'

// ─── Store shape ────────────────────────────────────────────────────

export interface AppStore {
  // ── Writable signals ──────────────────────────────────────────
  /** Raw sightings for the current year range. */
  sightings: Signal<Sighting[]>
  /** Active filter state from the toolbar. */
  filter: Signal<SightingFilter>
  /** True while fetching year data. */
  loading: Signal<boolean>
  /** Currently selected year range. */
  yearRange: Signal<{ from: number; to: number }>
  /** Years available in the NUFORC manifest. */
  availableYears: Signal<number[]>
  /** Total record count across all years. */
  totalCount: Signal<number>
  /** Registered data sources. */
  sources: Signal<DataSource[]>
  /** Count of sightings currently displayed (after filtering). */
  shownCount: Signal<number>

  // ── Derived (readonly) ────────────────────────────────────────
  /** Currently selected continent from filter, or undefined for all. */
  selectedContinent: ReadonlySignal<Continent | undefined>
  /** True if any filter field is active. */
  hasActiveFilter: ReadonlySignal<boolean>
  /** Formatted "shown / total" display string. */
  displayCount: ReadonlySignal<string>
}

// ─── Singleton ──────────────────────────────────────────────────────

let instance: AppStore | null = null

export function useAppStore(): AppStore {
  if (instance) return instance

  const sightings = signal<Sighting[]>([])
  const filter = signal<SightingFilter>({})
  const loading = signal(false)
  const yearRange = signal({ from: 0, to: 0 })
  const availableYears = signal<number[]>([])
  const totalCount = signal(0)
  const sources = signal<DataSource[]>([])
  const shownCount = signal(0)

  const selectedContinent = computed<Continent | undefined>(
    () => filter.get().continent,
  )

  const hasActiveFilter = computed(() => {
    const f = filter.get()
    return !!(f.search || f.shape || f.continent || f.minCredibility)
  })

  const displayCount = computed(
    () => `${shownCount.get().toLocaleString()} / ${totalCount.get().toLocaleString()}`,
  )

  instance = {
    sightings,
    filter,
    loading,
    yearRange,
    availableYears,
    totalCount,
    sources,
    shownCount,
    selectedContinent,
    hasActiveFilter,
    displayCount,
  }

  return instance
}
