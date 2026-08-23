#!/usr/bin/env node

/**
 * geo-resolve.mjs
 *
 * Tiered, non-guessing country → region resolver.
 *
 * The rule this module exists to enforce: NEVER assign a region by assumption.
 * The previous behaviour defaulted every unrecognised country to AMERICAS,
 * which quietly filed the Netherlands, Greenland, Croatia and Myanmar in the
 * Americas. Here, a token either resolves through an auditable tier or it does
 * not resolve at all — and an unresolved token is reported, never guessed.
 *
 * Tiers, strongest evidence first. Every result carries the tier that produced
 * it in `via`, so any inference can be reviewed after the fact:
 *
 *   exact        ISO2 code, or a canonical country name
 *   alias        known spelling / historical / native-language variant
 *   subdivision  province, county, state or territory → parent country
 *   macro        unambiguous macro-region ("South America")
 *   maritime     open water — a first-class region, not a fallback
 *   space        orbit / lunar — likewise
 *   cleaned      re-tried after stripping parentheticals and trailing junk
 *   multi        "Germany/France" → first resolvable country, flagged
 *   keyword      contains "ocean"/"sea" → MARITIME, "orbit"/"moon" → SPACE
 *   city         matched a real city name in the 135K-city index (inference —
 *                ordered LAST precisely because it is the weakest evidence, and
 *                because population ordering can mislead: "Tenerife" matches a
 *                Colombian town before the Spanish island, which is why the
 *                island is listed explicitly in SUBDIVISIONS)
 *
 * Absent input (empty string, "Unknown", "Unspecified") resolves to null with
 * `via: 'absent'`. That is not a failure — it is the honest representation of a
 * sighting whose location was never recorded, and such records are excluded
 * from region aggregation rather than being invented into one.
 */

import {
  Region, COUNTRIES, COUNTRY_ALIASES, SUBDIVISIONS,
  MARITIME_TOKENS, SPACE_TOKENS, MACRO_REGIONS
} from './geo-registry.mjs'
import { lookupCountryByCity } from './geocoder.mjs'

export { Region }

/**
 * Tokens that mean "no location was recorded" rather than a place.
 *
 * Deliberately does NOT include 'on': that is Ontario's province code, and one
 * junk record spelled "on" is not worth mis-resolving every Ontario sighting.
 * 'na' stays, since in this corpus it is "N/A" rather than Namibia — Namibia is
 * always spelled out.
 */
const ABSENT_TOKENS = new Set(['', 'unknown', 'unspecified', 'n a', 'na', 'none', 'foreign', 'other'])

/**
 * Two-letter subdivision codes, checked BEFORE any ISO 3166 match.
 *
 * This guard is not optional: a great many US state abbreviations are also
 * valid ISO country codes — IL is Israel, IN is India, MO is Macau, DE is
 * Germany, LA is Laos, MD is Moldova, MT is Malta, PA is Panama, NE is Niger,
 * SC is Seychelles. Without this, a Location that split badly ("…, IL)") would
 * silently relocate an Illinois sighting to Israel.
 */
const US_STATE_ABBR = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'])

const CA_PROVINCE_ABBR = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])

/** A segment must match a city at least this large before it is believed. */
const SEGMENT_CITY_MIN_POPULATION = 50000

const MARITIME_WORDS = /\b(ocean|sea|channel|gulf|strait|atlantic|pacific|caribbean|mediterranean|baltic|adriatic|high seas|at sea|international waters)\b/
const SPACE_WORDS = /\b(orbit|outer space|space station|iss|lunar|moon)\b/

/**
 * Canonical form for table lookups: lowercase, diacritics stripped,
 * every run of non-alphanumerics collapsed to a single space.
 *   "Croatia (Hrvatska)" → "croatia hrvatska"
 *   "Šiauliai"           → "siauliai"
 */
export function normalizeToken (raw) {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Letters NFD does not decompose because they are distinct letters rather
    // than base+diacritic: Łódź, Ørsted, Æro, Đakovo, Þingvellir, Straße.
    .replace(/[łŁ]/g, 'l')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[đĐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Split a Location string on commas that are NOT inside parentheses.
 *
 * The source field is comma-delimited but frequently contains parenthesised
 * asides that themselves contain commas — "Yucatan (Light House), MX" or
 * "(near PA border), PA, USA". A naive split shatters those into fragments
 * like "near PA border)" and "000 ft.)", which is where most unresolvable
 * country tokens came from.
 */
export function splitLocation (raw) {
  const parts = []
  let depth = 0
  let current = ''

  for (const ch of String(raw ?? '')) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)

    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current.trim())

  return parts.filter(p => p !== '')
}

