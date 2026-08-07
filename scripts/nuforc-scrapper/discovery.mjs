/**
 * NUFORC latest-id discovery.
 *
 * Extracted into its own module so scraper.mjs AND test-discovery.mjs import the
 * SAME code — the test can never pass against a stale copy of the algorithm.
 *
 * Why a forward scan instead of binary search:
 *   NUFORC's id space is sparse. Deleted/spam/out-of-range reports leave holes,
 *   so a single 404 does NOT mean "past the newest sighting". Binary search
 *   assumes a clean exists→empty boundary and undershoots across a hole,
 *   silently missing everything above it. A forward scan that only concludes
 *   "the end" after `missWindow` CONSECUTIVE misses tolerates any hole smaller
 *   than the window.
 */

/**
 * Find the newest existing id at or above `from`, tolerating gaps up to
 * `missWindow` consecutive absent ids.
 *
 * `from` (the cached max) is treated as known-existing and is the floor of the
 * result — the return value is always >= `from`, so a caller can't accidentally
 * walk below already-cached territory.
 *
 * Contract / boundary behaviour (locked by test-discovery.mjs):
 *   - Nothing above `from`            → returns `from`.
 *   - Holes strictly smaller than the → bridged; scan continues past them.
 *     window
 *   - A hole of exactly `missWindow`  → ends the scan; ids beyond it are NOT
 *     (or larger) consecutive misses    found. This is the intentional, tunable
 *                                        limit — raise `missWindow` for sparser
 *                                        data. It is a documented bound, never a
 *                                        silent guess.
 *   - `missWindow` < 1                → clamped to 1.
 *   - Runaway guard: never probes more than `options.maxAbove` ids above `from`
 *     (default 100000), so a probe that always returns true can't loop forever.
 *
 * @param {number}   from                 Known-existing baseline id (cachedMax).
 * @param {number}   missWindow           Consecutive-miss tolerance (gap size).
 * @param {(id:number)=>Promise<boolean>|boolean} probe  Existence oracle.
 * @param {{maxAbove?:number}} [options]
 * @returns {Promise<number>} Newest existing id (>= from).
 */
export async function discoverLatestForward (from, missWindow, probe, options = {}) {
  if (typeof probe !== "function") {
    throw new TypeError("discoverLatestForward: `probe` must be a function")
  }

  const base = Number.isFinite(from) ? Math.max(0, Math.floor(from)) : 0
  const window = Number.isFinite(missWindow) ? Math.max(1, Math.floor(missWindow)) : 1
  const maxAbove = Number.isFinite(options.maxAbove) ? Math.max(1, Math.floor(options.maxAbove)) : 100000
  const cap = base + maxAbove

  let lastValid = base
  let misses = 0

  for (let id = base + 1; misses < window && id <= cap; id++) {
    const exists = await probe(id)
    if (exists) {
      lastValid = id
      misses = 0
    } else {
      misses++
    }
  }

  return lastValid
}
