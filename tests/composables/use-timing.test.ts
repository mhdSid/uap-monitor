import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce, useThrottle, yieldThread, minDelay } from '../../src/composables/use-timing'

// ─── useDebounce ────────────────────────────────────────────────────

describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires once after the delay with the latest args', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)
    debounced('a')
    debounced('b')
    debounced('c')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('resets the timer on each call', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)
    debounced('a')
    vi.advanceTimersByTime(50)
    debounced('b')
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled() // reset, still waiting
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('cancel prevents the pending invocation', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)
    debounced('x')
    debounced.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('flush executes immediately if a call is pending', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)
    debounced('x')
    debounced.flush()
    expect(fn).toHaveBeenCalledWith('x')
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledOnce() // does not double-fire
  })

  it('flush is a no-op when nothing is pending', () => {
    const fn = vi.fn()
    const debounced = useDebounce(fn, 100)
    debounced.flush()
    expect(fn).not.toHaveBeenCalled()
  })
})

// ─── useThrottle ────────────────────────────────────────────────────

describe('useThrottle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires the leading call immediately', () => {
    const fn = vi.fn()
    const throttled = useThrottle(fn, 100)
    throttled('a')
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('queues a single trailing call when invoked during cooldown', () => {
    const fn = vi.fn()
    const throttled = useThrottle(fn, 100)
    throttled('a')
    throttled('b')
    throttled('c')
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('c')
  })

  it('cancel prevents the trailing call', () => {
    const fn = vi.fn()
    const throttled = useThrottle(fn, 100)
    throttled('a')
    throttled('b')
    throttled.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('allows a new leading call after the interval has fully elapsed', () => {
    const fn = vi.fn()
    const throttled = useThrottle(fn, 100)
    throttled('a')
    vi.advanceTimersByTime(150)
    throttled('b')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('b')
  })
})

// ─── yieldThread ────────────────────────────────────────────────────

describe('yieldThread', () => {
  it('resolves on the next macrotask', async () => {
    const order: string[] = []
    const p = yieldThread().then(() => { order.push('after') })
    order.push('before')
    await p
    expect(order).toEqual(['before', 'after'])
  })
})

// ─── minDelay ───────────────────────────────────────────────────────

describe('minDelay', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('waits for the minimum duration before resolving', async () => {
    const fn = vi.fn(async () => 42)
    let resolved = false
    const promise = minDelay(fn, 500).then((v) => { resolved = true; return v })

    await vi.advanceTimersByTimeAsync(499)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toBe(42)
  })

  it('returns the fn result', async () => {
    const promise = minDelay(async () => 'fast', 200)
    await vi.advanceTimersByTimeAsync(200)
    expect(await promise).toBe('fast')
  })

  it('uses the default delay (800ms) when ms is omitted', async () => {
    const promise = minDelay(async () => 'ok')
    let resolved = false
    promise.then(() => { resolved = true })

    await vi.advanceTimersByTimeAsync(799)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toBe('ok')
  })
})
