/**
 * Reactive primitives — signal / computed / effect / batch.
 *
 * Core invariant: listeners are SNAPSHOT before notification.
 * This prevents Set-mutation-during-iteration — the root cause of
 * infinite recompute loops when computeds re-subscribe to deps
 * inside a notification cycle.
 *
 *   signal(v)      Mutable reactive value.
 *   computed(fn)   Derived value. Recomputes synchronously when deps change.
 *                  Only propagates if the output actually changed.
 *   effect(fn)     Side-effect. Re-runs on dep change via microtask coalescing.
 *   batch(fn)      Groups writes — listeners fire once at the end.
 */

type Listener = () => void

// ─── Dependency auto-tracking ───────────────────────────────────────

/** Internal subscribe — raw listener, no value wrapper. */
interface Trackable {
  _sub(fn: Listener): () => void
}

const trackStack: Set<Trackable>[] = []

function track(t: Trackable): void {
  const frame = trackStack[trackStack.length - 1]
  if (frame) frame.add(t)
}

function collectDeps(fn: () => void): Set<Trackable> {
  const deps = new Set<Trackable>()
  trackStack.push(deps)
  try { fn() } finally { trackStack.pop() }
  return deps
}

function subAll(deps: Set<Trackable>, cb: Listener): () => void {
  const unsubs: (() => void)[] = []
  for (const d of deps) unsubs.push(d._sub(cb))
  return () => { for (const u of unsubs) u() }
}

// ─── Notification (snapshot-safe) ───────────────────────────────────

let batchDepth = 0
const batchQueue: Listener[] = []

/** Snapshot listeners, then schedule or call them. */
function emit(listeners: Set<Listener>): void {
  if (listeners.size === 0) return
  const snap = [...listeners]
  if (batchDepth > 0) {
    batchQueue.push(...snap)
  } else {
    for (const fn of snap) fn()
  }
}

// ─── Batch ──────────────────────────────────────────────────────────

export function batch(fn: () => void): void {
  batchDepth++
  try { fn() } finally {
    if (--batchDepth === 0) {
      while (batchQueue.length > 0) {
        const queued = batchQueue.splice(0)
        for (const fn of queued) fn()
      }
    }
  }
}

// ─── Signal ─────────────────────────────────────────────────────────

export interface ReadonlySignal<T> {
  get(): T
  subscribe(fn: (value: T) => void): () => void
  /** @internal */ _sub(fn: Listener): () => void
}

export interface Signal<T> extends ReadonlySignal<T> {
  set(value: T): void
  update(fn: (prev: T) => T): void
}

export function signal<T>(initial: T): Signal<T> {
  let val = initial
  const subs = new Set<Listener>()

  const self: Signal<T> = {
    get()              { track(self); return val },
    set(v: T)          { if (!Object.is(v, val)) { val = v; emit(subs) } },
    update(fn)         { self.set(fn(val)) },
    subscribe(fn)      { const w = () => fn(val);  subs.add(w); return () => { subs.delete(w) } },
    _sub(fn: Listener) { subs.add(fn); return () => { subs.delete(fn) } }
  }
  return self
}

// ─── Computed ───────────────────────────────────────────────────────

export function computed<T>(fn: () => T): ReadonlySignal<T> {
  let value: T
  let teardown: (() => void) | null = null
  let ready = false                     // skip first emit (no subscribers yet)
  const subs = new Set<Listener>()

  function recompute(): void {
    if (teardown) { teardown(); teardown = null }

    let next: T
    const deps = collectDeps(() => { next = fn() })

    // Subscribe to deps — recompute when any dep changes
    teardown = subAll(deps, recompute)

    if (!Object.is(next!, value)) {
      value = next!
      if (ready) emit(subs)             // propagate only after init
    }
  }

  recompute()
  ready = true

  const self: ReadonlySignal<T> = {
    get()              { track(self); return value },
    subscribe(fn)      { const w = () => fn(value); subs.add(w); return () => { subs.delete(w) } },
    _sub(fn: Listener) { subs.add(fn); return () => { subs.delete(fn) } }
  }
  return self
}

// ─── Effect ─────────────────────────────────────────────────────────

/**
 * Side-effect that re-runs when any signal/computed it reads changes.
 * Coalesces via microtask — multiple dep changes in one tick = one re-run.
 * May return a cleanup function (called before re-run and on dispose).
 */
export function effect(fn: () => void | (() => void)): () => void {
  let teardown: (() => void) | null = null
  let cleanup: (() => void) | void
  let disposed = false
  let queued = false

  function run(): void {
    if (disposed) return
    queued = false

    if (teardown) { teardown(); teardown = null }
    if (cleanup) { cleanup(); cleanup = undefined }

    const deps = collectDeps(() => { cleanup = fn() })

    teardown = subAll(deps, () => {
      if (!queued && !disposed) {
        queued = true
        queueMicrotask(run)
      }
    })
  }

  run() // synchronous first run

  return () => {
    disposed = true
    if (teardown) { teardown(); teardown = null }
    if (cleanup) { cleanup(); cleanup = undefined }
  }
}
