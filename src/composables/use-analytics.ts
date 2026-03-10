/* ------------------------------------------------------------------ *
 *  useAnalytics — deferred Google Tag Manager injection & events      *
 *                                                                     *
 *  GTM is injected AFTER the page is fully loaded + a 2s delay.       *
 *  This keeps initial paint and interactivity fast. Events queued     *
 *  before injection are flushed once the script loads.                *
 * ------------------------------------------------------------------ */

import type { Sighting } from '@/types'
import { h, el, setStyles } from '@/utils/dom'
import { useDelayedLoad } from './use-delayed-load'

// ─── Configuration ──────────────────────────────────────────────────

const GTM_ID = import.meta.env.VITE_GTM_ID
const GTM_DELAY_MS = 2000

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

function toShallow (s: Sighting): SightingShallow {
  return {
    id: s.id,
    source: s.source,
    shape: s.shape,
    country: s.country,
    continent: s.continent,
    credibility: s.credibility,
    occurredAt: s.occurredAt
  }
}

// ─── Analytics class ────────────────────────────────────────────────

class Analytics {
  private injected = false
  private queue: DataLayerEvent[] = []

  // ─── Initialization ───────────────────────────────────────────

  init (): void {
    if (this.injected) return
    useDelayedLoad(() => this.inject(), { delayMs: GTM_DELAY_MS })
  }

  // ─── GTM injection ────────────────────────────────────────────

  private inject (): void {
    if (this.injected) return
    this.injected = true

    // Initialize dataLayer and flush queue
    window.dataLayer = window.dataLayer ?? []
    for (const event of this.queue) {
      window.dataLayer.push(event)
    }
    this.queue = []

    // GTM head snippet
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
    const script = el('script', { async: 'true', src: 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID })
    document.head.appendChild(script)

    // GTM noscript fallback
    const iframe = el('iframe', {
      src: 'https://www.googletagmanager.com/ns.html?id=' + GTM_ID,
      height: '0',
      width: '0'
    })
    setStyles(iframe, {
      display: 'none',
      visibility: 'hidden'
    })
    const noscript = h('noscript', null, iframe)
    document.body.insertBefore(noscript, document.body.firstChild)
  }

  // ─── DataLayer push ───────────────────────────────────────────

  private push (event: DataLayerEvent): void {
    if (this.injected && window.dataLayer) {
      window.dataLayer.push(event)
    } else {
      this.queue.push(event)
    }
  }

  // ─── Public event methods ─────────────────────────────────────

  pageView (): void {
    this.push({ event: 'page_view' })
  }

  welcomeModalClosed (): void {
    this.push({ event: 'welcome_modal_closed' })
  }

  sightingViewed (sighting: Sighting): void {
    this.push({
      event: 'sighting_viewed',
      sighting: toShallow(sighting)
    })
  }

  sightingDismissed (sighting: Sighting): void {
    this.push({
      event: 'sighting_dismissed',
      sighting: toShallow(sighting)
    })
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let instance: Analytics | null = null

export function useAnalytics (): Analytics {
  if (!instance) {
    instance = new Analytics()
  }
  return instance
}
