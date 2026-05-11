import type { SourceManifest } from '@/types'
import { DataSourceId } from '@/enums'
import { createSourceLoader } from './use-fetch'

// ─── Composable ─────────────────────────────────────────────────────

export function useGeipan () {
  const loader = createSourceLoader<SourceManifest>({
    manifestFile: 'geipan-manifest.json',
    defaultSource: DataSourceId.GEIPAN,
    label: 'GEIPAN',
    simpleYears: false
  })

  return {
    loadManifest: loader.loadManifest,
    loadYearRange: loader.loadYearRange,
    loadProgressive: loader.loadProgressive,
    getAvailableYears: loader.getAvailableYears,
    getTotalCount: loader.getTotalCount,
    getYearCounts: loader.getYearCounts
  }
}
