import type { ChronologyManifest, GdeltCollection, GnewsCollection, WelcomeSource } from '@/types'

// ─── Chronology sub-source display metadata ──────────────────────────
// Defines the render order + static display props (period, tier, name)
// for each key in ChronologyManifest.subSources. Record counts come
// from the live manifest response.

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
  EBERHART:       { name: 'Eberhart Timeline',   period: '70 AD–2024',  tier: 'high' },
  NICAP:          { name: 'NICAP',               period: '1942–1975',   tier: 'high' },
  VALLEE_MAGONIA: { name: 'Vallée (Magonia)',     period: '1868–1968',   tier: 'high' },
  BB_UNKNOWNS:    { name: 'Blue Book Unknowns',  period: '1947–1969',   tier: 'high' },
  HALL:           { name: 'Hall (UFO Evidence)', period: '1947–2003',   tier: 'high' },
  JOHNSON:        { name: 'Johnson UFOCAT',       period: '1900–2004',   tier: 'mid'  },
  DOLAN:          { name: 'Dolan',               period: '1941–2003',   tier: 'mid'  },
  WONDERS_SKY:    { name: 'Wonders in the Sky',  period: '70 AD–1879',  tier: 'base' },
  PRE_ROSWELL:    { name: 'Pre-Roswell (Rife)',  period: '1880–1947',   tier: 'base' },
  OVERMEIRE:      { name: 'Overmeire Catalogue', period: '500 BC–2005', tier: 'base' }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${Math.round(n / 1_000)}K`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function yearRangeStr(years: number[]): string {
  if (years.length === 0) return 'unknown'
  const min = years[years.length - 1]
  const max = years[0]
  return min === max ? `${min}` : `${min}–${max}`
}

// ─── Manifest-source interface ────────────────────────────────────────
// A minimal interface matching useNuforc / useHatchUdb return shapes
// so we don't couple this utility to concrete composables.

export interface ManifestSource {
  getTotalCount(): number
  getAvailableYears(): number[]
}

// ─── Main export ──────────────────────────────────────────────────────

/**
 * Derive a live WelcomeSource[] from loaded manifests + article collections.
 * Falls back to readable placeholder strings if a source didn't load.
 */
export function useDeriveWelcomeSources(params: {
  nuforc: ManifestSource
  hatch: ManifestSource
  chronologyManifest: ChronologyManifest | null
  gdeltCollection: GdeltCollection | null
  gnewsCollection: GnewsCollection | null
}): WelcomeSource[] {
  const { nuforc, hatch, chronologyManifest, gdeltCollection, gnewsCollection } = params
  const sources: WelcomeSource[] = []

  // ── NUFORC ──────────────────────────────────────────────────────
  const nuforcCount = nuforc.getTotalCount()
  const nuforcYears = nuforc.getAvailableYears()
  sources.push({
    name: 'NUFORC',
    records: nuforcCount > 0 ? formatCount(nuforcCount) : '~195K',
    period: nuforcYears.length > 0 ? yearRangeStr(nuforcYears) : '1974–present',
    tier: 'high'
  })

  // ── Hatch *U* Database ──────────────────────────────────────────
  const hatchCount = hatch.getTotalCount()
  sources.push({
    name: 'Hatch *U* Database',
    records: hatchCount > 0 ? formatCount(hatchCount) : '~18K',
    period: '1942–2003',
    tier: 'high'
  })

  // ── Chronology sub-sources (from manifest, ordered) ─────────────
  if (chronologyManifest?.subSources) {
    const subSources = chronologyManifest.subSources

    for (const key of CHRONOLOGY_ORDER) {
      const meta = CHRONOLOGY_META[key]
      if (!meta) continue
      const sub = subSources[key]
      sources.push({
        name: meta.name,
        records: sub ? formatCount(sub.count) : '—',
        period: meta.period,
        tier: meta.tier
      })
    }

    // Surface any sub-sources the manifest has that aren't in our list
    for (const [key, sub] of Object.entries(subSources)) {
      if (CHRONOLOGY_ORDER.includes(key)) continue
      sources.push({
        name: sub.label,
        records: formatCount(sub.count),
        period: '—',
        tier: 'base'
      })
    }
  }

  // ── GDELT ───────────────────────────────────────────────────────
  const gdeltCount = gdeltCollection?.totalResults
  sources.push({
    name: 'GDELT News',
    records: gdeltCount != null ? `${formatCount(gdeltCount)} articles` : 'Live',
    period: gdeltCollection?.generatedAt
      ? new Date(gdeltCollection.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Daily',
    tier: 'mid'
  })

  // ── GNews ───────────────────────────────────────────────────────
  const gnewsCount = gnewsCollection?.totalResults
  sources.push({
    name: 'GNews',
    records: gnewsCount != null ? `${formatCount(gnewsCount)} articles` : 'Live',
    period: gnewsCollection?.generatedAt
      ? new Date(gnewsCollection.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Daily',
    tier: 'mid'
  })

  return sources
}
