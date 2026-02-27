/**
 * Timing composables — scheduling primitives for UI responsiveness.
 *
 *   useDebounce(fn, ms)   Wait until input settles, then fire once.
 *                         Use for: search input, form validation, resize end.
 *
 *   useThrottle(fn, ms)   Fire at most once per interval.
 *                         Use for: scroll handlers, rapid filter toggles, telemetry.
 *
 *   yieldThread()         Yield to the main thread for a single frame.
 *                         Use for: chunked rendering, long loops.
 *
 *   minDelay(fn, ms)      Ensure async work takes at least `ms` milliseconds.
 *                         Use for: loader UX — prevents flash-of-loading.
 */

// ─── useDebounce ────────────────────────────────────────────────────

export interface DebouncedFn<T extends (...args: unknown[]) => void> {
  /** Call the debounced function. Resets the timer on each call. */
  (...args: Parameters<T>): void
  /** Cancel any pending invocation. */
  cancel(): void
  /** Flush: execute immediately if a call is pending. */
  flush(): void
}

/**
 * Returns a debounced version of `fn` that delays invocation until
 * `ms` milliseconds have elapsed since the last call.
 *
 * @example
 * const search = useDebounce((q: string) => store.filter.set({ search: q }), 300)
 * input.addEventListener('input', () => search(input.value))
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestArgs: Parameters<T> | null = null

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    latestArgs = null
  }

  function flush(): void {
    if (timer !== null && latestArgs !== null) {
      clearTimeout(timer)
      timer = null
      const args = latestArgs
      latestArgs = null
      fn(...args)
    }
  }

  const debounced = ((...args: Parameters<T>) => {
    latestArgs = args
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const a = latestArgs!
      latestArgs = null
      fn(...a)
    }, ms)
  }) as DebouncedFn<T>

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}

// ─── useThrottle ────────────────────────────────────────────────────

export interface ThrottledFn<T extends (...args: unknown[]) => void> {
  /** Call the throttled function. */
  (...args: Parameters<T>): void
  /** Cancel any pending trailing invocation. */
  cancel(): void
}

/**
 * Returns a throttled version of `fn` that fires at most once per `ms`
 * milliseconds. Leading call fires immediately; trailing call fires
 * after the interval if there were calls during cooldown.
 *
 * @example
 * const onScroll = useThrottle(() => updatePosition(), 100)
 * window.addEventListener('scroll', onScroll, { passive: true })
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): ThrottledFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRun = 0
  let trailingArgs: Parameters<T> | null = null

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    trailingArgs = null
  }

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now()
    const elapsed = now - lastRun

    if (elapsed >= ms) {
      // Leading: fire immediately
      lastRun = now
      fn(...args)
    } else {
      // Cooldown: queue trailing call
      trailingArgs = args
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null
          lastRun = Date.now()
          if (trailingArgs !== null) {
            const a = trailingArgs
            trailingArgs = null
            fn(...a)
          }
        }, ms - elapsed)
      }
    }
  }) as ThrottledFn<T>

  throttled.cancel = cancel

  return throttled
}

// ─── yieldThread ────────────────────────────────────────────────────

/**
 * Yield to the main thread so the browser can paint and handle events.
 * Use between chunks of synchronous work to prevent UI freezing.
 */
export function yieldThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ─── minDelay ───────────────────────────────────────────────────────

/**
 * Ensure an async operation takes at least `ms` milliseconds.
 * Runs `fn` and a timer in parallel — resolves with fn's result
 * after both complete. Prevents flash-of-loading on fast operations.
 *
 * @example
 * showLoader()
 * const data = await minDelay(() => fetchData(), 800)
 * hideLoader()  // guaranteed ≥800ms of loader visibility
 */
export async function minDelay<T>(fn: () => Promise<T>, ms = 250): Promise<T> {
  const [result] = await Promise.all([
    fn(),
    new Promise<void>((r) => setTimeout(r, ms)),
  ])
  return result
}
