import type { Fireball, FireballCollection, Sighting, GdeltArticle, GnewsArticle, TwitterArticle, RedditArticle } from '@/types'
import { fetchJson, dataUrl } from './use-fetch'

// ─── Geo helpers ────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180
const EARTH_RADIUS_KM = 6371

/** Haversine distance in km between two lat/lng points. */
export function haversineKm (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLng = (lng2 - lng1) * DEG_TO_RAD
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Absolute difference in hours between two ISO date strings. */
function hoursBetween (a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(da - db) / (1000 * 60 * 60)
}

/** Absolute difference in days between two ISO date strings. */
function daysBetween (a: string, b: string): number {
  return hoursBetween(a, b) / 24
}

// ─── Loader ─────────────────────────────────────────────────────────

let cached: Fireball[] | null = null
let cachedCollection: FireballCollection | null = null

export function useFireball () {
  async function load (): Promise<Fireball[]> {
    if (cached) return cached

    try {
      const data = await fetchJson<FireballCollection>(dataUrl('nasa-fireballs.json'))
      cachedCollection = data
      cached = data.fireballs ?? []
      return cached
    } catch {
      cached = []
      return []
    }
  }

  function getCount (): number {
    return cached?.length ?? 0
  }

  function getCollection (): FireballCollection | null {
    return cachedCollection
  }

  function getAll (): Fireball[] {
    return cached ?? []
  }

  // ─── Proximity matching ─────────────────────────────────────────

  /**
   * Find fireballs near a sighting.
   * Default: within 200km and ±72 hours.
   */
  function findNearSighting (
    sighting: Sighting,
    opts?: { maxKm?: number; maxHours?: number }
  ): Fireball[] {
    if (!cached || !sighting.coordinates) return []

    const maxKm = opts?.maxKm ?? 200
    const maxHours = opts?.maxHours ?? 72

    return cached.filter(fb => {
      if (fb.lat == null || fb.lng == null) return false
      const km = haversineKm(
        sighting.coordinates!.lat, sighting.coordinates!.lng,
        fb.lat, fb.lng
      )
      if (km > maxKm) return false
      const hours = hoursBetween(sighting.occurredAt, fb.date)
      return hours <= maxHours
    })
  }

  /**
   * Find news articles related to a sighting by date proximity.
   * Default: within ±7 days.
   */
  function findRelatedNews (
    sighting: Sighting,
    gdeltArticles: GdeltArticle[],
    gnewsArticles: GnewsArticle[],
    twitterArticles: TwitterArticle[],
    redditArticles: RedditArticle[],
    opts?: { maxDays?: number; limit?: number }
  ): { gdelt: GdeltArticle[], gnews: GnewsArticle[], twitterNews: TwitterArticle[], redditNews: RedditArticle[] } {
    const maxDays = opts?.maxDays ?? 7
    const limit = opts?.limit ?? 5

    const gdelt = gdeltArticles
      .filter(a => daysBetween(sighting.occurredAt, a.publishedAt) <= maxDays)
      .slice(0, limit)

    const gnews = gnewsArticles
      .filter(a => daysBetween(sighting.occurredAt, a.publishedAt) <= maxDays)
      .slice(0, limit)

    const twitterNews = twitterArticles
      .filter(a => daysBetween(sighting.occurredAt, a.publishedAt) <= maxDays)
      .slice(0, limit)

    const redditNews = redditArticles
      .filter(a => daysBetween(sighting.occurredAt, a.publishedAt) <= maxDays)
      .slice(0, limit)

    return { gdelt, gnews, twitterNews, redditNews }
  }

  return {
    load,
    getCount,
    getCollection,
    getAll,
    findNearSighting,
    findRelatedNews
  }
}
