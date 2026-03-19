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

import { qs, setAttrs } from "@/utils/dom"

// ─── Types ──────────────────────────────────────────────────────────

export const RouteName = {
  MONITOR: 'monitor',
  GEOMAGNETIC: 'geomagnetic',
  SEISMIC: 'seismic',
  INTEL: 'intel'
} as const

export type RouteName = typeof RouteName[keyof typeof RouteName]

export type RouteChangeHandler = (route: RouteName) => void

// ─── Constants ──────────────────────────────────────────────────────

const BASE_URL = 'https://uapmonitor.org'

const PATH_MAP: Record<string, RouteName> = {
  '': RouteName.MONITOR,
  '/': RouteName.MONITOR,
  '/geomagnetic': RouteName.GEOMAGNETIC,
  '/seismic': RouteName.SEISMIC,
  '/intel': RouteName.INTEL
} as const

const ROUTE_TO_PATH: Record<RouteName, string> = {
  [RouteName.MONITOR]: '/',
  [RouteName.GEOMAGNETIC]: '/geomagnetic',
  [RouteName.SEISMIC]: '/seismic',
  [RouteName.INTEL]: '/intel'
} as const

interface RouteMeta {
  title: string
  description: string
}

const ROUTE_META: Record<RouteName, RouteMeta> = {
  [RouteName.MONITOR]: {
    title: 'UAP Monitor — Global UFO & UAP Sightings Database, Map & Intelligence Platform',
    description: 'UAP Monitor aggregates 198,000+ UFO and UAP sighting reports from 15 verified sources spanning 70 AD to present. Interactive map, credibility scoring, and NASA fireball correlation.'
  },
  [RouteName.GEOMAGNETIC]: {
    title: 'UAP Geomagnetic Correlation — Kp Index & UFO Sighting Analysis | UAP Monitor',
    description: 'Explore the correlation between geomagnetic storm activity (Kp index) and UAP/UFO sightings. Timeline, distribution, and overrepresentation analysis from NOAA data.'
  },
  [RouteName.SEISMIC]: {
    title: 'UAP Seismic Correlation — Earthquake & UFO Sighting Analysis | UAP Monitor',
    description: 'Analyze proximity between earthquakes and UAP/UFO sightings. Scatter plots, magnitude analysis, and potential earthquake lights detection from USGS data.'
  },
  [RouteName.INTEL]: {
    title: 'UAP Intelligence Feed — Real-Time UFO News from GDELT, GNews, X & Reddit | UAP Monitor',
    description: 'Real-time UAP/UFO intelligence feed combining GDELT global media monitoring, GNews, X/Twitter posts, and Reddit community reports. Filter by source, search, and sentiment analysis.'
  }
}

/** Update document head to reflect the current route — title, description, canonical. */
function applyRouteMeta (route: RouteName): void {
  const meta = ROUTE_META[route]
  const path = ROUTE_TO_PATH[route]

  const title = meta.title
  const description = meta.description
  const fullPath = BASE_URL + path

  document.title = title

  setAttrs(qs('meta[name="description"]')!, { content: description })
  setAttrs(qs('meta[property="og:title"]')!, { content: title })
  setAttrs(qs('meta[property="og:description"]')!, { content: description })
  setAttrs(qs('meta[property="og:url"]')!, { content: fullPath })
  setAttrs(qs('link[rel="canonical"]')!, { href: fullPath })
}

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

  // Set meta for initial route (handles direct navigation to /geomagnetic etc.)
  applyRouteMeta(currentRoute)

  function onPopState (): void {
    const next = parsePath()
    if (next === currentRoute) return
    currentRoute = next
    applyRouteMeta(currentRoute)
    for (const h of handlers) h(currentRoute)
  }

  window.addEventListener('popstate', onPopState)

  return {
    current: () => currentRoute,

    navigate (route: RouteName): void {
      if (route === currentRoute) return
      window.history.pushState(null, '', ROUTE_TO_PATH[route])
      currentRoute = route
      applyRouteMeta(route)
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
