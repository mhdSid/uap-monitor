/**
 * useSeismic — year-windowed earthquake data for sighting correlation.
 *
 * Architecture:
 *   1. load()           → fetch manifest (tiny, ~1KB)
 *   2. ensureYears(f,t) → fetch earthquake files for years [f-1 … t+1]
 *                          only downloads years not already cached
 *   3. Correlation fns  → operate on currently-loaded earthquakes
 *
 * This keeps client downloads proportional to the viewed sighting range
 * instead of fetching the full 80+ MB dataset.
 *
 * EQL (Earthquake Light) candidate criteria:
 *  - Distance < 120 km from epicenter
 *  - Time delta < 48 hours
 *  - Magnitude ≥ 4.5
 *  - Depth < 30 km (shallow = more piezoelectric discharge)
 *
 * Usage:
 *   const seismic = useSeismic()
 *   await seismic.load()
 *   await seismic.ensureYears(2020, 2025)
 *   const nearby = seismic.findNearSighting(sighting)
 */

import type { Earthquake, EarthquakeManifest, Sighting, NearbyEarthquake } from '@/types'
import { haversineKm } from './use-fireball'
import { fetchJson, dataUrl } from './use-fetch'

// ─── Constants ──────────────────────────────────────────────────────

const MANIFEST_FILE = 'earthquakes-manifest.json'

const DEFAULT_RADIUS_KM = 300
const DEFAULT_HOURS_WINDOW = 72

/** Extra years to load beyond the sighting range (for 72h correlation window) */
const YEAR_BUFFER = 1

const EQL_MAX_DIST_KM = 120
const EQL_MAX_HOURS = 48
const EQL_MIN_MAG = 4.5
const EQL_MAX_DEPTH_KM = 30

// ─── State ──────────────────────────────────────────────────────────

let manifest: EarthquakeManifest | null = null
let manifestError = false

/** Year → earthquake array. Populated on demand. */
const yearCache = new Map<number, Earthquake[]>()

/** Years currently being fetched (dedup parallel requests) */
const pendingYears = new Map<number, Promise<Earthquake[]>>()

// ─── Helpers ────────────────────────────────────────────────────────

function hoursDelta (a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return (db - da) / (1000 * 60 * 60)
}

function isEQLCandidate (distKm: number, hours: number, mag: number | null, depth: number | null): boolean {
  return (
    distKm <= EQL_MAX_DIST_KM &&
    Math.abs(hours) <= EQL_MAX_HOURS &&
    (mag !== null && mag >= EQL_MIN_MAG) &&
    (depth === null || depth <= EQL_MAX_DEPTH_KM)
  )
}

// ─── Composable ─────────────────────────────────────────────────────

