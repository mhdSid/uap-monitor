import { ERRORS } from '@/data/strings'
import type { ChronologyManifest, SubSourceMeta, Sighting, YearChunkMeta } from '@/types'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '@/enums'

// ─── Types ──────────────────────────────────────────────────────────

export interface ChronologySource {
  loadManifest(): Promise<ChronologyManifest | null>
  loadChunk(key: string): Promise<Sighting[]>
  loadYearRange(fromYear: number, toYear: number): Promise<Sighting[]>
  loadProgressive(
    fromYear: number,
    toYear: number,
    onChunk: (sightings: Sighting[]) => void,
  ): Promise<Sighting[]>
  getAvailableYears(): number[]
  getTotalCount(): number
  getLoadedCount(): number
  getSubSources(): Record<string, SubSourceMeta>
  getSubSourceCount(subSourceId: string): number
}

// ─── Shared constants ───────────────────────────────────────────────

const DATA_DIR = 'data'
const MANIFEST_FILE = 'chronology-manifest.json'

const VALID_SHAPES = new Set<string>(Object.values(SightingShape))
const VALID_STATUSES = new Set<string>(Object.values(SightingStatus))
const VALID_CONTINENTS = new Set<string>(Object.values(Continent))

// ─── Shared helpers ─────────────────────────────────────────────────

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return base.endsWith('/') ? base : `${base}/`
}

