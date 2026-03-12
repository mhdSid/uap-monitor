import { DataSourceId, DataSourceStatus } from '@/enums'
import type { DataSource, Sighting } from '@/types'
import { useNuforc } from './use-nuforc'
import { useHatchUdb } from './use-hatch-udb'
import { useChronology } from './use-chronology'
import { DATA_SOURCE_DESCRIPTIONS } from '@/data/strings'

// ─── Chronology sub-source definitions ──────────────────────────────
// Static metadata for the 10 researcher chronologies. Status is updated
// dynamically after the combined manifest loads.

const CHRONOLOGY_SUB_SOURCES: DataSource[] = [
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'EBERHART',
    label: 'Eberhart',
    status: DataSourceStatus.SYNCING,
    url: 'http://www.cufos.org/pdfs/UFOsandIntelligence.pdf',
    description: 'George Eberhart — UFOs and Intelligence: A Timeline (70 AD–present)'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'JOHNSON',
    label: 'Johnson',
    status: DataSourceStatus.SYNCING,
    url: 'https://web.archive.org/web/http://www.ufoinfo.com/onthisday/calendar.html',
    description: 'Dr. Donald Johnson — UFOCAT-style date-based sighting database'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'NICAP',
    label: 'NICAP',
    status: DataSourceStatus.SYNCING,
    url: 'http://www.nicap.org/NSID/NSID_DBListingbyDate.pdf',
    description: 'National Investigations Committee on Aerial Phenomena — sighting database'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'VALLEE_MAGONIA',
    label: 'Vallée (Magonia)',
    status: DataSourceStatus.SYNCING,
    url: 'https://archive.org/details/passporttomagoni0000vall',
    description: 'Jacques Vallée — Passport to Magonia: close encounters 1868–1968'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'BB_UNKNOWNS',
    label: 'Blue Book Unknowns',
    status: DataSourceStatus.SYNCING,
    url: 'https://github.com/richgel999/uap_resources/blob/main/bluebook_uncensored_unknowns_don_berliner.pdf',
    description: 'Project Blue Book — official USAF unexplained cases (Don Berliner list)'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'OVERMEIRE',
    label: 'Overmeire',
    status: DataSourceStatus.SYNCING,
    url: 'https://web.archive.org/web/20060107070423/http://users.skynet.be/sky84985/chrono.html',
    description: 'Godelieve Van Overmeire — Belgian/French chronological catalogue'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'HALL',
    label: 'Hall (UFO Evidence)',
    status: DataSourceStatus.SYNCING,
    url: 'https://www.amazon.com/UFO-Evidence-Richard-Hall/dp/0760706271',
    description: 'Richard H. Hall — The UFO Evidence, Vols. I & II'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'WONDERS_SKY',
    label: 'Wonders in the Sky',
    status: DataSourceStatus.SYNCING,
    url: 'https://archive.org/details/JacquesValleeChrisAubeckWondersInTheSkyUnexplainedAerialObjectsFromAntiquityToModernTimes',
    description: 'Vallée & Aubeck — aerial phenomena from antiquity to 1879'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'PRE_ROSWELL',
    label: 'Pre-Roswell (Rife)',
    status: DataSourceStatus.SYNCING,
    url: 'https://archive.org/details/it-didnt-start-with-roswell-50-years-of-amazing-ufo-crashes-close-encounters-and',
    description: "Philip L. Rife — It Didn't Start with Roswell: pre-1947 cases"
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'DOLAN',
    label: 'Dolan',
    status: DataSourceStatus.SYNCING,
    url: 'https://archive.org/details/ufosnationalsecu00dola',
    description: 'Richard Dolan — UFOs and the National Security State chronology'
  },
  {
    id: DataSourceId.CHRONOLOGY,
    subSourceId: 'RUSSIAN_HISTORICAL',
    label: 'Russian',
    status: DataSourceStatus.SYNCING,
    url: 'https://www.cia.gov/readingroom/docs/DOC_0005517761.pdf',
    description: 'Russian Historical — Curated from FBIS/CIA declassified reports, Soviet media archives, and verified researcher compilations (1663–present)',
    dataUrl: '/data/russian-historical.json'
  }
]

// ─── Primary source registry ────────────────────────────────────────

