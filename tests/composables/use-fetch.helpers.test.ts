import { describe, it, expect } from 'vitest'
import {
  parseSighting,
  parseChunk,
  dataUrl,
  sortNewestFirst,
  isValidManifest,
  getChunkKeysForRange
} from '../../src/composables/use-fetch'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { Sighting } from '../../src/types'

// ─── Fixtures ───────────────────────────────────────────────────────

function rawSighting (overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'abc-1',
    occurredAt: '2024-06-01T12:00:00Z',
    reportedAt: '2024-06-02T00:00:00Z',
    postedAt: '2024-06-03T00:00:00Z',
    location: 'Phoenix, AZ',
    shape: SightingShape.TRIANGLE,
    duration: '5 min',
    observers: 2,
    summary: 'Triangle craft',
    description: 'Three lights in formation',
    characteristics: ['Lights on object'],
    coordinates: { lat: 33.4, lng: -112.1 },
    region: 'Arizona',
    country: 'United States',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 75,
    source: DataSourceId.NUFORC,
    ...overrides
  }
}

function makeSighting (occurredAt: string, id = '1'): Sighting {
  return {
    id,
    source: DataSourceId.NUFORC,
    occurredAt,
    reportedAt: occurredAt,
    postedAt: occurredAt,
    location: '',
    shape: SightingShape.UNKNOWN,
    duration: '',
    observers: 0,
    summary: '',
    description: '',
    characteristics: [],
    coordinates: null,
    region: '',
    country: '',
    continent: Continent.AMERICAS,
    status: SightingStatus.PENDING,
    credibility: 0
  }
}

// ─── parseSighting ──────────────────────────────────────────────────

