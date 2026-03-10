/**
 * useMediaQuery — reactive media query listener
 *
 * Returns isSp/isPc getters and onChange subscriber.
 * Breakpoint matches CSS `@media (min-width: 768px)`.
 */

const SP_BREAKPOINT = '(max-width: 767px)'

let instance: ReturnType<typeof createMediaQuery> | null = null

function createMediaQuery () {
  const mql = window.matchMedia(SP_BREAKPOINT)
  const listeners = new Set<(isSp: boolean) => void>()

  mql.addEventListener('change', (e) => {
    for (const fn of listeners) fn(e.matches)
  })

  const isSp = (): boolean => mql.matches
  const isPc = (): boolean => !mql.matches

  function onChange (fn: (isSp: boolean) => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { isSp, isPc, onChange }
}

/** Singleton — safe to call from any component. */
export function useMediaQuery () {
  if (!instance) instance = createMediaQuery()
  return instance
}
