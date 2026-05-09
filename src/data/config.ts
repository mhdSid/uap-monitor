/**
 * App-wide configuration constants.
 * Single source of truth for tuning values shared across components.
 */

/** Maximum number of years that can be selected at once */
export const MAX_YEAR_SPAN = 10

/** Default initial year range: newest year minus this value */
export const DEFAULT_YEAR_OFFSET = MAX_YEAR_SPAN

/**
 * ID of the hypothesis surfaced in the FeaturedHypothesis banner on
 * the monitor view. Must match a `results[].id` in public/data/hypotheses.json.
 * Rotate this string to feature a different finding without code changes
 * elsewhere.
 */
export const FEATURED_HYPOTHESIS_ID = 'nuclear-proximity'
