import type { Sighting } from '@/types'
import { DataSourceId, Continent, SightingStatus } from '@/enums'
import { fetchJson, dataUrl } from './use-fetch'

// ─── Types ──────────────────────────────────────────────────────────

interface RussianManifest {
  generatedAt: string
  totalRecords: number
  sightings: RawRussianSighting[]
}

interface RawRussianSighting {
  id: string
  occurredAt: string
  reportedAt: string
  postedAt: string
  location: string
  region: string
  country: string
  coordinates: { lat: number; lng: number } | null
  shape: string
  duration: string
  observers: number
  summary: string
  description: string
  characteristics: string[]
  credibility: number
  tags?: string[]
  strangeness?: number
  ref?: string
  subSource?: string
}

// ─── Normalize ──────────────────────────────────────────────────────

function normalize (raw: RawRussianSighting): Sighting {
  return {
    id: raw.id,
    source: DataSourceId.CHRONOLOGY,
    subSource: raw.subSource || 'RUSSIAN_HISTORICAL',
    occurredAt: raw.occurredAt,
    reportedAt: raw.reportedAt || raw.occurredAt,
    postedAt: raw.postedAt || new Date().toISOString(),
    location: raw.location,
    shape: raw.shape as Sighting['shape'],
    duration: raw.duration,
    observers: raw.observers,
    summary: raw.summary,
    description: raw.description,
    characteristics: raw.characteristics,
    coordinates: raw.coordinates,
    region: raw.region,
    country: raw.country,
    continent: Continent.EURASIA,
    status: SightingStatus.PENDING,
    credibility: raw.credibility,
    tags: raw.tags,
    strangeness: raw.strangeness,
    ref: raw.ref
  }
}

// ─── Composable ─────────────────────────────────────────────────────

let cached: Sighting[] | null = null

export function useRussianHistorical () {
  async function load (): Promise<Sighting[]> {
    if (cached) return cached

    try {
      const data = await fetchJson<RussianManifest>(dataUrl('russian-historical.json'))
      cached = data.sightings.map(normalize)
      console.log(`[Russian Historical] ${cached.length} sightings loaded (${data.sightings[data.sightings.length - 1]?.occurredAt?.slice(0, 4)}–${data.sightings[0]?.occurredAt?.slice(0, 4)})`)
      return cached
    } catch (err) {
      console.warn('[Russian Historical] Failed to load:', err)
      return []
    }
  }

  function getAll (): Sighting[] {
    return cached || []
  }

  function getCount (): number {
    return cached?.length || 0
  }

  return { load, getAll, getCount }
}
