import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInfiniteScroll } from '../../src/composables/use-infinite-scroll'

// ─── IntersectionObserver mock ──────────────────────────────────────

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  callback: IntersectionObserverCallback

  constructor (callback: IntersectionObserverCallback) {
    this.callback = callback
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastObserver = this
  }

  trigger (isIntersecting: boolean): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }
}

let lastObserver: MockIntersectionObserver | null = null

const stubEl = (): HTMLElement => ({} as HTMLElement)

beforeEach(() => {
  lastObserver = null
  ;(globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver })
    .IntersectionObserver = MockIntersectionObserver
})

// ─── Tests ──────────────────────────────────────────────────────────

describe('useInfiniteScroll', () => {
  it('initializes visibleCount to min(pageSize, items.length) on setItems', () => {
    const scroll = useInfiniteScroll<number>(20)
    scroll.setItems(Array.from({ length: 50 }, (_, i) => i))
    expect(scroll.getState().visibleCount).toBe(20)
    expect(scroll.getState().hasMore).toBe(true)

    scroll.setItems([1, 2, 3])
    expect(scroll.getState().visibleCount).toBe(3)
    expect(scroll.getState().hasMore).toBe(false)
  })

  it('fires onUpdate with the new state on setItems', () => {
    const onUpdate = vi.fn()
    const scroll = useInfiniteScroll<number>(10, onUpdate)
    scroll.setItems([1, 2, 3])
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      visibleCount: 3,
      hasMore: false,
      visibleItems: [1, 2, 3]
    }))
  })

  it('loadMore advances by pageSize, capped at items.length', () => {
    const scroll = useInfiniteScroll<number>(10)
    scroll.setItems(Array.from({ length: 25 }, (_, i) => i))
    expect(scroll.getState().visibleCount).toBe(10)
    scroll.loadMore()
    expect(scroll.getState().visibleCount).toBe(20)
    scroll.loadMore()
    expect(scroll.getState().visibleCount).toBe(25)
    expect(scroll.getState().hasMore).toBe(false)
  })

  it('loadMore is a no-op once exhausted', () => {
    const onUpdate = vi.fn()
    const scroll = useInfiniteScroll<number>(10, onUpdate)
    scroll.setItems([1, 2, 3])
    onUpdate.mockClear()
    scroll.loadMore()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('expandTo is a no-op when index is already visible', () => {
    const onUpdate = vi.fn()
    const scroll = useInfiniteScroll<number>(20, onUpdate)
    scroll.setItems(Array.from({ length: 100 }, (_, i) => i))
    onUpdate.mockClear()
    scroll.expandTo(5)
    expect(onUpdate).not.toHaveBeenCalled()
    expect(scroll.getState().visibleCount).toBe(20)
  })

  it('expandTo extends to the requested index plus a pageSize buffer', () => {
    const scroll = useInfiniteScroll<number>(20)
    scroll.setItems(Array.from({ length: 200 }, (_, i) => i))
    scroll.expandTo(50)
    expect(scroll.getState().visibleCount).toBe(71)
  })

  it('expandTo caps at items.length', () => {
    const scroll = useInfiniteScroll<number>(20)
    scroll.setItems(Array.from({ length: 30 }, (_, i) => i))
    scroll.expandTo(25)
    expect(scroll.getState().visibleCount).toBe(30)
  })

  it('observe wires the IntersectionObserver to loadMore', () => {
    const scroll = useInfiniteScroll<number>(10)
    scroll.setItems(Array.from({ length: 50 }, (_, i) => i))

    const sentinel = stubEl()
    scroll.observe(sentinel, stubEl())

    expect(lastObserver).not.toBeNull()
    expect(lastObserver!.observe).toHaveBeenCalledWith(sentinel)

    lastObserver!.trigger(true)
    expect(scroll.getState().visibleCount).toBe(20)
  })

  it('does not loadMore on intersection once exhausted', () => {
    const scroll = useInfiniteScroll<number>(10)
    scroll.setItems([1, 2, 3])
    scroll.observe(stubEl(), stubEl())
    lastObserver!.trigger(true)
    expect(scroll.getState().visibleCount).toBe(3)
  })

  it('observing again disconnects the previous observer', () => {
    const scroll = useInfiniteScroll<number>(10)
    scroll.setItems([1, 2, 3])
    scroll.observe(stubEl(), stubEl())
    const first = lastObserver!
    scroll.observe(stubEl(), stubEl())
    expect(first.disconnect).toHaveBeenCalled()
  })

  it('destroy disconnects the observer', () => {
    const scroll = useInfiniteScroll<number>(10)
    scroll.setItems([1, 2, 3])
    scroll.observe(stubEl(), stubEl())
    const obs = lastObserver!
    scroll.destroy()
    expect(obs.disconnect).toHaveBeenCalled()
  })
})
