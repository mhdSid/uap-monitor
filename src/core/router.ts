/* ------------------------------------------------------------------ *
 *  UAP Monitor — History router                                       *
 *                                                                     *
 *  Minimal pushState router for switching between app views.          *
 *  No dependencies, no framework, real URL paths.                     *
 *                                                                     *
 *  Routes:                                                            *
 *    /              → Monitor (main view)                             *
 *    /geomagnetic   → Geomagnetic correlation view                    *
 *    /seismic       → Seismic correlation view                        *
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

const PATH_MAP: Record<string, RouteName> = {
  '': RouteName.MONITOR,
  '/': RouteName.MONITOR,
  '/geomagnetic': RouteName.GEOMAGNETIC,
  '/seismic': RouteName.SEISMIC
} as const

const ROUTE_TO_PATH: Record<RouteName, string> = {
  [RouteName.MONITOR]: '/',
  [RouteName.GEOMAGNETIC]: '/geomagnetic',
  [RouteName.SEISMIC]: '/seismic'
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

function parsePath (): RouteName {
  const raw = window.location.pathname
  return PATH_MAP[raw] ?? RouteName.MONITOR
}

export function createRouter (): Router {
  let currentRoute = parsePath()
  const handlers: RouteChangeHandler[] = []

  function onPopState (): void {
    const next = parsePath()
    if (next === currentRoute) return
    currentRoute = next
    for (const h of handlers) h(currentRoute)
  }

  window.addEventListener('popstate', onPopState)

  return {
    current: () => currentRoute,

    navigate (route: RouteName): void {
      if (route === currentRoute) return
      window.history.pushState(null, '', ROUTE_TO_PATH[route])
      currentRoute = route
      for (const h of handlers) h(route)
    },

    onChange (handler: RouteChangeHandler): void {
      handlers.push(handler)
    },

    destroy (): void {
      window.removeEventListener('popstate', onPopState)
      handlers.length = 0
    }
  }
}
