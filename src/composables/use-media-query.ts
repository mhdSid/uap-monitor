const SP_BREAKPOINT = '(max-width: 480px)'

export function useMediaQuery() {
  const mql = window.matchMedia(SP_BREAKPOINT)
  const listeners = new Set<(isSp: boolean) => void>()

  mql.addEventListener('change', (e) => {
    for (const fn of listeners) fn(e.matches)
  })

  const isSp = (): boolean => mql.matches
  const isPc = (): boolean => !mql.matches

  function onChange(fn: (isSp: boolean) => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { isSp, isPc, onChange }
}
