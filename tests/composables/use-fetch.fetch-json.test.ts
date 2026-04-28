import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchJson } from '../../src/composables/use-fetch'

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

function badJson (contentType = 'application/json'): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k: string) => k.toLowerCase() === 'content-type' ? contentType : null },
    json: async () => { throw new SyntaxError('bad json') }
  } as unknown as Response
}

// ─── Setup ──────────────────────────────────────────────────────────

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Tests ──────────────────────────────────────────────────────────

describe('fetchJson', () => {
  it('returns the parsed body on success', async () => {
    mockFetch.mockResolvedValueOnce(ok({ hello: 'world' }))
    const result = await fetchJson<{ hello: string }>('/data/x.json')
    expect(result).toEqual({ hello: 'world' })
  })

  it('throws with status, statusText, and url on a failed response', async () => {
    mockFetch.mockResolvedValueOnce(fail(404, 'Not Found'))
    await expect(fetchJson('/data/missing.json')).rejects.toThrow(/HTTP 404: Not Found.*\/data\/missing\.json/)
  })

  it('throws on an unexpected content-type', async () => {
    mockFetch.mockResolvedValueOnce(ok({ a: 1 }, 'application/octet-stream'))
    await expect(fetchJson('/data/x.json')).rejects.toThrow(/Unexpected content-type/)
  })

  it('accepts text/* content-types', async () => {
    mockFetch.mockResolvedValueOnce(ok({ ok: true }, 'text/plain'))
    const result = await fetchJson<{ ok: boolean }>('/data/x.json')
    expect(result.ok).toBe(true)
  })

  it('throws when JSON parsing fails', async () => {
    mockFetch.mockResolvedValueOnce(badJson())
    await expect(fetchJson('/data/x.json')).rejects.toThrow(/Invalid JSON from \/data\/x\.json/)
  })
})

// ─── Chunked reassembly ────────────────────────────────────────────

describe('fetchJson — chunked reassembly', () => {
  it('reassembles a top-level chunked array', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/foo.json') {
        return ok({ __chunked: true, files: ['foo-0.json', 'foo-1.json'], totalItems: 4 })
      }
      if (url === '/data/foo-0.json') return ok([1, 2])
      if (url === '/data/foo-1.json') return ok([3, 4])
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const result = await fetchJson<number[]>('/data/foo.json')
    expect(result).toEqual([1, 2, 3, 4])
  })

  it('reassembles into an envelope when field/envelope are present', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/articles.json') {
        return ok({
          __chunked: true,
          files: ['articles-0.json', 'articles-1.json'],
          totalItems: 3,
          field: 'articles',
          envelope: { generatedAt: '2024-01-01', totalResults: 3 }
        })
      }
      if (url === '/data/articles-0.json') return ok([{ id: 'a' }, { id: 'b' }])
      if (url === '/data/articles-1.json') return ok([{ id: 'c' }])
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const result = await fetchJson<{ generatedAt: string; totalResults: number; articles: { id: string }[] }>(
      '/data/articles.json'
    )
    expect(result).toEqual({
      generatedAt: '2024-01-01',
      totalResults: 3,
      articles: [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    })
  })

  it('throws when a chunk fetch fails', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/data/foo.json') {
        return ok({ __chunked: true, files: ['foo-0.json', 'foo-1.json'], totalItems: 4 })
      }
      if (url === '/data/foo-0.json') return ok([1, 2])
      if (url === '/data/foo-1.json') return fail(500, 'Server Error')
      throw new Error(`Unexpected fetch: ${url}`)
    })

    await expect(fetchJson('/data/foo.json')).rejects.toThrow(/Failed to fetch chunk foo-1\.json: 500/)
  })

  it('resolves chunk URLs relative to the original URL', async () => {
    const seen: string[] = []
    mockFetch.mockImplementation(async (url: string) => {
      seen.push(url)
      if (url.endsWith('/data/nested/index.json')) {
        return ok({ __chunked: true, files: ['part-a.json'], totalItems: 1 })
      }
      if (url.endsWith('/data/nested/part-a.json')) return ok([42])
      throw new Error(`Unexpected fetch: ${url}`)
    })

    await fetchJson('/data/nested/index.json')
    expect(seen).toEqual(['/data/nested/index.json', '/data/nested/part-a.json'])
  })
})
