import { DataSourceId, DataSourceStatus } from '@/enums'
import type { DataSource, Sighting } from '@/types'
import { useNuforc } from './use-nuforc'

const SOURCE_REGISTRY: DataSource[] = [
  { id: DataSourceId.NUFORC, label: 'NUFORC', status: DataSourceStatus.SYNCING },
  { id: DataSourceId.ENIGMA, label: 'ENIGMA', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.NASA_CNEOS, label: 'NASA CNEOS', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.OPENSKY, label: 'OPENSKY', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.GDELT, label: 'GDELT', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.GEIPAN, label: 'GEIPAN', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.CJK_SCRAPER, label: 'CJK SCRAPER', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.AARO, label: 'AARO', status: DataSourceStatus.DISABLED },
]

export function useDataSource() {
  const nuforc = useNuforc()

  async function fetchSightings(): Promise<Sighting[]> {
    const sightings = await nuforc.loadDefault()

    // Update NUFORC source status based on result
    const nuforcSource = SOURCE_REGISTRY.find((s) => s.id === DataSourceId.NUFORC)
    if (nuforcSource) {
      nuforcSource.status = sightings.length > 0
        ? DataSourceStatus.ONLINE
        : DataSourceStatus.OFFLINE
    }

    return sightings
  }

  async function fetchYearRange(from: number, to: number): Promise<Sighting[]> {
    return nuforc.loadYearRange(from, to)
  }

  function getSources(): DataSource[] {
    return SOURCE_REGISTRY
  }

  return {
    fetchSightings,
    fetchYearRange,
    getSources,
    nuforc,
  }
}
