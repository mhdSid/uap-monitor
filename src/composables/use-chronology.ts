import type { ChronologyManifest } from '@/types'
import { DataSourceId } from '@/enums'
import { createSourceLoader } from './use-fetch'

// ─── Composable ─────────────────────────────────────────────────────

export interface ChronologySource {
  loadManifest(): Promise<ChronologyManifest | null>
  loadYearRange(fromYear: number, toYear: number): Promise<import('@/types').Sighting[]>
  loadProgressive(
    fromYear: number,
    toYear: number,
    onChunk: (sightings: import('@/types').Sighting[]) => void,
  ): Promise<import('@/types').Sighting[]>
  getAvailableYears(): number[]
  getTotalCount(): number
  getYearCounts(): Map<number, number>
}

let _instance: ChronologySource | null = null

export function useChronology(): ChronologySource {
  if (_instance) return _instance

  const loader = createSourceLoader<ChronologyManifest>({
    manifestFile: 'chronology-manifest.json',
    defaultSource: DataSourceId.CHRONOLOGY,
    label: 'Chronology',
    simpleYears: false,
    validateManifest: (data) => {
      const obj = data as Record<string, unknown>
      return typeof obj.subSources === 'object' && obj.subSources !== null
    },
  })

  _instance = {
    loadManifest: loader.loadManifest,
    loadYearRange: loader.loadYearRange,
    loadProgressive: loader.loadProgressive,
    getAvailableYears: loader.getAvailableYears,
    getTotalCount: loader.getTotalCount,
    getYearCounts: loader.getYearCounts,
  }

  return _instance
}
