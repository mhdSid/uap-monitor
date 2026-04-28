import { describe, it, expect, vi } from 'vitest'
import { signal, computed, effect, batch } from '../../src/composables/use-store'

// ─── signal ─────────────────────────────────────────────────────────

describe('signal', () => {
  it('returns the initial value', () => {
    const s = signal(42)
    expect(s.get()).toBe(42)
  })

  it('set updates the value', () => {
    const s = signal(0)
    s.set(7)
    expect(s.get()).toBe(7)
  })

  it('update applies a transform to the previous value', () => {
    const s = signal(10)
    s.update(v => v + 5)
    expect(s.get()).toBe(15)
  })

  it('subscribe fires on change with the new value', () => {
    const s = signal('a')
    const fn = vi.fn()
    s.subscribe(fn)
    s.set('b')
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('does not fire when set to an Object.is-equal value', () => {
    const s = signal(1)
    const fn = vi.fn()
    s.subscribe(fn)
    s.set(1)
    expect(fn).not.toHaveBeenCalled()

    const obj = { x: 1 }
    const so = signal(obj)
    const fn2 = vi.fn()
    so.subscribe(fn2)
    so.set(obj)
    expect(fn2).not.toHaveBeenCalled()
  })

  it('treats NaN as equal (Object.is)', () => {
    const s = signal(NaN)
    const fn = vi.fn()
    s.subscribe(fn)
    s.set(NaN)
    expect(fn).not.toHaveBeenCalled()
  })

  it('unsubscribe stops further notifications', () => {
    const s = signal(0)
    const fn = vi.fn()
    const unsub = s.subscribe(fn)
    s.set(1)
    unsub()
    s.set(2)
    expect(fn).toHaveBeenCalledOnce()
  })

  // Regression: this is the snapshot-during-iteration invariant from the
  // module docstring. Subscribers added during emit must not fire in that emit.
  it('snapshots listeners before notification', () => {
    const s = signal(0)
    const lateFn = vi.fn()
    s.subscribe(() => {
      s.subscribe(lateFn)
    })
    s.set(1)
    expect(lateFn).not.toHaveBeenCalled()
    s.set(2)
    expect(lateFn).toHaveBeenCalledOnce()
  })
})

// ─── computed ───────────────────────────────────────────────────────

describe('computed', () => {
  it('derives synchronously from a signal', () => {
    const a = signal(2)
    const doubled = computed(() => a.get() * 2)
    expect(doubled.get()).toBe(4)
  })

  it('recomputes when a dep changes', () => {
    const a = signal(1)
    const c = computed(() => a.get() + 10)
    a.set(5)
    expect(c.get()).toBe(15)
  })

  it('does not propagate when result is Object.is-equal', () => {
    const a = signal(1)
    const c = computed(() => a.get() > 0)
    const fn = vi.fn()
    c.subscribe(fn)
    a.set(2)  // still > 0 — boolean stable
    expect(fn).not.toHaveBeenCalled()
    a.set(-1) // flips
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith(false)
  })

  it('chains: computed depending on computed', () => {
    const a = signal(1)
    const b = computed(() => a.get() * 2)
    const c = computed(() => b.get() + 1)
    expect(c.get()).toBe(3)
    a.set(10)
    expect(c.get()).toBe(21)
  })

  it('tracks dynamic deps — re-subscribes when branches switch', () => {
    const flag = signal(true)
    const a = signal('A')
    const b = signal('B')
    const c = computed(() => flag.get() ? a.get() : b.get())

    expect(c.get()).toBe('A')

    const fn = vi.fn()
    c.subscribe(fn)

    // While flag=true, b is NOT a dep — changes must not propagate
    b.set('B2')
    expect(fn).not.toHaveBeenCalled()

    // Flip flag — c flips from 'A' to 'B2'
    flag.set(false)
    expect(c.get()).toBe('B2')
    expect(fn).toHaveBeenLastCalledWith('B2')

    // Now a is no longer a dep
    fn.mockClear()
    a.set('A2')
    expect(fn).not.toHaveBeenCalled()
  })
})

// ─── effect ─────────────────────────────────────────────────────────

describe('effect', () => {
  it('runs synchronously on first call', () => {
    const fn = vi.fn()
    effect(fn)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('re-runs when a tracked signal changes', async () => {
    const a = signal(0)
    const fn = vi.fn(() => { a.get() })
    effect(fn)
    expect(fn).toHaveBeenCalledOnce()
    a.set(1)
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('coalesces multiple writes in the same tick into a single re-run', async () => {
    const a = signal(0)
    const fn = vi.fn(() => { a.get() })
    effect(fn)
    a.set(1)
    a.set(2)
    a.set(3)
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(2) // initial + one coalesced
  })

  it('cleanup runs before the next run and on dispose', async () => {
    const a = signal(0)
    const cleanup = vi.fn()
    const dispose = effect(() => {
      a.get()
      return cleanup
    })
    expect(cleanup).not.toHaveBeenCalled()

    a.set(1)
    await Promise.resolve()
    expect(cleanup).toHaveBeenCalledOnce()

    dispose()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('dispose stops further re-runs', async () => {
    const a = signal(0)
    const fn = vi.fn(() => { a.get() })
    const dispose = effect(fn)
    dispose()
    a.set(1)
    await Promise.resolve()
    expect(fn).toHaveBeenCalledOnce()
  })
})

// ─── batch ──────────────────────────────────────────────────────────

describe('batch', () => {
  it('coalesces multiple writes — listener fires once at end', () => {
    const a = signal(0)
    const fn = vi.fn()
    a.subscribe(fn)
    batch(() => {
      a.set(1)
      a.set(2)
      a.set(3)
    })
    expect(fn).toHaveBeenCalledOnce()
  })

  it('only flushes at outermost batch when nested', () => {
    const a = signal(0)
    const fn = vi.fn()
    a.subscribe(fn)
    batch(() => {
      a.set(1)
      batch(() => {
        a.set(2)
      })
      expect(fn).not.toHaveBeenCalled()
    })
    expect(fn).toHaveBeenCalled()
  })

  it('still flushes when the batch fn throws', () => {
    const a = signal(0)
    const fn = vi.fn()
    a.subscribe(fn)
    expect(() => batch(() => {
      a.set(1)
      throw new Error('boom')
    })).toThrow('boom')
    expect(fn).toHaveBeenCalledOnce()
  })
})
