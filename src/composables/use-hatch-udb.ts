import type { SourceManifest } from '@/types'
import { DataSourceId } from '@/enums'
import { createSourceLoader } from './use-fetch'

// ─── Composable ─────────────────────────────────────────────────────

export function useHatchUdb() {
  const loader = createSourceLoader<SourceManifest>({
    manifestFile: 'hatch-manifest.json',
    defaultSource: DataSourceId.HATCH_UDB,
    label: 'Hatch UDB',
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
