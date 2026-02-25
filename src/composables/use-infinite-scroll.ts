// ─── Types ──────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 100

export interface InfiniteScrollState<T> {
  allItems: T[]
  visibleItems: T[]
  visibleCount: number
  hasMore: boolean
}

export interface InfiniteScrollActions<T> {
  setItems: (items: T[]) => void
  loadMore: () => void
  getState: () => InfiniteScrollState<T>
  observe: (sentinel: HTMLElement, scrollRoot: HTMLElement) => void
  destroy: () => void
}

// ─── Composable ─────────────────────────────────────────────────────

export function useInfiniteScroll<T>(
  pageSize: number = DEFAULT_PAGE_SIZE,
  onUpdate?: (state: InfiniteScrollState<T>) => void,
): InfiniteScrollActions<T> {
  let allItems: T[] = []
  let visibleCount = 0
  let observer: IntersectionObserver | null = null

  function getState(): InfiniteScrollState<T> {
    return {
      allItems,
      visibleItems: allItems.slice(0, visibleCount),
      visibleCount,
      hasMore: visibleCount < allItems.length,
    }
  }

  function setItems(items: T[]): void {
    allItems = items
    visibleCount = Math.min(pageSize, items.length)
    onUpdate?.(getState())
  }

  function loadMore(): void {
    if (visibleCount >= allItems.length) return
    visibleCount = Math.min(visibleCount + pageSize, allItems.length)
    onUpdate?.(getState())
  }

  function observe(sentinel: HTMLElement, scrollRoot: HTMLElement): void {
    destroy()
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < allItems.length) {
          loadMore()
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    )
    observer.observe(sentinel)
  }

  function destroy(): void {
    observer?.disconnect()
    observer = null
  }

  return { setItems, loadMore, getState, observe, destroy }
}
