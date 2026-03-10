/**
 * useShare — sighting sharing via URL query param + clipboard/native share.
 *
 * URL format: ?s=<sightingId>
 *
 * On page load, parseShareParam() extracts the sighting ID from the URL.
 * shareSighting() builds the URL and copies to clipboard (or uses
 * navigator.share on mobile).
 *
 * Usage:
 *   const share = useShare()
 *   const id = share.parseShareParam()     // on init
 *   share.shareSighting(id, title)          // from modal/grid
 */

export interface ShareResult {
  success: boolean
  method: 'native' | 'clipboard' | 'none'
}

export interface Share {
  /** Extract sighting ID from current URL. Returns null if not present. */
  parseShareParam(): string | null
  /** Clear the ?s= param from URL without reload. */
  clearShareParam(): void
  /** Build share URL and copy/share. Returns result with method used. */
  shareSighting(id: string, title?: string): Promise<ShareResult>
  /** Build the full share URL for a sighting. */
  buildUrl(id: string): string
}

// ─── Singleton ──────────────────────────────────────────────────────

let instance: Share | null = null

export function useShare (): Share {
  if (instance) return instance

  function parseShareParam (): string | null {
    const params = new URLSearchParams(window.location.search)
    return params.get('s') || null
  }

  function clearShareParam (): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('s')
    const clean = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '')
    window.history.replaceState(null, '', clean)
  }

  function buildUrl (id: string): string {
    const url = new URL(window.location.href)
    url.searchParams.set('s', id)
    // Remove hash if present
    url.hash = ''
    return url.toString()
  }

  async function shareSighting (id: string, title?: string): Promise<ShareResult> {
    const url = buildUrl(id)
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