const SOURCE_REGISTRY: DataSource[] = [
  // ── Active ──
  {
    id: DataSourceId.NUFORC,
    label: 'NUFORC',
    status: DataSourceStatus.SYNCING,
    url: 'https://nuforc.org',
    description: DATA_SOURCE_DESCRIPTIONS.NUFORC
  },
  {
    id: DataSourceId.HATCH_UDB,
    label: 'HATCH UDB',
    status: DataSourceStatus.SYNCING,
    url: 'https://github.com/richgel999/ufo_data',
    description: DATA_SOURCE_DESCRIPTIONS.HATCH_UDB
  },

  // ── Chronology sub-sources (all share DataSourceId.CHRONOLOGY) ──
  ...CHRONOLOGY_SUB_SOURCES,

  // ── Planned (ordered by integration priority) ──
  {
    id: DataSourceId.NASA_CNEOS,
    label: 'NASA CNEOS',
    status: DataSourceStatus.SYNCING,
    url: 'https://cneos.jpl.nasa.gov/fireballs/',
    description: DATA_SOURCE_DESCRIPTIONS.NASA_CNEOS,
    dataUrl: '/data/nasa-fireballs.json',
    dataLabel: 'JSON'
  },
  {
    id: DataSourceId.OPENSKY,
    label: 'OPENSKY',
    status: DataSourceStatus.DISABLED,
    url: 'https://opensky-network.org',
    description: DATA_SOURCE_DESCRIPTIONS.OPENSKY
  },
  {
    id: DataSourceId.GDELT,
    label: 'GDELT',
    status: DataSourceStatus.SYNCING,
    url: 'https://www.gdeltproject.org',
    description: DATA_SOURCE_DESCRIPTIONS.GDELT,
    dataUrl: '/data/gdelt-articles.json',
    dataLabel: 'JSON'
  },
  {
    id: DataSourceId.GNEWS,
    label: 'GNews',
    status: DataSourceStatus.SYNCING,
    url: 'https://gnews.io',
    description: DATA_SOURCE_DESCRIPTIONS.GNEWS,
    dataUrl: '/data/gnews-articles.json',
    dataLabel: 'JSON'
  },
  {
    id: DataSourceId.TWITTER,
    label: 'X / Twitter',
    status: DataSourceStatus.SYNCING,
    url: 'https://x.com',
    description: DATA_SOURCE_DESCRIPTIONS.TWITTER,
    dataUrl: '/data/twitter-articles.json',
    dataLabel: 'JSON'
  },
  {
    id: DataSourceId.REDDIT,
    label: 'Reddit',
    status: DataSourceStatus.SYNCING,
    url: 'https://www.reddit.com/r/UFOs/',
    description: DATA_SOURCE_DESCRIPTIONS.REDDIT,
    dataUrl: '/data/reddit-articles.json'
  },
  {
    id: DataSourceId.AARO,
    label: 'AARO',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.aaro.mil',
    description: DATA_SOURCE_DESCRIPTIONS.AARO
  },
  {
    id: DataSourceId.GEIPAN,
    label: 'GEIPAN',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.cnes.fr/en/geipan',
    description: DATA_SOURCE_DESCRIPTIONS.GEIPAN
  },
  {
    id: DataSourceId.ENIGMA,
    label: 'ENIGMA',
    status: DataSourceStatus.DISABLED,
    url: 'https://www.intcat.co.uk',
    description: DATA_SOURCE_DESCRIPTIONS.ENIGMA
  },
  {
    id: DataSourceId.CJK_SCRAPER,
    label: 'CJK SCRAPER',
    status: DataSourceStatus.DISABLED,
    description: DATA_SOURCE_DESCRIPTIONS.CJK_SCRAPER
  }
]

function updateSourceStatus (id: DataSourceId, hasData: boolean): void {
  const newStatus = hasData ? DataSourceStatus.ONLINE : DataSourceStatus.OFFLINE
  for (const source of SOURCE_REGISTRY) {
    if (source.id === id) {
      source.status = newStatus
    }
  }
}

function mergeSorted (a: Sighting[], b: Sighting[]): Sighting[] {
  if (a.length === 0) return b
  if (b.length === 0) return a
  return [...a, ...b].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt))
}

