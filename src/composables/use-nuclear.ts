/**
 * useNuclear — load and query nuclear facilities dataset.
 *
 * Usage:
 *   const nuclear = useNuclear()
 *   await nuclear.load()
 *   const nearby = nuclear.findNearSighting(sighting, 150)
 */

import type { NuclearFacility, NuclearCollection, Sighting } from '@/types'
import { haversineKm } from './use-fireball'

const DATA_FILE = 'nuclear-facilities.json'
const DATA_DIR = '/data/'

let cached: NuclearFacility[] | null = null
let cachedCollection: NuclearCollection | null = null

export interface NearbyFacility {
  facility: NuclearFacility
  distanceKm: number
}

export function useNuclear () {
  async function load (): Promise<NuclearFacility[]> {
    if (cached) return cached

    try {
      const url = DATA_DIR + DATA_FILE
      const res = await fetch(url)
      const data: NuclearCollection = await res.json()
      cachedCollection = data
      cached = data.facilities ?? []
      return cached
    } catch {
      cached = []
      return []
    }
  }

  function getAll (): NuclearFacility[] {
    return cached ?? []
  }

  function getCollection (): NuclearCollection | null {
    return cachedCollection
  }

  /**
   * Find nuclear facilities within `radiusKm` of a sighting.
   * Returns sorted by distance (nearest first).
   */
  function findNearSighting (sighting: Sighting, radiusKm = 150): NearbyFacility[] {
    if (!cached || !sighting.coordinates) return []

    const { lat, lng } = sighting.coordinates
    const results: NearbyFacility[] = []

    for (const facility of cached) {
      const km = haversineKm(lat, lng, facility.lat, facility.lng)
      if (km <= radiusKm) {
        results.push({ facility, distanceKm: Math.round(km) })
      }
    }

    results.sort((a, b) => a.distanceKm - b.distanceKm)
    return results
  }

  return { load, getAll, getCollection, findNearSighting }
}