describe('parseSighting', () => {
  it('returns null for non-object input', () => {
    expect(parseSighting(null, DataSourceId.NUFORC)).toBeNull()
    expect(parseSighting('a string', DataSourceId.NUFORC)).toBeNull()
    expect(parseSighting(42, DataSourceId.NUFORC)).toBeNull()
  })

  it('returns null when id is missing or wrong type', () => {
    expect(parseSighting(rawSighting({ id: undefined }), DataSourceId.NUFORC)).toBeNull()
    expect(parseSighting(rawSighting({ id: true }), DataSourceId.NUFORC)).toBeNull()
  })

  it('coerces a numeric id to a string', () => {
    const result = parseSighting(rawSighting({ id: 12345 }), DataSourceId.NUFORC)
    expect(result?.id).toBe('12345')
  })

  it('returns null when occurredAt is missing', () => {
    expect(parseSighting(rawSighting({ occurredAt: undefined }), DataSourceId.NUFORC)).toBeNull()
    expect(parseSighting(rawSighting({ occurredAt: '' }), DataSourceId.NUFORC)).toBeNull()
  })

  it('falls back invalid shape to UNKNOWN', () => {
    const result = parseSighting(rawSighting({ shape: 'banana' }), DataSourceId.NUFORC)
    expect(result?.shape).toBe(SightingShape.UNKNOWN)
  })

  it('falls back invalid status to PENDING', () => {
    const result = parseSighting(rawSighting({ status: 'wat' }), DataSourceId.NUFORC)
    expect(result?.status).toBe(SightingStatus.PENDING)
  })

  it('falls back invalid continent to AMERICAS', () => {
    const result = parseSighting(rawSighting({ continent: 'ATLANTIS' }), DataSourceId.NUFORC)
    expect(result?.continent).toBe(Continent.AMERICAS)
  })

  it('uses defaultSource when source is invalid or missing', () => {
    const a = parseSighting(rawSighting({ source: undefined }), DataSourceId.HATCH_UDB)
    const b = parseSighting(rawSighting({ source: 'WHATEVER' }), DataSourceId.HATCH_UDB)
    expect(a?.source).toBe(DataSourceId.HATCH_UDB)
    expect(b?.source).toBe(DataSourceId.HATCH_UDB)
  })

  it('keeps a valid source when provided', () => {
    const result = parseSighting(rawSighting({ source: DataSourceId.CHRONOLOGY }), DataSourceId.NUFORC)
    expect(result?.source).toBe(DataSourceId.CHRONOLOGY)
  })

  it('keeps coordinates only when both lat and lng are numbers', () => {
    expect(parseSighting(rawSighting({ coordinates: { lat: 1, lng: 2 } }), DataSourceId.NUFORC)?.coordinates)
      .toEqual({ lat: 1, lng: 2 })
    expect(parseSighting(rawSighting({ coordinates: { lat: 1 } }), DataSourceId.NUFORC)?.coordinates).toBeNull()
    expect(parseSighting(rawSighting({ coordinates: null }), DataSourceId.NUFORC)?.coordinates).toBeNull()
    expect(parseSighting(rawSighting({ coordinates: 'no' }), DataSourceId.NUFORC)?.coordinates).toBeNull()
  })

  it('clamps credibility to [0, 100]', () => {
    expect(parseSighting(rawSighting({ credibility: 150 }), DataSourceId.NUFORC)?.credibility).toBe(100)
    expect(parseSighting(rawSighting({ credibility: -10 }), DataSourceId.NUFORC)?.credibility).toBe(0)
    expect(parseSighting(rawSighting({ credibility: 'high' }), DataSourceId.NUFORC)?.credibility).toBe(0)
  })

  it('falls back reportedAt and postedAt to occurredAt when missing', () => {
    const result = parseSighting(
      rawSighting({ reportedAt: undefined, postedAt: undefined, occurredAt: '2024-01-01' }),
      DataSourceId.NUFORC
    )
    expect(result?.reportedAt).toBe('2024-01-01')
    expect(result?.postedAt).toBe('2024-01-01')
  })

  it('coerces non-array characteristics to []', () => {
    const result = parseSighting(rawSighting({ characteristics: 'oops' }), DataSourceId.NUFORC)
    expect(result?.characteristics).toEqual([])
  })

  it('keeps tags only when an array, otherwise undefined', () => {
    expect(parseSighting(rawSighting({ tags: ['a', 'b'] }), DataSourceId.NUFORC)?.tags).toEqual(['a', 'b'])
    expect(parseSighting(rawSighting({ tags: 'string' }), DataSourceId.NUFORC)?.tags).toBeUndefined()
    expect(parseSighting(rawSighting({ tags: undefined }), DataSourceId.NUFORC)?.tags).toBeUndefined()
  })

  it('keeps optional strangeness and ref only when correctly typed', () => {
    const result = parseSighting(
      rawSighting({ strangeness: 60, ref: 'NICAP-123' }),
      DataSourceId.NUFORC
    )
    expect(result?.strangeness).toBe(60)
    expect(result?.ref).toBe('NICAP-123')

    const result2 = parseSighting(rawSighting({ strangeness: '60', ref: 999 }), DataSourceId.NUFORC)
    expect(result2?.strangeness).toBeUndefined()
    expect(result2?.ref).toBeUndefined()
  })
})

// ─── parseChunk ─────────────────────────────────────────────────────

