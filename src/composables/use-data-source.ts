import { DataSourceId, DataSourceStatus } from '@/enums'
import type { DataSource, Sighting } from '@/types'
import { useNuforc } from './use-nuforc'
import { useHatchUdb } from './use-hatch-udb'
import { DATA_SOURCE_DESCRIPTIONS } from '@/data/strings'

const SOURCE_REGISTRY: DataSource[] = [
  // ── Active ──
  {
    id: DataSourceId.NUFORC,
    label: 'NUFORC',
    status: DataSourceStatus.SYNCING,
    url: 'https://nuforc.org',
    description: DATA_SOURCE_DESCRIPTIONS.NUFORC,
  },
  {
    id: DataSourceId.HATCH_UDB,
    label: 'HATCH *U* DB',
    status: DataSourceStatus.SYNCING,
    url: 'https://github.com/richgel999/ufo_data',
    dataUrl: 'https://raw.githubusercontent.com/richgel999/ufo_data/main/bin/hatch_udb.json',
    description: DATA_SOURCE_DESCRIPTIONS.HATCH_UDB,
  },
  // ── Planned (ordered by integration priority) ──
  {
    id: DataSourceId.NASA_CNEOS,
    label: 'NASA CNEOS',
    status: DataSourceStatus.DISABLED,
    url: 'https://cneos.jpl.nasa.gov/fireballs/',
    description: DATA_SOURCE_DESCRIPTIONS.NASA_CNEOS,
  },
  {
    id: DataSourceId.OPENSKY,
    label: 'OPENSKY',
    status: DataSourceStatus.DISABLED,
    url: 'https://opensky-network.org',
    description: DATA_SOURCE_DESCRIPTIONS.OPENSKY,
  },
  {
    id: DataSourceId.GDELT,
    label: 'GDELT',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.gdeltproject.org',
    description: DATA_SOURCE_DESCRIPTIONS.GDELT,
  },
  {
    id: DataSourceId.AARO,
    label: 'AARO',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.aaro.mil',
    description: DATA_SOURCE_DESCRIPTIONS.AARO,
  },
  {
    id: DataSourceId.GEIPAN,
    label: 'GEIPAN',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.cnes.fr/en/geipan',
    description: DATA_SOURCE_DESCRIPTIONS.GEIPAN,
  },
  {
    id: DataSourceId.ENIGMA,
    label: 'ENIGMA',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.intcat.co.uk',
    description: DATA_SOURCE_DESCRIPTIONS.ENIGMA,
  },
  {
    id: DataSourceId.CJK_SCRAPER,
    label: 'CJK SCRAPER',
    status: DataSourceStatus.DISABLED,
    description: DATA_SOURCE_DESCRIPTIONS.CJK_SCRAPER,
  },
]

function updateSourceStatus(id: DataSourceId, hasData: boolean): void {
  const source = SOURCE_REGISTRY.find((s) => s.id === id)
  if (source) {
    source.status = hasData ? DataSourceStatus.ONLINE : DataSourceStatus.OFFLINE
  }
}

function mergeSorted(a: Sighting[], b: Sighting[]): Sighting[] {
  if (a.length === 0) return b
  if (b.length === 0) return a
  return [...a, ...b].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt))
}

export function useDataSource() {
  const nuforc = useNuforc()
  const hatch = useHatchUdb()

  /**
   * Load both manifests in parallel. Either can fail independently.
   */
  async function loadManifests(): Promise<void> {
    await Promise.allSettled([
      nuforc.loadManifest(),
      hatch.loadManifest(),
    ])
  }

  /**
   * Fetch default sightings (latest 2 years from NUFORC + matching Hatch range).
   */
  async function fetchSightings(): Promise<Sighting[]> {
    const sightings = await nuforc.loadDefault()
    updateSourceStatus(DataSourceId.NUFORC, sightings.length > 0)
    return sightings
  }

  /**
   * Fetch a year range from ALL active sources, merge results.
   */
  async function fetchYearRange(from: number, to: number): Promise<Sighting[]> {
    const [nuforcData, hatchData] = await Promise.all([
      nuforc.loadYearRange(from, to),
      hatch.loadYearRange(from, to),
    ])

    updateSourceStatus(DataSourceId.NUFORC, nuforcData.length > 0)
    updateSourceStatus(DataSourceId.HATCH_UDB, hatchData.length > 0)

    return mergeSorted(nuforcData, hatchData)
  }

  /**
   * Progressive load from both sources. NUFORC loads progressively (newest first),
   * Hatch loads in parallel as a batch (smaller dataset).
   */
  async function fetchProgressive(
    from: number,
    to: number,
    onChunk: (sightings: Sighting[]) => void,
  ): Promise<Sighting[]> {
    // Start Hatch loading in background (non-progressive — smaller dataset)
    const hatchPromise = hatch.loadYearRange(from, to)

    let nuforcAccumulated: Sighting[] = []
    let hatchData: Sighting[] = []
    let hatchDone = false

    // When Hatch resolves, merge into whatever NUFORC has accumulated so far
    hatchPromise.then((data) => {
      hatchData = data
      hatchDone = true
      updateSourceStatus(DataSourceId.HATCH_UDB, data.length > 0)
      if (nuforcAccumulated.length > 0) {
        onChunk(mergeSorted(nuforcAccumulated, hatchData))
      }
    }).catch(() => {
      hatchDone = true
      updateSourceStatus(DataSourceId.HATCH_UDB, false)
    })

    // Progressive NUFORC loading — each chunk triggers a merge with whatever Hatch has
    const nuforcResult = await nuforc.loadProgressive(from, to, (partial) => {
      nuforcAccumulated = partial
      onChunk(hatchDone ? mergeSorted(partial, hatchData) : partial)
    })

    updateSourceStatus(DataSourceId.NUFORC, nuforcResult.length > 0)

    // Final merge — ensure Hatch is included
    if (!hatchDone) {
      hatchData = await hatchPromise
    }

    return mergeSorted(nuforcResult, hatchData)
  }

  /**
   * Union of available years from all active sources (sorted descending).
   */
  function getAvailableYears(): number[] {
    const nuforcYears = nuforc.getAvailableYears()
    const hatchYears = hatch.getAvailableYears()

    const yearSet = new Set<number>([...nuforcYears, ...hatchYears])
    return [...yearSet].sort((a, b) => b - a)
  }

  /**
   * Total record count across all sources.
   */
  function getTotalCount(): number {
    return nuforc.getTotalCount() + hatch.getTotalCount()
  }

  function getSources(): DataSource[] {
    return SOURCE_REGISTRY
  }

  return {
    loadManifests,
    fetchSightings,
    fetchYearRange,
    fetchProgressive,
    getAvailableYears,
    getTotalCount,
    getSources,
    nuforc,
    hatch,
  }
}