export function useDataSource () {
  const nuforc = useNuforc()
  const hatch = useHatchUdb()
  const chronology = useChronology()

  /**
   * Load all manifests in parallel. Each can fail independently.
   */
  async function loadManifests (): Promise<void> {
    await Promise.allSettled([
      nuforc.loadManifest(),
      hatch.loadManifest(),
      chronology.loadManifest().then((m) => {
        // Update all chronology sub-source statuses based on manifest load
        updateSourceStatus(DataSourceId.CHRONOLOGY, m !== null && m.totalRecords > 0)
      })
    ])
  }

  /**
   * Fetch default sightings (latest 2 years from NUFORC + matching Hatch range).
   */
  async function fetchSightings (): Promise<Sighting[]> {
    const sightings = await nuforc.loadDefault()
    updateSourceStatus(DataSourceId.NUFORC, sightings.length > 0)
    return sightings
  }

  /**
   * Fetch a year range from ALL active sources, merge results.
   */
  async function fetchYearRange (from: number, to: number): Promise<Sighting[]> {
    const [nuforcData, hatchData, chronData] = await Promise.all([
      nuforc.loadYearRange(from, to),
      hatch.loadYearRange(from, to),
      chronology.loadYearRange(from, to)
    ])

    updateSourceStatus(DataSourceId.NUFORC, nuforcData.length > 0)
    updateSourceStatus(DataSourceId.HATCH_UDB, hatchData.length > 0)

    return mergeSorted(mergeSorted(nuforcData, hatchData), chronData)
  }

  /**
   * Progressive load from all sources. NUFORC loads progressively (newest first),
   * Hatch and Chronology load in parallel as batches (smaller/historical datasets).
   */
  async function fetchProgressive (
    from: number,
    to: number,
    onChunk: (sightings: Sighting[]) => void
  ): Promise<Sighting[]> {
    // Start Hatch + Chronology loading in background (non-progressive)
    const hatchPromise = hatch.loadYearRange(from, to)
    const chronPromise = chronology.loadYearRange(from, to)

    let nuforcAccumulated: Sighting[] = []
    let hatchData: Sighting[] = []
    let chronData: Sighting[] = []
    let hatchDone = false
    let chronDone = false

    // When Hatch resolves, merge into whatever NUFORC has accumulated so far
    hatchPromise.then((data) => {
      hatchData = data
      hatchDone = true
      updateSourceStatus(DataSourceId.HATCH_UDB, data.length > 0)
      if (nuforcAccumulated.length > 0) {
        const merged = mergeSorted(mergeSorted(nuforcAccumulated, hatchData), chronData)
        onChunk(merged)
      }
    }).catch(() => {
      hatchDone = true
      updateSourceStatus(DataSourceId.HATCH_UDB, false)
    })

    // When Chronology resolves, merge into accumulated
    chronPromise.then((data) => {
      chronData = data
      chronDone = true
      if (nuforcAccumulated.length > 0) {
        const merged = mergeSorted(mergeSorted(nuforcAccumulated, hatchData), chronData)
        onChunk(merged)
      }
    }).catch(() => {
      chronDone = true
    })

    // Progressive NUFORC loading — each chunk triggers a merge with whatever else has loaded
    const nuforcResult = await nuforc.loadProgressive(from, to, (partial) => {
      nuforcAccumulated = partial
      const merged = mergeSorted(mergeSorted(partial, hatchData), chronData)
      onChunk(merged)
    })

    updateSourceStatus(DataSourceId.NUFORC, nuforcResult.length > 0)

    // Final merge — ensure all sources are included
    if (!hatchDone) hatchData = await hatchPromise
    if (!chronDone) chronData = await chronPromise

    return mergeSorted(mergeSorted(nuforcResult, hatchData), chronData)
  }

  /**
   * Union of available years from all active sources (sorted descending).
   */
  function getAvailableYears (): number[] {
    const nuforcYears = nuforc.getAvailableYears()
    const hatchYears = hatch.getAvailableYears()
    const chronYears = chronology.getAvailableYears()

    const yearSet = new Set<number>([...nuforcYears, ...hatchYears, ...chronYears])
    return [...yearSet].sort((a, b) => b - a)
  }

  /**
   * Total record count across all sources.
   */
  function getTotalCount (): number {
    return nuforc.getTotalCount() + hatch.getTotalCount() + chronology.getTotalCount()
  }

  /**
   * Merged year counts from all source manifests (for timeline density).
   */
  function getYearCounts (): Map<number, number> {
    const merged = new Map<number, number>()
    for (const source of [nuforc.getYearCounts(), hatch.getYearCounts(), chronology.getYearCounts()]) {
      for (const [year, count] of source) {
        merged.set(year, (merged.get(year) || 0) + count)
      }
    }
    return merged
  }

  function getSources (): DataSource[] {
    return SOURCE_REGISTRY
  }

  return {
    loadManifests,
    fetchSightings,
    fetchYearRange,
    fetchProgressive,
    getAvailableYears,
    getTotalCount,
    getYearCounts,
    getSources,
    nuforc,
    hatch,
    chronology
  }
}

/**
 * Look up the URL for a data source (or sub-source).
 * Usable outside the composable lifecycle.
 */
export function getSourceUrl (sourceId: string, subSourceId?: string): string | undefined {
  for (const s of SOURCE_REGISTRY) {
    if (s.id === sourceId) {
      if (subSourceId && s.subSourceId === subSourceId) return s.url
      if (!subSourceId && !s.subSourceId) return s.url
    }
  }
  return undefined
}
