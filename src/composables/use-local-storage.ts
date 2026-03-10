/**
 * useLocalStorage — type-safe, JSON-serialized localStorage wrapper.
 *
 * Handles missing keys, corrupt JSON, and quota errors gracefully.
 * Returns null on any read failure — never throws.
 *
 * Usage:
 *   const storage = useLocalStorage<string[]>('bookmarks')
 *   storage.set(['abc', 'def'])
 *   storage.get()              // ['abc', 'def']
 *   storage.remove()
 */

export interface LocalStorageHandle<T> {
  get(): T | null
  set(value: T): boolean
  remove(): void
}

export function useLocalStorage<T> (key: string): LocalStorageHandle<T> {
  return {
    get (): T | null {
      try {
        const raw = localStorage.getItem(key)
        if (raw === null) return null
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },

    set (value: T): boolean {
      try {
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch {
        // Quota exceeded or private browsing
        return false
      }
    },

    remove (): void {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ignore — storage may be unavailable
      }
    }
  }
}
