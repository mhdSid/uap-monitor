import type { Sighting, SightingFilter } from '@/types'
import { yieldThread } from './use-timing'

/**
 * Non-blocking filter that processes sightings in chunks,
 * yielding to the main thread between chunks to keep UI responsive.
 */
export async function filterSightings(
  all: Sighting[],
  filter: SightingFilter
): Promise<Sighting[]> {
  const hasFilter = filter.search || filter.shape || filter.continent || filter.minCredibility || filter.country || filter.sources

  if (!hasFilter) return all

  const searchLower = filter.search?.toLowerCase()
  const result: Sighting[] = []

  const CHUNK = 5000
  for (let i = 0; i < all.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, all.length)
    for (let j = i; j < end; j++) {
      const s = all[j]
      if (searchLower) {
        const match =
          s.summary.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower) ||
          s.region.toLowerCase().includes(searchLower) ||
          s.country.toLowerCase().includes(searchLower) ||
          s.location.toLowerCase().includes(searchLower) ||
          s.shape.toLowerCase().includes(searchLower) ||
          s.source.toLowerCase().includes(searchLower) ||
          (s.tags && s.tags.some(t => t.toLowerCase().includes(searchLower)))
        if (!match) continue
      }
      if (filter.shape && s.shape !== filter.shape) continue
      if (filter.continent && s.continent !== filter.continent) continue
      if (filter.country && s.country !== filter.country) continue
      if (filter.minCredibility && s.credibility < filter.minCredibility) continue
      if (filter.sources && !filter.sources.has(s.source)) continue
      result.push(s)
    }

    if (end < all.length) await yieldThread()
  }

  return result
}
