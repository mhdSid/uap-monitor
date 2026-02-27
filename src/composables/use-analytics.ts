/* ------------------------------------------------------------------ *
 *  useAnalytics — deferred Google Tag Manager injection & events      *
 *                                                                     *
 *  GTM script is NOT injected on initial page load. Instead, it is   *
 *  loaded after the first user interaction (scroll, click, touch,     *
 *  keydown, mousemove) OR after a configurable timeout. This keeps    *
 *  the initial paint fast and avoids unnecessary network requests     *
 *  for users who bounce immediately.                                  *
 *                                                                     *
 *  Events are queued in dataLayer before GTM loads and flushed once   *
 *  the script is injected. All public methods are safe to call at     *
 *  any point in the app lifecycle.                                    *
 * ------------------------------------------------------------------ */

import type { Sighting } from '@/types'

// ─── Configuration ──────────────────────────────────────────────────

const GTM_ID = 'GTM-MX49W83H'
const DEFER_TIMEOUT_MS = 4_000

/** Interaction events that trigger GTM injection. */
const INTERACTION_EVENTS = [
  'scroll',
  'click',
  'touchstart',
  'keydown',
  'mousemove',
] as const

// ─── Types ──────────────────────────────────────────────────────────

interface DataLayerEvent {
  event: string
  [key: string]: unknown
}

interface SightingShallow {
  id: string
  source: string
  shape: string
  country: string
  continent: string
  credibility: number
  occurredAt: string
}

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[]
  }
}

// ─── Shallow sighting projection ────────────────────────────────────

function toShallow(s: Sighting): SightingShallow {
  return {
    id: s.id,
    source: s.source,
    shape: s.shape,
    country: s.country,
    continent: s.continent,
    credibility: s.credibility,
    occurredAt: s.occurredAt,
  }
}

// ─── Analytics class ────────────────────────────────────────────────

class Analytics {
  private injected = false
  private queue: DataLayerEvent[] = []
  private cleanups: Array<() => void> = []
  private timer: ReturnType<typeof setTimeout> | null = null

  // ─── Initialization ───────────────────────────────────────────

  /**
   * Start listening for user interaction to trigger GTM injection.
   * Safe to call multiple times — only the first call has effect.
   */
  init(): void {
    if (this.injected || this.cleanups.length > 0) return

    const inject = () => this.inject()

    // Bind interaction listeners (passive, once per event type)
    for (const event of INTERACTION_EVENTS) {
      const handler = () => inject()
      window.addEventListener(event, handler, { once: true, passive: true })
      this.cleanups.push(() => window.removeEventListener(event, handler))
    }

    // Timeout fallback — inject even without interaction
    this.timer = setTimeout(inject, DEFER_TIMEOUT_MS)
  }

  // ─── GTM injection ────────────────────────────────────────────

  private inject(): void {
    if (this.injected) return
    this.injected = true

    // Tear down listeners & timer
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }

    // Initialize dataLayer and flush queue
    window.dataLayer = window.dataLayer ?? []
    for (const event of this.queue) {
      window.dataLayer.push(event)
    }
    this.queue = []

    // GTM head snippet — standard bootstrap
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID
    document.head.appendChild(script)

    // GTM noscript fallback
    const noscript = document.createElement('noscript')
    const iframe = document.createElement('iframe')
    iframe.src = 'https://www.googletagmanager.com/ns.html?id=' + GTM_ID
    iframe.height = '0'
    iframe.width = '0'
    iframe.style.display = 'none'
    iframe.style.visibility = 'hidden'
    noscript.appendChild(iframe)
    document.body.insertBefore(noscript, document.body.firstChild)
  }

  // ─── DataLayer push ───────────────────────────────────────────

  private push(event: DataLayerEvent): void {
    if (this.injected && window.dataLayer) {
      window.dataLayer.push(event)
    } else {
      this.queue.push(event)
    }
  }

  // ─── Public event methods ─────────────────────────────────────

  /** Sent once on initial app load. */
  pageView(): void {
    this.push({ event: 'page_view' })
  }

  /** Sent when the welcome modal is dismissed. */
  welcomeModalClosed(): void {
    this.push({ event: 'welcome_modal_closed' })
  }

  /** Sent when a sighting detail modal opens. */
  sightingViewed(sighting: Sighting): void {
    this.push({
      event: 'sighting_viewed',
      sighting: toShallow(sighting),
    })
  }

  /** Sent when a sighting detail modal is closed. */
  sightingDismissed(sighting: Sighting): void {
    this.push({
      event: 'sighting_dismissed',
      sighting: toShallow(sighting),
    })
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let instance: Analytics | null = null

export function useAnalytics(): Analytics {
  if (!instance) {
    instance = new Analytics()
  }
  return instance
}
