/**
 * useGeomagnetic — load and query geomagnetic Kp index data.
 *
 * Provides:
 *  - load()                    → fetch and cache the dataset
 *  - findKpForSighting(s)      → Kp value at time of sighting
 *  - getKpDistribution(sightings) → histogram of sighting counts by Kp level
 *  - getStormSightings(sightings, minKp) → filter sightings during storms
 *  - getDailyKp(date)          → all 8 Kp values for a given date
 *
 * Usage:
 *   const geo = useGeomagnetic()
 *   await geo.load()
 *   const result = geo.findKpForSighting(sighting)
 */

import type { GeomagneticRecord, GeomagneticCollection, Sighting, SightingKpResult } from '@/types'
import { fetchJson, dataUrl } from './use-fetch'

// ─── Constants ──────────────────────────────────────────────────────

const DATA_FILE = 'geomagnetic-kp.json'
const KP_STORM_THRESHOLD = 5
const KP_INTERVALS_PER_DAY = 8
const HOURS_PER_INTERVAL = 3

// ─── State ──────────────────────────────────────────────────────────

let cached: GeomagneticRecord[] | null = null
let cachedCollection: GeomagneticCollection | null = null
/** Fast lookup: date string → record */
let dateIndex: Map<string, GeomagneticRecord> | null = null

// ─── Composable ─────────────────────────────────────────────────────

export function useGeomagnetic () {
  async function load (): Promise<GeomagneticRecord[]> {
    if (cached) return cached

    try {
      const data = await fetchJson<GeomagneticCollection>(dataUrl(DATA_FILE))
      cachedCollection = data
      cached = data.data ?? []

      // Build date index for O(1) lookups
      dateIndex = new Map()
      for (const record of cached) {
        dateIndex.set(record.date, record)
      }

      return cached
    } catch {
      cached = []
      dateIndex = new Map()
      return []
    }
  }

  function getAll (): GeomagneticRecord[] {
    return cached ?? []
  }

  function getCollection (): GeomagneticCollection | null {
    return cachedCollection
  }

  function getCount (): number {
    return cached?.length ?? 0
  }

  // ─── Single-date lookup ─────────────────────────────────────────

  /** Get all 8 Kp values for a specific date (YYYY-MM-DD) */
  function getDailyKp (date: string): GeomagneticRecord | null {
    if (!dateIndex) return null
    return dateIndex.get(date) ?? null
  }

  // ─── Sighting correlation ───────────────────────────────────────

  /** Map UTC hour to 3-hour interval index (0–7) */
  function hourToInterval (hour: number): number {
    return Math.min(KP_INTERVALS_PER_DAY - 1, Math.floor(hour / HOURS_PER_INTERVAL))
  }

  /** Look up the Kp value for the time window containing a sighting */
  function findKpForSighting (sighting: Sighting): SightingKpResult {
    const empty: SightingKpResult = { kp: null, apDaily: null, kpMax: null, isStorm: false }
    if (!dateIndex || !sighting.occurredAt) return empty

    const dt = new Date(sighting.occurredAt)
    if (isNaN(dt.getTime())) return empty

    const dateStr = sighting.occurredAt.slice(0, 10)
    const record = dateIndex.get(dateStr)
    if (!record) return empty

    const interval = hourToInterval(dt.getUTCHours())
    const kp = record.kp[interval]
    const validKps = record.kp.filter((v): v is number => v !== null)
    const kpMax = validKps.length > 0 ? Math.max(...validKps) : null

    return {
      kp,
      apDaily: record.apDaily,
      kpMax,
      isStorm: (kp !== null && kp >= KP_STORM_THRESHOLD) || (kpMax !== null && kpMax >= KP_STORM_THRESHOLD)
    }
  }

  // ─── Aggregate statistics ───────────────────────────────────────

  /**
   * Histogram: how many sightings occurred at each Kp level (0–9).
   * Returns array of 10 counts indexed by floor(Kp).
   */
  function getKpDistribution (sightings: Sighting[]): number[] {
    const buckets = new Array<number>(10).fill(0)
    if (!dateIndex) return buckets

    for (const s of sightings) {
      const result = findKpForSighting(s)
      if (result.kp !== null) {
        const bucket = Math.min(9, Math.floor(result.kp))
        buckets[bucket]++
      }
    }
    return buckets
  }

  /** Filter sightings that occurred during geomagnetic storms */
  function getStormSightings (sightings: Sighting[], minKp = KP_STORM_THRESHOLD): Sighting[] {
    if (!dateIndex) return []
    return sightings.filter(s => {
      const result = findKpForSighting(s)
      return result.kp !== null && result.kp >= minKp
    })
  }

  /**
   * Monthly aggregation for timeline visualization.
   * Returns Map of "YYYY-MM" → { avgKp, maxKp, sightingCount, stormSightingCount }
   */
  function getMonthlyCorrelation (sightings: Sighting[]): Map<string, {
    avgKp: number
    maxKp: number
    sightingCount: number
    stormSightingCount: number
  }> {
    const months = new Map<string, {
      kpSum: number
      kpCount: number
      maxKp: number
      sightingCount: number
      stormSightingCount: number
    }>()

    if (!dateIndex) return new Map()

    for (const s of sightings) {
      if (!s.occurredAt) continue
      const monthKey = s.occurredAt.slice(0, 7)
      const result = findKpForSighting(s)

      const entry = months.get(monthKey) ?? {
        kpSum: 0, kpCount: 0, maxKp: 0,
        sightingCount: 0, stormSightingCount: 0
      }

      entry.sightingCount++

      if (result.kp !== null) {
        entry.kpSum += result.kp
        entry.kpCount++
        entry.maxKp = Math.max(entry.maxKp, result.kp)
        if (result.kp >= KP_STORM_THRESHOLD) entry.stormSightingCount++
      }

      months.set(monthKey, entry)
    }

    const result = new Map<string, { avgKp: number; maxKp: number; sightingCount: number; stormSightingCount: number }>()
    for (const [key, val] of months) {
      result.set(key, {
        avgKp: val.kpCount > 0 ? +(val.kpSum / val.kpCount).toFixed(1) : 0,
        maxKp: val.maxKp,
        sightingCount: val.sightingCount,
        stormSightingCount: val.stormSightingCount
      })
    }

    return result
  }

  return {
    load,
    getAll,
    getCollection,
    getCount,
    getDailyKp,
    findKpForSighting,
    getKpDistribution,
    getStormSightings,
    getMonthlyCorrelation
  }
}
