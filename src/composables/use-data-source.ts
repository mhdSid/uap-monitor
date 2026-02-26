import { DataSourceId, DataSourceStatus } from '@/enums'
import type { DataSource, Sighting } from '@/types'
import { useNuforc } from './use-nuforc'
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

  async function fetchProgressive(
    from: number,
    to: number,
    onChunk: (sightings: Sighting[]) => void,
  ): Promise<Sighting[]> {
    const result = await nuforc.loadProgressive(from, to, onChunk)

    const nuforcSource = SOURCE_REGISTRY.find((s) => s.id === DataSourceId.NUFORC)
    if (nuforcSource) {
      nuforcSource.status = result.length > 0
        ? DataSourceStatus.ONLINE
        : DataSourceStatus.OFFLINE
    }

    return result
  }

  function getSources(): DataSource[] {
    return SOURCE_REGISTRY
  }

  return {
    fetchSightings,
    fetchYearRange,
    fetchProgressive,
    getSources,
    nuforc,
  }
}
