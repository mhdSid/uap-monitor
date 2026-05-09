/* ------------------------------------------------------------------ *
 *  useStickyOffsets — measures sticky ancestors and exposes them as   *
 *                     CSS custom properties on :root                  *
 *                                                                     *
 *  Why this exists                                                    *
 *  ────────────────                                                   *
 *  Multiple components (FilterDeck today, possibly more later) need   *
 *  to position themselves below the always-visible header + nav-tabs  *
 *  stack. Hardcoding `top: 95px` in those components silently breaks  *
 *  whenever someone tweaks header padding or adds a new tab row.      *
 *                                                                     *
 *  This composable observes the rendered heights of `.app-header` and *
 *  `.nav-tabs` with a single ResizeObserver and writes them to        *
 *  CSS custom properties on `:root`:                                  *
 *                                                                     *
 *      --layout-header-h        e.g. 49px                             *
 *      --layout-nav-h           e.g. 46px                             *
 *      --layout-sticky-offset   sum of the above                      *
 *                                                                     *
 *  Components consume the offset purely in CSS (`top: var(--layout-   *
 *  sticky-offset)`) — no JS coupling, no reactive subscriptions per   *
 *  consumer. The composable handles layout-shift events (fonts        *
 *  loading, breakpoint flips, theme swaps that change line-height)    *
 *  automatically.                                                     *
 *                                                                     *
 *  Singleton — call once at app boot. Subsequent calls are no-ops     *
 *  and return the same teardown handle.                               *
 * ------------------------------------------------------------------ */

const HEADER_SELECTOR = '.app-header'
const NAV_SELECTOR = '.nav-tabs'

const VAR_HEADER = '--layout-header-h'
const VAR_NAV = '--layout-nav-h'
const VAR_OFFSET = '--layout-sticky-offset'

let started = false
let cleanup: (() => void) | null = null

/**
 * Start measuring sticky ancestors. Idempotent — safe to call multiple
 * times; only the first call wires up the observer. Returns a teardown
 * function in case you ever need to unbind (most apps never will).
 */
export function useStickyOffsets (): () => void {
  if (started && cleanup) return cleanup
  started = true

  const root = document.documentElement
  const headerEl = document.querySelector<HTMLElement>(HEADER_SELECTOR)
  const navEl = document.querySelector<HTMLElement>(NAV_SELECTOR)

  // Defensive: if either selector isn't in the DOM yet, fall through —
  // the tokens.css fallbacks (49px / 46px) will be used. Caller can
  // re-invoke after mount; we'll observe whatever is present.
  const apply = (): void => {
    const headerH = headerEl?.offsetHeight ?? 0
    const navH = navEl?.offsetHeight ?? 0

    if (headerH > 0) root.style.setProperty(VAR_HEADER, `${headerH}px`)
    if (navH > 0) root.style.setProperty(VAR_NAV, `${navH}px`)

    // The derived offset is also written explicitly. tokens.css already
    // defines it as `calc(var(--layout-header-h) + var(--layout-nav-h))`,
    // so this is redundant for spec-compliant browsers — but writing it
    // directly avoids any per-frame `calc()` evaluation in the sticky
    // chain on older engines, and makes the value trivially inspectable
    // in DevTools.
    if (headerH > 0 && navH > 0) {
      root.style.setProperty(VAR_OFFSET, `${headerH + navH}px`)
    }
  }

  // Initial measurement after layout settles.
  // rAF handles the case where create() runs before first paint.
  requestAnimationFrame(apply)

  const ro = new ResizeObserver(apply)
  if (headerEl) ro.observe(headerEl)
  if (navEl) ro.observe(navEl)

  // Font loading can shift heights after observer attaches — re-apply
  // when the document finishes loading its webfonts.
  const fonts = document.fonts as FontFaceSet | undefined
  const onFontsReady = (): void => apply()
  fonts?.ready.then(onFontsReady).catch(() => {})

  cleanup = (): void => {
    ro.disconnect()
    started = false
    cleanup = null
  }
  return cleanup
}
