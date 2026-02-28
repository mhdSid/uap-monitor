import type { SourceManifest, Sighting } from '@/types'
import { DataSourceId } from '@/enums'
import { useToast } from '@/components/toast'
import { createSourceLoader } from './use-fetch'

// ─── Constants ──────────────────────────────────────────────────────

/** Default: load last 2 years of data on first mount */
const DEFAULT_RANGE_YEARS = 2

// ─── Composable ─────────────────────────────────────────────────────

export function useNuforc() {
  const toast = useToast()

  const loader = createSourceLoader<SourceManifest>({
    manifestFile: 'nuforc-manifest.json',
    defaultSource: DataSourceId.NUFORC,
    label: 'NUFORC',
    simpleYears: true,
    onError: (msg) => toast.error(msg),
  })

  /**
   * Load the default range (latest N years from the manifest).
   */
  async function loadDefault(): Promise<Sighting[]> {
    const m = await loader.loadManifest()
    if (!m) return []

    const availableYears = Object.keys(m.years).map(Number).sort((a, b) => b - a)
    if (availableYears.length === 0) return []

    const latest = availableYears[0]
    const from = latest - DEFAULT_RANGE_YEARS + 1

    return loader.loadYearRange(from, latest)
  }

  return {
    loadManifest: loader.loadManifest,
    loadYearRange: loader.loadYearRange,
    loadProgressive: loader.loadProgressive,
    loadDefault,
    getAvailableYears: loader.getAvailableYears,
    getTotalCount: loader.getTotalCount,
    getYearCounts: loader.getYearCounts,
  }
}