/** Strip parentheticals and dangling punctuation, e.g. "Corsica (France)" → "corsica". */
function clean (token) {
  return normalizeToken(
    String(token)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[)\]]+/g, ' ')
  )
}

/**
 * Candidate sub-tokens of a messy string, longest first.
 *
 * Splits on punctuation that separates a place from surrounding prose, then
 * also yields contiguous word n-grams so a multi-word country name inside a
 * longer phrase is still found. Longest-first ordering matters: "new zealand"
 * must be tried before "new".
 */
function segmentsOf (raw) {
  const pieces = String(raw ?? '')
    .split(/[-–—;:.,/\\|]+/)
    .map(normalizeToken)
    .filter(Boolean)

  const candidates = new Set(pieces)

  for (const piece of pieces) {
    const words = piece.split(' ').filter(Boolean)
    for (let size = Math.min(words.length, 4); size >= 1; size--) {
      for (let i = 0; i + size <= words.length; i++) {
        candidates.add(words.slice(i, i + size).join(' '))
      }
    }
  }

  return [...candidates].sort((a, b) => b.length - a.length)
}

function fromIso (iso, via, extra = {}) {
  const entry = COUNTRIES[iso]
  if (!entry) return null
  return { iso2: iso, country: entry.name, region: entry.region, via, ...extra }
}

/** Table lookups shared by the raw and cleaned passes. */
function lookupTables (token, viaSuffix = '') {
  if (!token) return null

  if (SPACE_TOKENS.has(token)) return { iso2: null, country: null, region: Region.SPACE, via: 'space' + viaSuffix }
  if (MARITIME_TOKENS.has(token)) return { iso2: null, country: null, region: Region.MARITIME, via: 'maritime' + viaSuffix }

  // Subdivision abbreviations first — see the US_STATE_ABBR comment above.
  const upper = token.toUpperCase()
  if (upper.length === 2) {
    if (US_STATE_ABBR.has(upper)) return fromIso('US', 'subdivision' + viaSuffix)
    if (CA_PROVINCE_ABBR.has(upper)) return fromIso('CA', 'subdivision' + viaSuffix)
  }

  // Country names outrank subdivision names on collision ("Georgia").
  if (COUNTRY_ALIASES[token]) return fromIso(COUNTRY_ALIASES[token], 'alias' + viaSuffix)

  if (upper.length === 2 && COUNTRIES[upper]) return fromIso(upper, 'exact' + viaSuffix)

  if (SUBDIVISIONS[token]) return fromIso(SUBDIVISIONS[token], 'subdivision' + viaSuffix)

  if (MACRO_REGIONS[token]) {
    return { iso2: null, country: null, region: MACRO_REGIONS[token], via: 'macro' + viaSuffix }
  }

  return null
}

/**
 * Resolve a raw country token to { iso2, country, region, via }.
 *
 * Returns null only when the token is genuinely unresolvable, which the caller
 * must surface (quarantine / audit) rather than paper over.
 *
 * @param {string} raw           - the country slot from the source Location
 * @param {{ allowCity?: boolean }} [opts] - allowCity enables the weakest tier
 */