export function useSeismic () {

  // ─── Manifest ──────────────────────────────────────────────────

  async function load (): Promise<EarthquakeManifest | null> {
    if (manifest) return manifest
    if (manifestError) return null

    try {
      manifest = await fetchJson<EarthquakeManifest>(dataUrl(MANIFEST_FILE))
      return manifest
    } catch {
      manifestError = true
      return null
    }
  }

  function getManifest (): EarthquakeManifest | null {
    return manifest
  }

  function getTotalCount (): number {
    return manifest?.totalRecords ?? 0
  }

  // ─── Year loading ─────────────────────────────────────────────

  /**
   * Ensure earthquake data is loaded for the given year range.
   * Adds a ±1 year buffer for the 72-hour correlation window.
   * Only fetches years not already in cache.
   */
  async function ensureYears (fromYear: number, toYear: number): Promise<void> {
    if (!manifest) return

    const start = fromYear - YEAR_BUFFER
    const end = toYear + YEAR_BUFFER
    const promises: Promise<Earthquake[]>[] = []

    for (let y = start; y <= end; y++) {
      if (yearCache.has(y)) continue

      const meta = manifest.years[String(y)]
      if (!meta) continue

      if (pendingYears.has(y)) {
        promises.push(pendingYears.get(y)!)
        continue
      }

      const promise = fetchJson<Earthquake[]>(dataUrl(meta.file))
        .then((quakes) => {
          yearCache.set(y, quakes)
          pendingYears.delete(y)
          return quakes
        })
        .catch(() => {
          yearCache.set(y, [])
          pendingYears.delete(y)
          return [] as Earthquake[]
        })

      pendingYears.set(y, promise)
      promises.push(promise)
    }

    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  /** Get all currently-loaded earthquakes (flat array across all cached years) */
  function getAll (): Earthquake[] {
    const all: Earthquake[] = []
    for (const quakes of yearCache.values()) {
      all.push(...quakes)
    }
    return all
  }

  function getCount (): number {
    let count = 0
    for (const quakes of yearCache.values()) {
      count += quakes.length
    }
    return count
  }

  // ─── Single sighting correlation ────────────────────────────────

  function findNearSighting (
    sighting: Sighting,
    opts?: { maxKm?: number; maxHours?: number }
  ): NearbyEarthquake[] {
    if (!sighting.coordinates || !sighting.occurredAt) return []

    const maxKm = opts?.maxKm ?? DEFAULT_RADIUS_KM
    const maxHours = opts?.maxHours ?? DEFAULT_HOURS_WINDOW
    const { lat, lng } = sighting.coordinates
    const sYear = parseInt(sighting.occurredAt.slice(0, 4), 10)
    const results: NearbyEarthquake[] = []

    // Only search years within ±1 of the sighting year
    for (let y = sYear - YEAR_BUFFER; y <= sYear + YEAR_BUFFER; y++) {
      const quakes = yearCache.get(y)
      if (!quakes) continue

      for (const eq of quakes) {
        if (eq.lat === null || eq.lng === null) continue

        const hours = hoursDelta(eq.time, sighting.occurredAt)
        if (Math.abs(hours) > maxHours) continue

        const dist = haversineKm(lat, lng, eq.lat, eq.lng)
        if (dist > maxKm) continue

        results.push({
          earthquake: eq,
          distanceKm: Math.round(dist),
          hoursDelta: +hours.toFixed(1),
          isEQLCandidate: isEQLCandidate(dist, hours, eq.magnitude, eq.depth)
        })
      }
    }

    results.sort((a, b) => a.distanceKm - b.distanceKm)
    return results
  }

  // ─── Bulk correlation ───────────────────────────────────────────

  function getCorrelatedPairs (
    sightings: Sighting[],
    opts?: { maxKm?: number; maxHours?: number }
  ): Array<{ sighting: Sighting } & NearbyEarthquake> {
    const pairs: Array<{ sighting: Sighting } & NearbyEarthquake> = []

    for (const s of sightings) {
      const nearby = findNearSighting(s, opts)
      for (const n of nearby) {
        pairs.push({ sighting: s, ...n })
      }
    }

    return pairs
  }

  function getEQLCandidates (sightings: Sighting[]): Array<{ sighting: Sighting } & NearbyEarthquake> {
    return getCorrelatedPairs(sightings, {
      maxKm: EQL_MAX_DIST_KM,
      maxHours: EQL_MAX_HOURS
    }).filter(p => p.isEQLCandidate)
  }

  /**
   * Monthly aggregation for timeline visualization.
   * Returns Map of "YYYY-MM" → { quakeCount, correlatedSightings, eqlCandidates }
   */
  function getMonthlyCorrelation (sightings: Sighting[]): Map<string, {
    quakeCount: number
    correlatedSightings: number
    eqlCandidates: number
  }> {
    const months = new Map<string, {
      quakeCount: number
      correlatedSightingIds: Set<string>
      eqlCandidateIds: Set<string>
    }>()

    const pairs = getCorrelatedPairs(sightings)

    for (const p of pairs) {
      const monthKey = p.sighting.occurredAt.slice(0, 7)
      const entry = months.get(monthKey) ?? {
        quakeCount: 0,
        correlatedSightingIds: new Set<string>(),
        eqlCandidateIds: new Set<string>()
      }

      entry.quakeCount++
      entry.correlatedSightingIds.add(p.sighting.id)
      if (p.isEQLCandidate) entry.eqlCandidateIds.add(p.sighting.id)

      months.set(monthKey, entry)
    }

    const result = new Map<string, { quakeCount: number; correlatedSightings: number; eqlCandidates: number }>()
    for (const [key, val] of months) {
      result.set(key, {
        quakeCount: val.quakeCount,
        correlatedSightings: val.correlatedSightingIds.size,
        eqlCandidates: val.eqlCandidateIds.size
      })
    }

    return result
  }

  return {
    load,
    ensureYears,
    getManifest,
    getTotalCount,
    getAll,
    getCount,
    findNearSighting,
    getCorrelatedPairs,
    getEQLCandidates,
    getMonthlyCorrelation
  }
}
