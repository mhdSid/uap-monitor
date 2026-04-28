import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Continent, DataSourceId, SightingShape, SightingStatus } from '../../src/enums'
import type { SourceManifest } from '../../src/types'

// ─── Toast mock (useNuforc imports useToast at module load) ─────────

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('@/components/toast', () => ({
  useToast: () => ({
    info: vi.fn(),
    success: vi.fn(),
    error: toastError
  })
}))

// ─── Response helpers ───────────────────────────────────────────────

function ok (body: unknown, contentType = 'application/json'): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k: string) => k.toLowerCase() === 'content-type' ? contentType : null },
    json: async () => body
  } as unknown as Response
}

function fail (status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: { get: () => null },
    json: async () => ({})
  } as unknown as Response
}

// ─── Fixtures ───────────────────────────────────────────────────────

function rawSighting (id: string, occurredAt: string): Record<string, unknown> {
  return {
    id,
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
    credibility: 50
  }
}

function manifestWithYears (years: number[], totalRecords = 100): SourceManifest {
  const yMap: Record<string, { count: number; file: string; sizeKB: number }> = {}
  for (const y of years) yMap[String(y)] = { count: 1, file: `${y}.json`, sizeKB: 1 }
  return { generatedAt: '2024-01-01', totalRecords, years: yMap }
}

// ─── Setup ──────────────────────────────────────────────────────────

const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetModules()
  mockFetch.mockReset()
  toastError.mockClear()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Tests ──────────────────────────────────────────────────────────

describe('useNuforc — loadDefault', () => {
  it('loads the latest 2 calendar years from the manifest', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('nuforc-manifest.json')) {
        return ok(manifestWithYears([2020, 2021, 2022, 2023, 2024]))
      }
      if (url.endsWith('2024.json')) return ok([rawSighting('s24', '2024-06-01')])
      if (url.endsWith('2023.json')) return ok([rawSighting('s23', '2023-06-01')])
      throw new Error(`Unexpected: ${url}`)
    })

    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    const result = await nf.loadDefault()

    expect(result.map(s => s.id).sort()).toEqual(['s23', 's24'])
    // Earlier years should not be requested
    const requested = mockFetch.mock.calls.map((c: unknown[]) => c[0])
    expect(requested).not.toContain(expect.stringContaining('2022.json'))
  })

  it('handles a manifest with a single year', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.endsWith('nuforc-manifest.json')) return ok(manifestWithYears([2024]))
      if (url.endsWith('2024.json')) return ok([rawSighting('s', '2024-06-01')])
      throw new Error(`Unexpected: ${url}`)
    })

    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    const result = await nf.loadDefault()
    expect(result.map(s => s.id)).toEqual(['s'])
  })

  it('returns [] when manifest cannot be loaded', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    expect(await nf.loadDefault()).toEqual([])
  })

  it('returns [] when manifest has no years', async () => {
    mockFetch.mockResolvedValue(ok(manifestWithYears([])))
    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    expect(await nf.loadDefault()).toEqual([])
  })

  it('reports manifest errors via toast', async () => {
    mockFetch.mockResolvedValue(fail(500, 'Down'))
    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    await nf.loadDefault()
    expect(toastError).toHaveBeenCalledOnce()
  })
})

describe('useNuforc — pass-through API surface', () => {
  it('exposes the loader API', async () => {
    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    expect(typeof nf.loadManifest).toBe('function')
    expect(typeof nf.loadYearRange).toBe('function')
    expect(typeof nf.loadProgressive).toBe('function')
    expect(typeof nf.getAvailableYears).toBe('function')
    expect(typeof nf.getTotalCount).toBe('function')
    expect(typeof nf.getYearCounts).toBe('function')
  })

  it('getAvailableYears returns numeric keys sorted descending after manifest load', async () => {
    mockFetch.mockResolvedValueOnce(ok(manifestWithYears([2020, 2024, 2022])))
    const { useNuforc } = await import('@/composables/use-nuforc')
    const nf = useNuforc()
    await nf.loadManifest()
    expect(nf.getAvailableYears()).toEqual([2024, 2022, 2020])
  })
})
