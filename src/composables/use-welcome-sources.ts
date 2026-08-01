import type {
  ChronologyManifest,
  FireballCollection,
  NuclearCollection,
  GdeltCollection,
  GnewsCollection,
  TwitterCollection,
  RedditCollection,
  ManifestSource,
  WelcomeData,
  WelcomeSource,
  WelcomeStats
} from '@/types'

// ─── Chronology sub-source display metadata ──────────────────────────

const CHRONOLOGY_ORDER: string[] = [
  'EBERHART',
  'NICAP',
  'VALLEE_MAGONIA',
  'BB_UNKNOWNS',
  'HALL',
  'JOHNSON',
  'DOLAN',
  'WONDERS_SKY',
  'PRE_ROSWELL',
  'OVERMEIRE'
]

const CHRONOLOGY_META: Record<string, { name: string; period: string; tier: WelcomeSource['tier'] }> = {
  EBERHART: { name: 'Eberhart Timeline', period: '70 AD–2024', tier: 'high' },
  NICAP: { name: 'NICAP', period: '1942–1975', tier: 'high' },
  VALLEE_MAGONIA: { name: 'Vallée (Magonia)', period: '1868–1968', tier: 'high' },
  BB_UNKNOWNS: { name: 'Blue Book Unknowns', period: '1947–1969', tier: 'high' },
  HALL: { name: 'Hall (UFO Evidence)', period: '1947–2003', tier: 'high' },
  JOHNSON: { name: 'Johnson UFOCAT', period: '1900–2004', tier: 'mid' },
  DOLAN: { name: 'Dolan', period: '1941–2003', tier: 'mid' },
  WONDERS_SKY: { name: 'Wonders in the Sky', period: '70 AD–1879', tier: 'base' },
  PRE_ROSWELL: { name: 'Pre-Roswell (Rife)', period: '1880–1947', tier: 'base' },
  OVERMEIRE: { name: 'Overmeire Catalogue', period: '500 BC–2005', tier: 'base' }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatSourceCount (n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function formatRecordCount (n: number): string {
  const floored = Math.floor(n / 1_000) * 1_000
  return `${floored.toLocaleString()}+`
}

function formatYear (year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`
  if (year < 100) return `${year} AD`
  return `${year}`
}

function yearRangeStr (years: number[]): string {
  if (years.length === 0) return 'unknown'
  const min = years[years.length - 1]
  const max = years[0]
  return min === max ? `${min}` : `${min}–${max}`
}

function formatGeneratedDate (value?: string): string {
  if (!value) return 'Daily'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// ─── Main export ──────────────────────────────────────────────────────

/**
 * Derive live stats + source list from loaded manifests and article collections.
 * Called once all network requests have settled inside WelcomeModal.
 */
export function useDeriveWelcomeData (params: {
  nuforc: ManifestSource
  hatch: ManifestSource
  geipan: ManifestSource
  chronology: ManifestSource
  dowPursue: ManifestSource
  chronologyManifest: ChronologyManifest | null
  gdeltCollection: GdeltCollection | null
  gnewsCollection: GnewsCollection | null
  twitterCollection: TwitterCollection | null
  redditCollection: RedditCollection | null
  fireballCollection: FireballCollection | null
  nuclearCollection: NuclearCollection | null
}): WelcomeData {
  const {
    nuforc,
    hatch,
    geipan,
    chronology,
    dowPursue,
    chronologyManifest,
    gdeltCollection,
    gnewsCollection,
    twitterCollection,
    redditCollection,
    fireballCollection,
    nuclearCollection
  } = params

  // ── Stats ────────────────────────────────────────────────────────

  const allYears = [
    ...nuforc.getAvailableYears(),
    ...hatch.getAvailableYears(),
    ...geipan.getAvailableYears(),
    ...chronology.getAvailableYears(),
    ...dowPursue.getAvailableYears()
  ]

  const oldestYear = allYears.length > 0 ? Math.min(...allYears) : 1974
  const timespan = `${formatYear(oldestYear)}–present`

  const totalRecords = nuforc.getTotalCount() + hatch.getTotalCount() + geipan.getTotalCount() + chronology.getTotalCount() + dowPursue.getTotalCount()
  const records = totalRecords > 0 ? formatRecordCount(totalRecords) : '230,000+'

  const subSourceCount = chronologyManifest
    ? Object.keys(chronologyManifest.subSources).length
    : 0

  const activeCount =
    (nuforc.getTotalCount() > 0 ? 1 : 0) +
    (hatch.getTotalCount() > 0 ? 1 : 0) +
    (geipan.getTotalCount() > 0 ? 1 : 0) +
    subSourceCount +
    (dowPursue.getTotalCount() > 0 ? 1 : 0) +
    (gdeltCollection != null ? 1 : 0) +
    (gnewsCollection != null ? 1 : 0) +
    (twitterCollection != null ? 1 : 0) +
    (redditCollection != null ? 1 : 0) +
    (fireballCollection != null ? 1 : 0) +
    (nuclearCollection != null ? 1 : 0)

  const sources = activeCount > 0 ? `${activeCount} active` : '15 active'

  const stats: WelcomeStats = {
    timespan,
    records,
    sources,
    coverage: 'Global'
  }

  // ── Source list ──────────────────────────────────────────────────

  const sourceList: WelcomeSource[] = []

  const nuforcCount = nuforc.getTotalCount()
  const nuforcYears = nuforc.getAvailableYears()
  sourceList.push({
    name: 'NUFORC',
    records: nuforcCount > 0 ? formatSourceCount(nuforcCount) : '~195K',
    period: nuforcYears.length > 0 ? yearRangeStr(nuforcYears) : '1974–present',
    tier: 'high'
  })

  const hatchCount = hatch.getTotalCount()
  sourceList.push({
    name: 'Hatch *U* Database',
    records: hatchCount > 0 ? formatSourceCount(hatchCount) : '~18K',
    period: '1942–2003',
    tier: 'high'
  })

  const geipanCount = geipan.getTotalCount()
  const geipanYears = geipan.getAvailableYears()
  sourceList.push({
    name: 'GEIPAN',
    records: geipanCount > 0 ? formatSourceCount(geipanCount) : '~2.8K',
    period: geipanYears.length > 0 ? yearRangeStr(geipanYears) : '1937–present',
    tier: 'high'
  })

  if (chronologyManifest?.subSources) {
    const subSources = chronologyManifest.subSources

    for (const key of CHRONOLOGY_ORDER) {
      const meta = CHRONOLOGY_META[key]
      if (!meta) continue

      const sub = subSources[key]
      sourceList.push({
        name: meta.name,
        records: sub ? formatSourceCount(sub.count) : '—',
        period: meta.period,
        tier: meta.tier
      })
    }

    for (const [key, sub] of Object.entries(subSources)) {
      if (CHRONOLOGY_ORDER.includes(key)) continue

      sourceList.push({
        name: sub.label,
        records: formatSourceCount(sub.count),
        period: '—',
        tier: 'base'
      })
    }
  }

  const dowCount = dowPursue.getTotalCount()
  const dowYears = dowPursue.getAvailableYears()
  sourceList.push({
    name: 'DoW / PURSUE',
    records: dowCount > 0 ? formatSourceCount(dowCount) : '—',
    period: dowYears.length > 0 ? yearRangeStr(dowYears) : '1944–2023',
    tier: 'high'
  })

  const gdeltCount = gdeltCollection?.totalResults
  sourceList.push({
    name: 'GDELT News',
    records: gdeltCount != null ? `${formatSourceCount(gdeltCount)} articles` : 'Live',
    period: formatGeneratedDate(gdeltCollection?.generatedAt),
    tier: 'mid'
  })

  const gnewsCount = gnewsCollection?.totalResults
  sourceList.push({
    name: 'GNews',
    records: gnewsCount != null ? `${formatSourceCount(gnewsCount)} articles` : 'Live',
    period: formatGeneratedDate(gnewsCollection?.generatedAt),
    tier: 'mid'
  })

  const twitterCount = twitterCollection?.totalResults
  sourceList.push({
    name: 'X / Twitter',
    records: twitterCount != null ? `${formatSourceCount(twitterCount)} posts` : 'Live',
    period: formatGeneratedDate(twitterCollection?.generatedAt),
    tier: 'mid'
  })

  const redditCount = redditCollection?.totalResults
  sourceList.push({
    name: 'Reddit',
    records: redditCount != null ? `${formatSourceCount(redditCount)} posts` : 'Live',
    period: formatGeneratedDate(redditCollection?.generatedAt),
    tier: 'mid'
  })

  const fireballCount = fireballCollection?.totalResults
  sourceList.push({
    name: 'NASA CNEOS Fireballs',
    records: fireballCount != null ? `${formatSourceCount(fireballCount)} events` : '900+',
    period: '1988–present',
    tier: 'high'
  })

  // Nuclear Facilities
  const nuclearCount = nuclearCollection?.totalResults
  sourceList.push({
    name: 'Nuclear Facilities',
    records: nuclearCount != null ? `${formatSourceCount(nuclearCount)} sites` : '140+',
    period: 'Current',
    tier: 'mid'
  })

  return { stats, sources: sourceList }
}
