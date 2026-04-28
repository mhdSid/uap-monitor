import { describe, it, expect } from 'vitest'
import { filterSightings } from '../../src/composables/use-filter'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { Sighting } from '../../src/types'

// ─── Fixture ────────────────────────────────────────────────────────

function makeSighting (overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: '1',
    source: DataSourceId.NUFORC,
    occurredAt: '2024-01-01T00:00:00Z',
    reportedAt: '2024-01-02T00:00:00Z',
    postedAt: '2024-01-03T00:00:00Z',
    location: 'Phoenix, AZ, USA',
    shape: SightingShape.TRIANGLE,
    duration: '5 min',
    observers: 2,
    summary: 'Triangle craft over Phoenix',
    description: 'Three lights in a perfect triangle moving silently',
    characteristics: [],
    coordinates: { lat: 33.4, lng: -112.1 },
    region: 'Arizona',
    country: 'United States',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 75,
    ...overrides
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('filterSightings', () => {
  it('returns the same array reference when no filter is active', async () => {
    const items = [makeSighting()]
    const result = await filterSightings(items, {})
    expect(result).toBe(items)
  })

  it('matches search case-insensitively across summary', async () => {
    const items = [
      makeSighting({ id: '1', summary: 'Bright orb in sky' }),
      makeSighting({ id: '2', summary: 'Triangle craft' })
    ]
    const result = await filterSightings(items, { search: 'ORB' })
    expect(result.map(s => s.id)).toEqual(['1'])
  })

  it('searches across description, region, country, location, and tags', async () => {
    const haystack = [
      makeSighting({ id: 'd', description: 'unique-keyword in description' }),
      makeSighting({ id: 'r', region: 'unique-keyword county' }),
      makeSighting({ id: 'c', country: 'unique-keyword-land' }),
      makeSighting({ id: 'l', location: 'unique-keyword town' }),
      makeSighting({ id: 't', tags: ['unique-keyword'] })
    ]
    const result = await filterSightings(haystack, { search: 'unique-keyword' })
    expect(result.map(s => s.id).sort()).toEqual(['c', 'd', 'l', 'r', 't'])
  })

  it('filters by exact shape', async () => {
    const items = [
      makeSighting({ id: '1', shape: SightingShape.TRIANGLE }),
      makeSighting({ id: '2', shape: SightingShape.DISK })
    ]
    const result = await filterSightings(items, { shape: SightingShape.DISK })
    expect(result.map(s => s.id)).toEqual(['2'])
  })

  it('filters by continent', async () => {
    const items = [
      makeSighting({ id: '1', continent: Continent.AMERICAS }),
      makeSighting({ id: '2', continent: Continent.EUROPE })
    ]
    const result = await filterSightings(items, { continent: Continent.EUROPE })
    expect(result.map(s => s.id)).toEqual(['2'])
  })

  it('filters by country', async () => {
    const items = [
      makeSighting({ id: '1', country: 'France' }),
      makeSighting({ id: '2', country: 'Germany' })
    ]
    const result = await filterSightings(items, { country: 'Germany' })
    expect(result.map(s => s.id)).toEqual(['2'])
  })

  it('filters by minCredibility (>=)', async () => {
    const items = [
      makeSighting({ id: 'low', credibility: 30 }),
      makeSighting({ id: 'edge', credibility: 50 }),
      makeSighting({ id: 'high', credibility: 80 })
    ]
    const result = await filterSightings(items, { minCredibility: 50 })
    expect(result.map(s => s.id).sort()).toEqual(['edge', 'high'])
  })

  it('filters by sources Set', async () => {
    const items = [
      makeSighting({ id: 'n', source: DataSourceId.NUFORC }),
      makeSighting({ id: 'h', source: DataSourceId.HATCH_UDB }),
      makeSighting({ id: 'c', source: DataSourceId.CHRONOLOGY })
    ]
    const sources = new Set([DataSourceId.NUFORC, DataSourceId.CHRONOLOGY])
    const result = await filterSightings(items, { sources })
    expect(result.map(s => s.id).sort()).toEqual(['c', 'n'])
  })

  it('AND-combines multiple filter fields', async () => {
    const items = [
      makeSighting({ id: 'match',         shape: SightingShape.DISK,     country: 'Brazil', credibility: 90 }),
      makeSighting({ id: 'wrong-shape',   shape: SightingShape.TRIANGLE, country: 'Brazil', credibility: 90 }),
      makeSighting({ id: 'low-cred',      shape: SightingShape.DISK,     country: 'Brazil', credibility: 10 }),
      makeSighting({ id: 'wrong-country', shape: SightingShape.DISK,     country: 'Chile',  credibility: 90 })
    ]
    const result = await filterSightings(items, {
      shape: SightingShape.DISK,
      country: 'Brazil',
      minCredibility: 50
    })
    expect(result.map(s => s.id)).toEqual(['match'])
  })

  it('handles datasets larger than the chunk size (5000)', async () => {
    const items = Array.from({ length: 6000 }, (_, i) => makeSighting({
      id: String(i),
      shape: i % 2 === 0 ? SightingShape.DISK : SightingShape.TRIANGLE
    }))
    const result = await filterSightings(items, { shape: SightingShape.DISK })
    expect(result).toHaveLength(3000)
  })
})