describe('parseChunk', () => {
  it('returns [] when input is not an array', async () => {
    expect(await parseChunk({}, DataSourceId.NUFORC)).toEqual([])
    expect(await parseChunk(null, DataSourceId.NUFORC)).toEqual([])
    expect(await parseChunk('string', DataSourceId.NUFORC)).toEqual([])
  })

  it('parses an array, dropping invalid records', async () => {
    const result = await parseChunk(
      [rawSighting({ id: 'a' }), { not: 'a sighting' }, rawSighting({ id: 'b' })],
      DataSourceId.NUFORC
    )
    expect(result).toHaveLength(2)
    expect(result.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('handles datasets that cross the 2000-record yield boundary', async () => {
    const raw = Array.from({ length: 4500 }, (_, i) => rawSighting({ id: `s-${i}` }))
    const result = await parseChunk(raw, DataSourceId.NUFORC)
    expect(result).toHaveLength(4500)
    expect(result[0].id).toBe('s-0')
    expect(result[4499].id).toBe('s-4499')
  })
})

// ─── dataUrl ────────────────────────────────────────────────────────

describe('dataUrl', () => {
  it('prefixes with the resolved BASE_URL and the data dir', () => {
    expect(dataUrl('foo.json')).toBe('/data/foo.json')
  })
})

// ─── sortNewestFirst ────────────────────────────────────────────────

describe('sortNewestFirst', () => {
  it('sorts by occurredAt descending', () => {
    const items = [
      makeSighting('2020-01-01T00:00:00Z', 'old'),
      makeSighting('2024-06-01T00:00:00Z', 'new'),
      makeSighting('2022-03-01T00:00:00Z', 'mid')
    ]
    const result = sortNewestFirst(items)
    expect(result.map(s => s.id)).toEqual(['new', 'mid', 'old'])
  })

  it('mutates the input array in place', () => {
    const items = [
      makeSighting('2020-01-01', 'a'),
      makeSighting('2024-01-01', 'b')
    ]
    const result = sortNewestFirst(items)
    expect(result).toBe(items)
  })
})

// ─── isValidManifest ────────────────────────────────────────────────

describe('isValidManifest', () => {
  it('returns true for a well-formed manifest', () => {
    expect(isValidManifest({
      generatedAt: '2024-01-01',
      totalRecords: 100,
      years: { '1947': { count: 1, file: 'x', sizeKB: 1 } }
    })).toBe(true)
  })

  it('returns false for non-objects', () => {
    expect(isValidManifest(null)).toBe(false)
    expect(isValidManifest(undefined)).toBe(false)
    expect(isValidManifest('string')).toBe(false)
  })

  it('returns false when generatedAt is missing or wrong type', () => {
    expect(isValidManifest({ totalRecords: 1, years: {} })).toBe(false)
    expect(isValidManifest({ generatedAt: 123, totalRecords: 1, years: {} })).toBe(false)
  })

  it('returns false when totalRecords is missing or wrong type', () => {
    expect(isValidManifest({ generatedAt: 'x', years: {} })).toBe(false)
    expect(isValidManifest({ generatedAt: 'x', totalRecords: '1', years: {} })).toBe(false)
  })

  it('returns false when years is missing or null', () => {
    expect(isValidManifest({ generatedAt: 'x', totalRecords: 1 })).toBe(false)
    expect(isValidManifest({ generatedAt: 'x', totalRecords: 1, years: null })).toBe(false)
  })
})

// ─── getChunkKeysForRange ───────────────────────────────────────────

describe('getChunkKeysForRange', () => {
  it('returns numeric keys in range (simpleYears mode)', () => {
    const keys = ['1990', '2000', '2010', '2020']
    expect(getChunkKeysForRange(keys, 2000, 2015, true)).toEqual(['2000', '2010'])
  })

  it('ignores decade and ancient keys in simpleYears mode', () => {
    const keys = ['1947', '1950s', 'ancient']
    expect(getChunkKeysForRange(keys, 1900, 2000, true)).toEqual(['1947'])
  })

  it('includes "ancient" only when fromYear < 1800', () => {
    const keys = ['ancient', '1900']
    expect(getChunkKeysForRange(keys, 1800, 2000)).toEqual(['1900'])
    expect(getChunkKeysForRange(keys, 100, 200)).toEqual(['ancient'])
  })

  it('includes decade keys when their decade overlaps the range', () => {
    const keys = ['1900s', '1950s', '2000s']
    expect(getChunkKeysForRange(keys, 1955, 1965)).toEqual(['1950s'])
    expect(getChunkKeysForRange(keys, 1900, 1909)).toEqual(['1900s'])
    // 1959 is in 1950s, 2000 is in 2000s — both overlap a 1959–2000 range
    expect(getChunkKeysForRange(keys, 1959, 2000)).toEqual(['1950s', '2000s'])
  })

  it('includes numeric year keys in range (complex mode)', () => {
    const keys = ['1947', '1990s', '2024']
    expect(getChunkKeysForRange(keys, 2020, 2025)).toEqual(['2024'])
  })

  it('returns empty array when no keys match', () => {
    expect(getChunkKeysForRange(['2020'], 1900, 1950)).toEqual([])
  })
})
