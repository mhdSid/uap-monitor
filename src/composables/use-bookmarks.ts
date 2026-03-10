/**
 * useBookmarks — reactive sighting bookmark manager.
 *
 * Persists a Set<string> of sighting IDs to localStorage.
 * Exposes a signal-based API so UI components update automatically.
 *
 * Usage:
 *   const bm = useBookmarks()
 *   bm.toggle('abc123')        // add or remove
 *   bm.has('abc123')           // boolean
 *   bm.count.get()             // reactive count
 *   bm.ids.get()               // reactive Set<string>
 */

import { signal } from './use-store'
import { useLocalStorage } from './use-local-storage'
import type { Signal } from './use-store'

const STORAGE_KEY = 'uap-bookmarks'

export interface Bookmarks {
  /** Toggle a sighting ID — adds if absent, removes if present. Returns new state. */
  toggle(id: string): boolean
  /** Check if a sighting is bookmarked. */
  has(id: string): boolean
  /** Add a sighting to bookmarks. */
  add(id: string): void
  /** Remove a sighting from bookmarks. */
  remove(id: string): void
  /** Clear all bookmarks. */
  clear(): void
  /** Reactive count of bookmarked sightings. */
  count: Signal<number>
  /** Reactive Set of bookmarked IDs. */
  ids: Signal<Set<string>>
}

// ─── Singleton ──────────────────────────────────────────────────────

let instance: Bookmarks | null = null

export function useBookmarks (): Bookmarks {
  if (instance) return instance

  const storage = useLocalStorage<string[]>(STORAGE_KEY)

  // Hydrate from localStorage
  const initial = new Set<string>(storage.get() ?? [])
  const ids = signal(initial)
  const count = signal(initial.size)

  function persist (): void {
    const current = ids.get()
    count.set(current.size)
    storage.set([...current])
  }

  function add (id: string): void {
    const current = ids.get()
    if (current.has(id)) return
    const next = new Set(current)
    next.add(id)
    ids.set(next)
    persist()
  }

  function remove (id: string): void {
    const current = ids.get()
    if (!current.has(id)) return
    const next = new Set(current)
    next.delete(id)
    ids.set(next)
    persist()
  }

  function toggle (id: string): boolean {
    const current = ids.get()
    if (current.has(id)) {
      remove(id)
      return false
    } else {
      add(id)
      return true
    }
  }

  function has (id: string): boolean {
    return ids.get().has(id)
  }

  function clear (): void {
    ids.set(new Set())
    persist()
  }

  instance = { toggle, has, add, remove, clear, count, ids }
  return instance
}