function dataUrl(filename: string): string {
  return `${resolveBaseUrl()}${DATA_DIR}/${filename}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} — ${url}`)
  }
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON from ${url}`)
  }
}

function isValidChronologyManifest(data: unknown): data is ChronologyManifest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.generatedAt === 'string' &&
    typeof obj.totalRecords === 'number' &&
    typeof obj.years === 'object' &&
    obj.years !== null &&
    typeof obj.subSources === 'object' &&
    obj.subSources !== null
  )
}

function parseSighting(raw: unknown): Sighting | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  const id = typeof r.id === 'string' ? r.id : typeof r.id === 'number' ? String(r.id) : null
  if (!id) return null

  const occurredAt = typeof r.occurredAt === 'string' ? r.occurredAt : ''
  if (!occurredAt) return null

  const shape = typeof r.shape === 'string' && VALID_SHAPES.has(r.shape)
    ? (r.shape as SightingShape)
    : SightingShape.UNKNOWN

  const status = typeof r.status === 'string' && VALID_STATUSES.has(r.status)
    ? (r.status as SightingStatus)
    : SightingStatus.PENDING

  const continent = typeof r.continent === 'string' && VALID_CONTINENTS.has(r.continent)
    ? (r.continent as Continent)
    : Continent.AMERICAS

  const coordinates = (
    typeof r.coordinates === 'object' &&
    r.coordinates !== null &&
    typeof (r.coordinates as Record<string, unknown>).lat === 'number' &&
    typeof (r.coordinates as Record<string, unknown>).lng === 'number'
  )
    ? { lat: (r.coordinates as { lat: number }).lat, lng: (r.coordinates as { lng: number }).lng }
    : null

  return {
    id,
    source: DataSourceId.CHRONOLOGY,
    subSource: typeof r.subSource === 'string' ? r.subSource : undefined,
    occurredAt,
    reportedAt: typeof r.reportedAt === 'string' ? r.reportedAt : occurredAt,
    postedAt: typeof r.postedAt === 'string' ? r.postedAt : occurredAt,
    location: typeof r.location === 'string' ? r.location : '',
    shape,
    duration: typeof r.duration === 'string' ? r.duration : '',
    observers: typeof r.observers === 'number' ? r.observers : 0,
    summary: typeof r.summary === 'string' ? r.summary : '',
    description: typeof r.description === 'string' ? r.description : '',
    characteristics: Array.isArray(r.characteristics) ? r.characteristics : [],
    coordinates,
    region: typeof r.region === 'string' ? r.region : '',
    country: typeof r.country === 'string' ? r.country : '',
    continent,
    status,
    credibility: typeof r.credibility === 'number' ? Math.min(100, Math.max(0, r.credibility)) : 0,
    tags: Array.isArray(r.tags) ? r.tags : undefined,
    strangeness: typeof r.strangeness === 'number' ? r.strangeness : undefined,
    ref: typeof r.ref === 'string' ? r.ref : undefined,
  }
}

function parseChunk(raw: unknown): Sighting[] {
  if (!Array.isArray(raw)) return []
  const sightings: Sighting[] = []
  for (const item of raw) {
    const parsed = parseSighting(item)
    if (parsed) sightings.push(parsed)
  }
  return sightings
}

// ─── Singleton factory ──────────────────────────────────────────────

let _instance: ChronologySource | null = null

export function useChronology(): ChronologySource {
  if (_instance) return _instance

  let manifest: ChronologyManifest | null = null
  let manifestError: string | null = null
  const chunkCache = new Map<string, Sighting[]>()
  const pendingFetches = new Map<string, Promise<Sighting[]>>()

  async function loadManifest(): Promise<ChronologyManifest | null> {
    if (manifest) return manifest
    if (manifestError) return null

    try {
      const data = await fetchJson<unknown>(dataUrl(MANIFEST_FILE))

      if (!isValidChronologyManifest(data)) {
        throw new Error(ERRORS.CHRONOLOGY_MANIFEST)
      }

      manifest = data
      return manifest
    } catch (err) {
      const message = err instanceof Error ? err.message : ERRORS.CHRONOLOGY_LOAD
      manifestError = message
      console.warn(`[Chronology] ${message}`)
      return null
    }
  }

  async function loadChunk(key: string): Promise<Sighting[]> {
    if (chunkCache.has(key)) return chunkCache.get(key)!
    if (pendingFetches.has(key)) return pendingFetches.get(key)!

    const m = manifest
    if (!m || !m.years[key]) return []

    const meta: YearChunkMeta = m.years[key]

    const promise = fetchJson<unknown>(dataUrl(meta.file))
      .then((raw) => {
        const sightings = parseChunk(raw)
        chunkCache.set(key, sightings)
        pendingFetches.delete(key)
        return sightings
      })
      .catch((err) => {
        pendingFetches.delete(key)
        console.warn(`[Chronology] Failed to load ${meta.file}:`, err)
        return [] as Sighting[]
      })

    pendingFetches.set(key, promise)
    return promise
  }

  function getChunkKeysForRange(fromYear: number, toYear: number): string[] {
    if (!manifest) return []

    const keys: string[] = []
    const available = Object.keys(manifest.years)

    for (const key of available) {
      if (key === 'ancient') {
        if (fromYear < 1800) keys.push(key)
        continue
      }

      if (key.endsWith('s')) {
        const decade = parseInt(key, 10)
        if (!isNaN(decade) && decade + 9 >= fromYear && decade <= toYear) {
          keys.push(key)
        }
        continue
      }

      const year = parseInt(key, 10)
      if (!isNaN(year) && year >= fromYear && year <= toYear) {
        keys.push(key)
      }
    }

    return keys
  }

  async function loadYearRange(fromYear: number, toYear: number): Promise<Sighting[]> {
    const m = await loadManifest()
    if (!m) return []

    const keys = getChunkKeysForRange(fromYear, toYear)
    const chunks = await Promise.all(keys.map(loadChunk))
    const merged = chunks.flat()

    merged.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    return merged
  }

  async function loadProgressive(
    fromYear: number,
    toYear: number,
    onChunk: (sightings: Sighting[]) => void,
  ): Promise<Sighting[]> {
    const m = await loadManifest()
    if (!m) return []

    const keys = getChunkKeysForRange(fromYear, toYear).reverse()
    let all: Sighting[] = []

    for (const key of keys) {
      const chunk = await loadChunk(key)
      all = [...all, ...chunk]
      all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      onChunk(all)
    }

    return all
  }

  function getAvailableYears(): number[] {
    if (!manifest) return []
    const years: number[] = []
    for (const [key, meta] of Object.entries(manifest.years)) {
      // Ancient and decade chunks carry their own distinct years list
      if (meta.years && meta.years.length > 0) {
        years.push(...meta.years)
        continue
      }
      // Per-year chunks: key IS the year
      if (key === 'ancient') continue // shouldn't happen if years[] is present
      if (key.endsWith('s')) continue // shouldn't happen if years[] is present
      const y = parseInt(key, 10)
      if (!isNaN(y)) years.push(y)
    }
    return years.sort((a, b) => b - a)
  }

  function getTotalCount(): number {
    return manifest?.totalRecords ?? 0
  }

  function getLoadedCount(): number {
    let count = 0
    for (const chunk of chunkCache.values()) {
      count += chunk.length
    }
    return count
  }

  function getSubSources(): Record<string, SubSourceMeta> {
    return manifest?.subSources ?? {}
  }

  function getSubSourceCount(subSourceId: string): number {
    return manifest?.subSources?.[subSourceId]?.count ?? 0
  }

  _instance = {
    loadManifest,
    loadChunk,
    loadYearRange,
    loadProgressive,
    getAvailableYears,
    getTotalCount,
    getLoadedCount,
    getSubSources,
    getSubSourceCount,
  }

  return _instance
}
