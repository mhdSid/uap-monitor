import { ERRORS } from '@/data/strings'
import type { SourceManifest, Sighting, YearChunkMeta } from '@/types'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '@/enums'
import { useToast } from '@/components/toast'

// ─── Constants ──────────────────────────────────────────────────────

const DATA_DIR = 'data'
const MANIFEST_FILE = 'hatch-manifest.json'

// ─── State (module-level singleton) ─────────────────────────────────

let manifest: SourceManifest | null = null
let manifestError: string | null = null
const chunkCache = new Map<string, Sighting[]>()
const pendingFetches = new Map<string, Promise<Sighting[]>>()

// ─── Resolve base URL from deployment context ───────────────────────

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  return base.endsWith('/') ? base : `${base}/`
}

function dataUrl(filename: string): string {
  return `${resolveBaseUrl()}${DATA_DIR}/${filename}`
}

// ─── JSON fetch with typed parse + error handling ───────────────────

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

// ─── Validation ─────────────────────────────────────────────────────

function isValidManifest(data: unknown): data is SourceManifest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.generatedAt === 'string' &&
    typeof obj.totalRecords === 'number' &&
    typeof obj.years === 'object' &&
    obj.years !== null
  )
}

const VALID_SHAPES = new Set<string>(Object.values(SightingShape))
const VALID_STATUSES = new Set<string>(Object.values(SightingStatus))
const VALID_CONTINENTS = new Set<string>(Object.values(Continent))
const VALID_SOURCES = new Set<string>(Object.values(DataSourceId))

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

  const source = typeof r.source === 'string' && VALID_SOURCES.has(r.source)
    ? (r.source as DataSourceId)
    : DataSourceId.HATCH_UDB

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
    source,
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
    // Extended fields
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

// ─── Composable ─────────────────────────────────────────────────────

export function useHatchUdb() {
  const toast = useToast()

  async function loadManifest(): Promise<SourceManifest | null> {
    if (manifest) return manifest
    if (manifestError) return null

    try {
      const data = await fetchJson<unknown>(dataUrl(MANIFEST_FILE))

      if (!isValidManifest(data)) {
        throw new Error(ERRORS.HATCH_MANIFEST)
      }

      manifest = data
      return manifest
    } catch (err) {
      const message = err instanceof Error ? err.message : ERRORS.HATCH_LOAD
      manifestError = message
      // Silent fail — Hatch is secondary source, don't block UI
      console.warn(`[Hatch UDB] ${message}`)
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
        console.warn(`[Hatch UDB] Failed to load ${meta.file}:`, err)
        return [] as Sighting[]
      })

    pendingFetches.set(key, promise)
    return promise
  }

  /**
   * Get all chunk keys that overlap with a year range.
   * Handles: "ancient", "1800s"..."1890s", "1900"..."2002"
   */
  function getChunkKeysForRange(fromYear: number, toYear: number): string[] {
    if (!manifest) return []

    const keys: string[] = []
    const available = Object.keys(manifest.years)

    for (const key of available) {
      if (key === 'ancient') {
        // Ancient chunk overlaps if range starts before 1800
        if (fromYear < 1800) keys.push(key)
        continue
      }

      if (key.endsWith('s')) {
        // Decade chunk: "1800s" → covers 1800–1809
        const decade = parseInt(key, 10)
        if (!isNaN(decade) && decade + 9 >= fromYear && decade <= toYear) {
          keys.push(key)
        }
        continue
      }

      // Year chunk: "1947"
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

    // Most recent first
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
      if (key === 'ancient') continue
      if (key.endsWith('s')) continue
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

  return {
    loadManifest,
    loadChunk,
    loadYearRange,
    loadProgressive,
    getAvailableYears,
    getTotalCount,
    getLoadedCount,
  }
}
