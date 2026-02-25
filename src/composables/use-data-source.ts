import { DataSourceId, DataSourceStatus } from '@/enums'
import type { DataSource, Sighting } from '@/types'
import { useAsyncAction } from './use-async-action'
import { getSightings } from '@/data/sightings'

const SOURCE_REGISTRY: DataSource[] = [
  { id: DataSourceId.NUFORC, label: 'NUFORC', status: DataSourceStatus.ONLINE },
  { id: DataSourceId.ENIGMA, label: 'ENIGMA', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.NASA_CNEOS, label: 'NASA CNEOS', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.OPENSKY, label: 'OPENSKY', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.GDELT, label: 'GDELT', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.GEIPAN, label: 'GEIPAN', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.CJK_SCRAPER, label: 'CJK SCRAPER', status: DataSourceStatus.DISABLED },
  { id: DataSourceId.AARO, label: 'AARO', status: DataSourceStatus.DISABLED },
]

function simulateLatency<T>(data: T, ms = 800): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

export function useDataSource() {
  const sightingsAction = useAsyncAction<Sighting[]>()

  async function fetchSightings(): Promise<Sighting[]> {
    let result: Sighting[] = []
    await sightingsAction.execute(
      () => simulateLatency(getSightings()),
      (data) => { result = data },
    )
    return result
  }

  function getSources(): DataSource[] {
    return SOURCE_REGISTRY
  }

  return {
    fetchSightings,
    getSources,
    sightingsState: sightingsAction.state,
  }
}
