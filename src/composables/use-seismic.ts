/**
 * useSeismic — year-windowed earthquake data for sighting correlation.
 *
 * Performance architecture:
 *   Earthquakes are indexed by date (YYYY-MM-DD) on load.
 *   For a 72-hour correlation window, findNearSighting only checks
 *   earthquakes from ±3 days (~7 × 30 = ~210 quakes per sighting)
 *   instead of scanning an entire year (~10K+ quakes).
 *
 *   Timestamps are pre-parsed to epoch ms to avoid Date construction
 *   in the hot correlation loop.
 *
 * EQL (Earthquake Light) candidate criteria:
 *  - Distance < 120 km from epicenter
 *  - Time delta < 48 hours
 *  - Magnitude ≥ 4.5
 *  - Depth < 30 km (shallow = more piezoelectric discharge)
 */

import type { Earthquake, EarthquakeManifest, Sighting, NearbyEarthquake } from '@/types'
import { haversineKm } from './use-fireball'
import { fetchJson, dataUrl } from './use-fetch'
import { yieldThread } from './use-timing'

// ─── Constants ──────────────────────────────────────────────────────

const MANIFEST_FILE = 'earthquakes-manifest.json'

const DEFAULT_RADIUS_KM = 300
const DEFAULT_HOURS_WINDOW = 72
const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24

/** Extra years to load beyond the sighting range */
const YEAR_BUFFER = 1

/** Days to check in each direction for the time window */
const DAY_BUFFER = 3

/** Sightings per batch before yielding to main thread */
const CORRELATION_BATCH_SIZE = 500

const EQL_MAX_DIST_KM = 120
const EQL_MAX_HOURS = 48
const EQL_MIN_MAG = 4.5
const EQL_MAX_DEPTH_KM = 30

// ─── Types ──────────────────────────────────────────────────────────

/** Pre-parsed earthquake for fast correlation (no Date construction in hot loop) */
interface IndexedQuake {
  eq: Earthquake
  epochMs: number
  lat: number
  lng: number
}

// ─── State ──────────────────────────────────────────────────────────

let manifest: EarthquakeManifest | null = null
let manifestError = false

/** Year → raw earthquake array */
const yearCache = new Map<number, Earthquake[]>()

/** Date string (YYYY-MM-DD) → pre-parsed quakes for that date */
const dateIndex = new Map<string, IndexedQuake[]>()

/** Years currently being fetched */
const pendingYears = new Map<number, Promise<Earthquake[]>>()

// ─── Helpers ────────────────────────────────────────────────────────

function isEQLCandidate (distKm: number, hours: number, mag: number | null, depth: number | null): boolean {
  return (
    distKm <= EQL_MAX_DIST_KM &&
    Math.abs(hours) <= EQL_MAX_HOURS &&
    (mag !== null && mag >= EQL_MIN_MAG) &&
    (depth === null || depth <= EQL_MAX_DEPTH_KM)
  )
}

/** Get YYYY-MM-DD date strings for ±dayBuffer around an epoch timestamp */
function getDateKeysAround (epochMs: number, dayBuffer: number): string[] {
  const keys: string[] = []
  for (let d = -dayBuffer; d <= dayBuffer; d++) {
    const dt = new Date(epochMs + d * MS_PER_DAY)
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const day = String(dt.getUTCDate()).padStart(2, '0')
    keys.push(`${y}-${m}-${day}`)
  }
  return keys
}

/** Index a set of earthquakes by date into the global dateIndex */
function indexQuakes (quakes: Earthquake[]): void {
  for (const eq of quakes) {
    if (eq.lat === null || eq.lng === null) continue

    const epochMs = new Date(eq.time).getTime()
    if (isNaN(epochMs)) continue

    const dateKey = eq.time.slice(0, 10)
    const entry: IndexedQuake = { eq, epochMs, lat: eq.lat, lng: eq.lng }

    const bucket = dateIndex.get(dateKey)
    if (bucket) {
      bucket.push(entry)
    } else {
      dateIndex.set(dateKey, [entry])
    }
  }
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
          indexQuakes(quakes)
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

  // ─── Single sighting correlation (date-indexed) ──────────────

  function findNearSighting (
    sighting: Sighting,
    opts?: { maxKm?: number; maxHours?: number }
  ): NearbyEarthquake[] {
    if (!sighting.coordinates || !sighting.occurredAt) return []

    const maxKm = opts?.maxKm ?? DEFAULT_RADIUS_KM
    const maxHours = opts?.maxHours ?? DEFAULT_HOURS_WINDOW
    const { lat, lng } = sighting.coordinates

    const sEpoch = new Date(sighting.occurredAt).getTime()
    if (isNaN(sEpoch)) return []

    const maxMs = maxHours * MS_PER_HOUR
    const dayBuffer = Math.ceil(maxHours / 24)
    const dateKeys = getDateKeysAround(sEpoch, dayBuffer)
    const results: NearbyEarthquake[] = []

    for (const key of dateKeys) {
      const bucket = dateIndex.get(key)
      if (!bucket) continue

      for (const iq of bucket) {
        const deltaMs = iq.epochMs - sEpoch
        if (Math.abs(deltaMs) > maxMs) continue

        const dist = haversineKm(lat, lng, iq.lat, iq.lng)
        if (dist > maxKm) continue

        const hours = deltaMs / MS_PER_HOUR

        results.push({
          earthquake: iq.eq,
          distanceKm: Math.round(dist),
          hoursDelta: +hours.toFixed(1),
          isEQLCandidate: isEQLCandidate(dist, hours, iq.eq.magnitude, iq.eq.depth)
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

  /**
   * Non-blocking version. Yields every CORRELATION_BATCH_SIZE sightings.
   * With the date index, each sighting checks ~210 quakes instead of 30K+,
   * so batches of 500 are fast enough to keep yields infrequent.
   */
  async function getCorrelatedPairsAsync (
    sightings: Sighting[],
    opts?: { maxKm?: number; maxHours?: number }
  ): Promise<Array<{ sighting: Sighting } & NearbyEarthquake>> {
    const pairs: Array<{ sighting: Sighting } & NearbyEarthquake> = []

    for (let i = 0; i < sightings.length; i++) {
      const nearby = findNearSighting(sightings[i], opts)
      for (const n of nearby) {
        pairs.push({ sighting: sightings[i], ...n })
      }

      if (i > 0 && i % CORRELATION_BATCH_SIZE === 0) {
        await yieldThread()
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
    getCorrelatedPairsAsync,
    getEQLCandidates,
    getMonthlyCorrelation
  }
}