export function resolveCountry (raw, opts = {}) {
  const { allowCity = true } = opts
  const token = normalizeToken(raw)

  if (ABSENT_TOKENS.has(token)) return { iso2: null, country: null, region: null, via: 'absent' }

  const direct = lookupTables(token)
  if (direct) return direct

  const cleaned = clean(raw)
  if (cleaned && cleaned !== token) {
    const viaCleaned = lookupTables(cleaned, '+cleaned')
    if (viaCleaned) return viaCleaned
  }

  // "Germany/France", "OMAN/UAE", "South Korea / Japan" — take the first
  // resolvable country as primary and record that the token named several.
  if (/[/&]| and /.test(raw)) {
    const candidates = String(raw).split(/[/&]|\sand\s/).map(s => s.trim()).filter(Boolean)
    if (candidates.length > 1) {
      for (const candidate of candidates) {
        const hit = lookupTables(normalizeToken(candidate)) || lookupTables(clean(candidate))
        if (hit) return { ...hit, via: 'multi', alternatives: candidates.length }
      }
    }
  }

  // A parenthetical often names the country outright — "Kaunitz (Germany)",
  // "Zhejiang (China)", "Yucatan (Light House) (Mexico)". Strong evidence, so
  // it is tried before the looser keyword and city tiers.
  for (const inner of String(raw).matchAll(/[([]([^)\]]+)[)\]]/g)) {
    for (const segment of segmentsOf(inner[1])) {
      const hit = lookupTables(segment)
      if (hit) return { ...hit, via: 'parenthetical' }
    }
  }

  // Descriptive phrases the tables cannot enumerate: "Above the pacific ocean",
  // "Indian Ocean 500 miles from nearest land", "In orbit in space".
  if (SPACE_WORDS.test(token)) return { iso2: null, country: null, region: Region.SPACE, via: 'keyword' }
  if (MARITIME_WORDS.test(token)) return { iso2: null, country: null, region: Region.MARITIME, via: 'keyword' }

  // Compound tokens where a country sits beside free text, separated by
  // punctuation: "New Zealand -Taranaki", "Israel - near Petach Tikva",
  // "Chennai. Tamil Nadu", "Tunisia-ITALIA".
  for (const segment of segmentsOf(raw)) {
    if (segment === token) continue
    const hit = lookupTables(segment)
    if (hit) return { ...hit, via: 'segment' }
  }

  if (allowCity) {
    for (const candidate of [token, cleaned]) {
      if (!candidate) continue
      const iso = lookupCountryByCity(candidate)
      if (iso && COUNTRIES[iso]) return fromIso(iso, 'city')
    }

    // Same idea against sub-tokens ("City of Leicester", "Town of Oyster Bay").
    // Requires a substantial city, because a bare word like "east" or "above"
    // will otherwise match some hamlet somewhere and invent a country.
    for (const segment of segmentsOf(raw)) {
      if (segment.length < 4) continue
      const iso = lookupCountryByCity(segment, SEGMENT_CITY_MIN_POPULATION)
      if (iso && COUNTRIES[iso]) return fromIso(iso, 'city+segment')
    }
  }

  return null
}

/**
 * Collector for unresolved tokens so a run can report them in aggregate
 * instead of failing on the first one.
 */
export function createResolutionReport () {
  const unresolved = new Map()
  const byTier = new Map()

  return {
    /** Resolve and record. Returns the same shape as resolveCountry. */
    resolve (raw, opts) {
      const result = resolveCountry(raw, opts)
      if (result) {
        byTier.set(result.via, (byTier.get(result.via) || 0) + 1)
        return result
      }
      const token = String(raw ?? '').trim()
      unresolved.set(token, (unresolved.get(token) || 0) + 1)
      byTier.set('unresolved', (byTier.get('unresolved') || 0) + 1)
      return null
    },

    get unresolvedCount () {
      return [...unresolved.values()].reduce((n, v) => n + v, 0)
    },

    get unresolvedTokens () {
      return [...unresolved].sort((a, b) => b[1] - a[1])
    },

    print (label = 'Geo') {
      const total = [...byTier.values()].reduce((n, v) => n + v, 0)
      console.log(`\n[${label} Resolver] ${total.toLocaleString()} tokens resolved by tier:`)
      for (const [tier, n] of [...byTier].sort((a, b) => b[1] - a[1])) {
        const pct = total ? ((n / total) * 100).toFixed(1) : '0.0'
        console.log(`  ${tier.padEnd(18)} ${String(n.toLocaleString()).padStart(9)}  (${pct}%)`)
      }
      if (unresolved.size) {
        console.log(`\n  ✗ ${unresolved.size} UNRESOLVED token(s) — no region assigned, nothing guessed:`)
        for (const [token, n] of this.unresolvedTokens.slice(0, 25)) {
          console.log(`      ${String(n).padStart(6)}  ${JSON.stringify(token)}`)
        }
        if (unresolved.size > 25) console.log(`      ... and ${unresolved.size - 25} more`)
      }
    }
  }
}
