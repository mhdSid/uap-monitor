/**
 * useShare — sighting sharing via URL query param + clipboard/native share.
 *
 * URL format: ?s=<sightingId>&y=<year>
 *
 * The year param ensures the app can load the correct year range
 * when opening a shared link for a sighting outside the default window.
 *
 * Usage:
 *   const share = useShare()
 *   const params = share.parseShareParam()   // on init
 *   share.shareSighting(id, year, title)      // from modal/grid
 */

export interface ShareResult {
  success: boolean
  method: 'native' | 'clipboard' | 'none'
}

export interface ShareParam {
  id: string
  year: number | null
}

export interface Share {
  /** Extract sighting ID + year from current URL. Returns null if not present. */
  parseShareParam(): ShareParam | null
  /** Clear the ?s= and ?y= params from URL without reload. */
  clearShareParam(): void
  /** Build share URL and copy/share. Returns result with method used. */
  shareSighting(id: string, year?: number, title?: string): Promise<ShareResult>
  /** Build the full share URL for a sighting. */
  buildUrl(id: string, year?: number): string
}

// ─── Singleton ──────────────────────────────────────────────────────

let instance: Share | null = null

export function useShare (): Share {
  if (instance) return instance

  function parseShareParam (): ShareParam | null {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('s')
    if (!id) return null
    const yearStr = params.get('y')
    const year = yearStr ? parseInt(yearStr, 10) : null
    return { id, year: year && !isNaN(year) ? year : null }
  }

  function clearShareParam (): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('s')
    url.searchParams.delete('y')
    const clean = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
    window.history.replaceState(null, '', clean)
  }

  function buildUrl (id: string, year?: number): string {
    const url = new URL(window.location.href)
    url.searchParams.set('s', id)
    if (year) url.searchParams.set('y', String(year))
    url.hash = ''
    return url.toString()
  }

  async function shareSighting (id: string, year?: number, title?: string): Promise<ShareResult> {
    const url = buildUrl(id, year)
    const shareTitle = title || 'UAP Sighting Report'
    const shareText = `${shareTitle} — UAP Monitor`

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url })
        return { success: true, method: 'native' }
      } catch {
        // User cancelled or API failed — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url)
      return { success: true, method: 'clipboard' }
    } catch {
      // Clipboard API not available (e.g. non-HTTPS, permissions)
      return { success: false, method: 'none' }
    }
  }

  instance = { parseShareParam, clearShareParam, shareSighting, buildUrl }
  return instance
}
