/* ------------------------------------------------------------------ *
 *  useRouter — composable router with view lifecycle management        *
 *                                                                     *
 *  Owns: pushState routing, SEO meta, view create/mount/destroy.      *
 *  Views are lazily created on first visit and destroyed on leave.     *
 *                                                                     *
 *  Usage:                                                             *
 *    const router = useRouter({                                       *
 *      base: 'https://example.com',                                   *
 *      container,                                                     *
 *      routes: {                                                      *
 *        home:  { path: '/', title: '...', ... factory: () => ... },  *
 *        about: { path: '/about', ... factory: () => ... }            *
 *      },                                                             *
 *      fallback: 'home',                                              *
 *      onBeforeSwitch: (from, to) => { ... }                          *
 *    })                                                               *
 * ------------------------------------------------------------------ */

import { clearChildren, show } from './dom'
import { Loader } from '@/components/loader'

// ─── Types ──────────────────────────────────────────────────────────

/** Any component with a load() lifecycle and destroy() cleanup. */
export interface Loadable {
  el: HTMLElement
  load: () => Promise<void> | void
  destroy: () => void
}

export interface RouteDef<K extends string> {
  /** URL path for this route (e.g. '/', '/geomagnetic'). */
  path: string
  /** Document title when this route is active. */
  title: string
  /** Meta description for SEO. */
  description: string
  /** Factory — creates the view component. Called once per visit. */
  factory: () => Loadable
  /** If true, the container gets 'router-viewport-lock' class. */
  viewportLock?: boolean
  /** Called after the view is mounted and loaded. */
  onEnter?: (route: K) => void
  /** Called before the view is destroyed on leave. */
  onLeave?: (route: K) => void
}

export interface RouterConfig<K extends string> {
  /** Base URL for canonical/OG tags. */
  base: string
  /** Container element where views are mounted. */
  container: HTMLElement
  /** Route definitions keyed by route name. */
  routes: Record<K, RouteDef<K>>
  /** Default route when path doesn't match. */
  fallback: K
  /** Called before every route switch with previous and next route. */
  onBeforeSwitch?: (from: K | null, to: K) => void
  /** Called after every route switch. */
  onAfterSwitch?: (route: K) => void
}

export interface RouterInstance<K extends string> {
  /** Current active route name. */
  current: () => K
  /** Navigate to a route. */
  navigate: (route: K) => void
  /** Get the active view component (if any). */
  activeView: () => Loadable | null
  /** Destroy the router and active view. */
  destroy: () => void
}

export const RouteName = {
  MONITOR: 'monitor',
  GEOMAGNETIC: 'geomagnetic',
  SEISMIC: 'seismic',
  INTEL: 'intel'
} as const

export type RouteName = typeof RouteName[keyof typeof RouteName]

// ─── SEO Meta ───────────────────────────────────────────────────────

function applyMeta<K extends string> (
  base: string,
  route: RouteDef<K>
): void {
  document.title = route.title

  const selectors: [string, string, string][] = [
    ['meta[name="description"]', 'content', route.description],
    ['meta[property="og:title"]', 'content', route.title],
    ['meta[property="og:description"]', 'content', route.description],
    ['meta[property="og:url"]', 'content', base + route.path],
    ['link[rel="canonical"]', 'href', base + route.path]
  ]

  for (const [sel, attr, val] of selectors) {
    const el = document.querySelector(sel)
    if (el) el.setAttribute(attr, val)
  }
}

// ─── Path resolution ────────────────────────────────────────────────

function buildPathMap<K extends string> (
  routes: Record<K, RouteDef<K>>
): Map<string, K> {
  const map = new Map<string, K>()
  for (const [name, def] of Object.entries<RouteDef<K>>(routes)) {
    map.set((def as RouteDef<K>).path, name as K)
  }
  return map
}

function resolveRoute<K extends string> (
  pathMap: Map<string, K>,
  fallback: K
): K {
  const raw = window.location.pathname
  return pathMap.get(raw) ?? pathMap.get(raw + '/') ?? fallback
}

// ─── Composable ─────────────────────────────────────────────────────

export function createRouter<K extends string> (
  config: RouterConfig<K>
): RouterInstance<K> {
  const { base, container, routes, fallback } = config
  const pathMap = buildPathMap(routes)

  let currentRoute: K = resolveRoute(pathMap, fallback)
  let activeView: Loadable | null = null
  let destroyed = false

  // Initial loader placeholder
  const loaderEl = document.createElement('div')
  loaderEl.className = 'router-loader'
  loaderEl.appendChild(new Loader({}).el)

  // ── Apply meta for initial route ──
  applyMeta(base, routes[currentRoute])

  // ── View lifecycle ──

  function teardownActive (): void {
    if (!activeView) return
    const def = routes[currentRoute]
    def.onLeave?.(currentRoute)
    activeView.destroy()
    activeView = null
  }

  async function mountRoute (route: K): Promise<void> {
    const def = routes[route]

    // Show loader
    clearChildren(container)
    container.appendChild(loaderEl)
    show(container)

    // Create + mount
    const view = def.factory()
    activeView = view

    clearChildren(container)
    container.appendChild(view.el)

    // Load (async — data fetching, rendering)
    await view.load()

    def.onEnter?.(route)
  }

  async function switchTo (route: K): Promise<void> {
    if (destroyed) return

    const prev = activeView ? currentRoute : null
    config.onBeforeSwitch?.(prev, route)

    // Teardown previous view
    teardownActive()

    // Viewport lock
    if (routes[currentRoute]?.viewportLock) {
      container.parentElement?.classList.remove('app--viewport-lock')
    }

    currentRoute = route
    applyMeta(base, routes[route])

    if (routes[route].viewportLock) {
      container.parentElement?.classList.add('app--viewport-lock')
    }

    // Mount new view
    await mountRoute(route)

    config.onAfterSwitch?.(route)
  }

  // ── Popstate ──

  function onPopState (): void {
    const next = resolveRoute(pathMap, fallback)
    if (next === currentRoute) return
    switchTo(next)
  }

  window.addEventListener('popstate', onPopState)

  // ── Public API ──

  return {
    current: () => currentRoute,

    navigate (route: K): void {
      if (route === currentRoute) return
      const def = routes[route]
      window.history.pushState(null, '', def.path)
      switchTo(route)
    },

    activeView: () => activeView,

    destroy (): void {
      if (destroyed) return
      destroyed = true
      window.removeEventListener('popstate', onPopState)
      teardownActive()
    }
  }
}
