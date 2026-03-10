/**
 * useDelayedLoad — defer script/callback execution until page is fully loaded + delay.
 *
 * Waits for `load` event (all assets painted), then applies an additional
 * configurable delay before executing the callback. If the page is already
 * loaded when called, starts the delay immediately.
 *
 * Usage:
 *   useDelayedLoad(() => injectGTM(), { delayMs: 2000 })
 */

export interface DelayedLoadOptions {
  /** Additional delay in ms after page load (default: 1500) */
  delayMs?: number
}

export function useDelayedLoad(
  callback: () => void,
  options: DelayedLoadOptions = {}
): void {
  const { delayMs = 1500 } = options

  const execute = (): void => {
    setTimeout(callback, delayMs)
  }

  if (document.readyState === 'complete') {
    execute()
  } else {
    window.addEventListener('load', execute, { once: true })
  }
}
