/* ------------------------------------------------------------------ *
 *  UAP Monitor — Hash router                                         *
 *                                                                     *
 *  Minimal hash-based router for switching between app views.         *
 *  No dependencies, no framework, no history API.                     *
 *                                                                     *
 *  Routes:                                                            *
 *    #/              → Monitor (main view)                            *
 *    #/geomagnetic   → Geomagnetic correlation view                   *
 *    #/seismic       → Seismic correlation view                       *
 * ------------------------------------------------------------------ */

// ─── Types ──────────────────────────────────────────────────────────

export const RouteName = {
  MONITOR: 'monitor',
  GEOMAGNETIC: 'geomagnetic',
  SEISMIC: 'seismic'
} as const

export type RouteName = typeof RouteName[keyof typeof RouteName]

export type RouteChangeHandler = (route: RouteName) => void

// ─── Constants ──────────────────────────────────────────────────────

const HASH_MAP: Record<string, RouteName> = {
  '': RouteName.MONITOR,
  '/': RouteName.MONITOR,
  '/geomagnetic': RouteName.GEOMAGNETIC,
  '/seismic': RouteName.SEISMIC
} as const

const ROUTE_TO_HASH: Record<RouteName, string> = {
  [RouteName.MONITOR]: '#/',
  [RouteName.GEOMAGNETIC]: '#/geomagnetic',
  [RouteName.SEISMIC]: '#/seismic'
} as const

// ─── Router ─────────────────────────────────────────────────────────

export interface Router {
  /** Current active route */
  current: () => RouteName
  /** Navigate to a route */
  navigate: (route: RouteName) => void
  /** Register a route-change callback */
  onChange: (handler: RouteChangeHandler) => void
  /** Stop listening */
  destroy: () => void
}

function parseHash (): RouteName {
  const raw = window.location.hash.replace(/^#/, '')
  return HASH_MAP[raw] ?? RouteName.MONITOR
}

export function createRouter (): Router {
  let currentRoute = parseHash()
  const handlers: RouteChangeHandler[] = []

  function onHashChange (): void {
    const next = parseHash()
    if (next === currentRoute) return
    currentRoute = next
    for (const h of handlers) h(currentRoute)
  }

  window.addEventListener('hashchange', onHashChange)

  return {
    current: () => currentRoute,

    navigate (route: RouteName): void {
      if (route === currentRoute) return
      window.location.hash = ROUTE_TO_HASH[route]
      // hashchange fires async — apply immediately for snappy UX
      currentRoute = route
      for (const h of handlers) h(route)
    },

    onChange (handler: RouteChangeHandler): void {
      handlers.push(handler)
    },

    destroy (): void {
      window.removeEventListener('hashchange', onHashChange)
      handlers.length = 0
    }
  }
}
