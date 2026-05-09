/* ------------------------------------------------------------------ *
 *  Locale detection — pure utilities, zero side-effects, sync         *
 *                                                                     *
 *  The browser exposes `Intl.DateTimeFormat().resolvedOptions()       *
 *  .timeZone` — an IANA zone string like "America/Los_Angeles" or     *
 *  "Asia/Tokyo". Mapping the prefix (and a curated set of Asian       *
 *  zones) gives us a continent guess without permissions, network,    *
 *  or async work.                                                     *
 *                                                                     *
 *  Returns `undefined` when the timezone can't be resolved or the     *
 *  region is genuinely ambiguous (Atlantic, Indian, Antarctica) —     *
 *  callers should treat that as "no preference, show global".         *
 * ------------------------------------------------------------------ */

import { Continent } from '@/enums'

// ─── IANA zones that fall under "Asia — Middle East" ────────────────
//
// IANA "Asia/*" lumps every Asian capital into a single bucket; the
// UAP Monitor data model splits Asia into Middle-East and Pacific.
// This list captures the Middle-East cities; everything else under
// "Asia/*" is treated as Pacific Asia.

const ASIA_MIDDLE_EAST_ZONES = new Set<string>([
  'Asia/Aden',
  'Asia/Amman',
  'Asia/Baghdad',
  'Asia/Bahrain',
  'Asia/Beirut',
  'Asia/Damascus',
  'Asia/Dubai',
  'Asia/Gaza',
  'Asia/Hebron',
  'Asia/Jerusalem',
  'Asia/Kuwait',
  'Asia/Muscat',
  'Asia/Nicosia',
  'Asia/Qatar',
  'Asia/Riyadh',
  'Asia/Tehran',
  'Asia/Tel_Aviv'
])

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Detect the user's continent from their browser timezone.
 *
 * @returns A `Continent` enum value when confident, otherwise `undefined`
 *          (which callers should treat as "no preference / show global").
 */
export function detectContinent (): Continent | undefined {
  const tz = readTimezone()
  if (!tz) return undefined

  // Asia is split — check the explicit Middle-East list first.
  if (tz.startsWith('Asia/')) {
    return ASIA_MIDDLE_EAST_ZONES.has(tz)
      ? Continent.ASIA_MIDDLE_EAST
      : Continent.ASIA_PACIFIC
  }

  // Direct prefix mappings — IANA continent maps cleanly onto our enum.
  if (tz.startsWith('America/')) return Continent.AMERICAS
  if (tz.startsWith('Europe/'))  return Continent.EUROPE
  if (tz.startsWith('Africa/'))  return Continent.AFRICA

  // Pacific & Australia are ambiguous in IANA but uncontroversial here:
  // both sit in the "Oceania" bucket as the data labels it.
  if (tz.startsWith('Australia/')) return Continent.OCEANIA
  if (tz.startsWith('Pacific/'))   return Continent.OCEANIA

  // Atlantic, Indian, Antarctica, Etc/* — too ambiguous to guess.
  // The bucket spans multiple continents (Atlantic/Reykjavik vs
  // Atlantic/Bermuda) so we deliberately return undefined.
  return undefined
}

// ─── Internals ───────────────────────────────────────────────────────

function readTimezone (): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}
