import { Continent } from '@/enums'

// ─── App metadata ───────────────────────────────────────────────────

export const APP_NAME = 'UAP MONITOR'
export const APP_VERSION = 'v0.1.0'
export const APP_FOOTER = 'UAP MONITOR v0.1.0 — Open-source UAP sighting aggregator'
export const APP_REPO_FALLBACK = 'https://github.com/mhdSid/uap-monitor'

// ─── Aria labels ────────────────────────────────────────────────────

export const ARIA = {
  CLOCK: 'Current UTC time',
  GITHUB: 'View source on GitHub',
  SEARCH: 'Search sighting reports',
  FILTER_SHAPE: 'Filter by shape',
  FILTER_REGION: 'Filter by region',
  FILTER_BAR: 'Filter sighting reports',
  YEAR_FROM: 'From year',
  YEAR_TO: 'To year',
  LOADING: 'Loading sighting data',
  CLOSE_MODAL: 'Close modal',
  DISMISS_ALERT: 'Dismiss alert',
  TICKER: 'Click to scroll to this sighting in the grid',
  TICKER_IDLE: 'UAP Monitor live feed',
  TOOLTIP: 'More info'
} as const

// ─── Continent labels ───────────────────────────────────────────────

export const CONTINENT_LABELS: Record<Continent, string> = {
  [Continent.AMERICAS]: 'AMERICAS',
  [Continent.EUROPE]: 'EUROPE',
  [Continent.EURASIA]: 'EURASIA',
  [Continent.ASIA_MIDDLE_EAST]: 'ASIA — MIDDLE EAST',
  [Continent.ASIA_PACIFIC]: 'ASIA — PACIFIC',
  [Continent.OCEANIA]: 'OCEANIA',
  [Continent.AFRICA]: 'AFRICA'
}

export const CONTINENT_DISPLAY_NAMES: Record<string, string> = {
  AMERICAS: 'Americas',
  EUROPE: 'Europe',
  EURASIA: 'Eurasia',
  ASIA_MIDDLE_EAST: 'Middle East',
  ASIA_PACIFIC: 'Asia-Pacific',
  OCEANIA: 'Oceania',
  AFRICA: 'Africa'
}

// ─── Continent tooltips ─────────────────────────────────────────────

export const CONTINENT_TOOLTIPS: Record<string, string> = {
  [Continent.AMERICAS]: 'Sightings from North, Central, and South America. NUFORC is US-based so this region has the highest volume.',
  [Continent.EUROPE]: 'Sightings from European countries including UK, Turkey, and Caucasus states. GEIPAN (France) integration planned.',
  [Continent.EURASIA]: 'Sightings from Russia — spanning both European and Asian territories. Treated as a separate transcontinental region.',
  [Continent.ASIA_MIDDLE_EAST]: 'Sightings from the Middle East, Central Asia, and South Asia — including Iran, Saudi Arabia, India, Pakistan, and Afghanistan.',
  [Continent.ASIA_PACIFIC]: 'Sightings from East and Southeast Asia including Japan, China, Korea, and ASEAN nations. CJK scraper integration planned.',
  [Continent.OCEANIA]: 'Sightings from Australia, New Zealand, and Pacific Island nations.',
  [Continent.AFRICA]: 'Sightings from African nations. Historically underreported in English-language databases.'
}

export const CONTINENT_EMPTY: Record<string, string> = {
  [Continent.AMERICAS]: 'No sightings in the Americas for current filters.',
  [Continent.EUROPE]: 'No sightings in Europe for current filters. GEIPAN integration will increase coverage.',
  [Continent.EURASIA]: 'No sightings in Eurasia (Russia) for current filters.',
  [Continent.ASIA_MIDDLE_EAST]: 'No sightings in the Middle East for current filters.',
  [Continent.ASIA_PACIFIC]: 'No sightings in Asia-Pacific for current filters. CJK scraper integration planned.',
  [Continent.OCEANIA]: 'No sightings in Oceania for current filters.',
  [Continent.AFRICA]: 'No sightings in Africa for current filters. Coverage is limited in English-language databases.'
}

// ─── Filter & search ────────────────────────────────────────────────

export const FILTER = {
  SEARCH_PLACEHOLDER: 'SEARCH REPORTS...',
  ALL_SHAPES: 'ALL SHAPES',
  ALL_REGIONS: 'ALL REGIONS',
  ALL_COUNTRIES: 'ALL COUNTRIES',
  NO_DATA: 'NO DATA',
  NO_RESULTS: 'NO MATCHING SIGHTINGS',
  EMPTY_DEFAULT: 'No data'
} as const

// ─── Section titles ─────────────────────────────────────────────────

export const SECTION = {
  DATA_SOURCES: 'DATA SOURCES',
  DATA_SOURCES_TOOLTIP: 'Open-source intelligence feeds aggregated by UAP Monitor. Green = live, amber = syncing, grey = planned. Click any source to visit its website.',
  INTEL_TITLE: 'INTELLIGENCE SOURCES',
  INTEL_CONTENT: 'UAP Monitor aggregates data from multiple open-source intelligence feeds. Green indicators are live. Disabled sources are planned integrations — hover any source for details.'
} as const

// ─── Sighting modal labels ──────────────────────────────────────────

export const MODAL = {
  SHAPE: 'Shape',
  LOCATION: 'Location',
  DURATION: 'Duration',
  OBSERVERS: 'Observers',
  CREDIBILITY: 'Credibility',
  STRANGENESS: 'Strangeness',
  OCCURRED: 'Occurred',
  REPORTED: 'Reported',
  SOURCE: 'Source',
  CONTINENT: 'Continent',
  CHARACTERISTICS: 'Characteristics',
  TAGS: 'Tags',
  REFERENCE: 'Reference',
  SUMMARY: 'SUMMARY',
  WITNESS_ACCOUNT: 'WITNESS ACCOUNT',
  EMPTY_VALUE: '—'
} as const

// ─── Ticker ─────────────────────────────────────────────────────────

export const TICKER = {
  GHOST_TEXT: '// ─────',
  PREFIX: '// ',
  DEFAULT_MESSAGES: [
    'Scanning open-source intelligence feeds for new UAP reports...',
    'Aggregating reports from NUFORC database...',
    'Processing witness accounts and credibility scores...',
    'Cross-referencing flight data with sighting coordinates...',
    'Loading 28,000+ researcher chronology records (Eberhart, Johnson, NICAP, Vallée)...',
    'Integrating Blue Book unknowns and historical case files...'
  ],
  DEFAULT_MESSAGES_MULTI: [
    'Monitoring CJK and Russian language sources',
    'for new activity...'
  ]
} as const

// ─── Data sources ───────────────────────────────────────────────────

export const DATA_SOURCE_DESCRIPTIONS = {
  NUFORC: 'National UFO Reporting Center — US-based sighting reports since 1974',
  HATCH_UDB: 'Larry Hatch UDB — 18,000+ researcher-curated cases worldwide (70 AD–2002)',
  NASA_CNEOS: 'NASA Center for Near Earth Object Studies — fireball and bolide data',
  OPENSKY: 'Open flight tracking network — cross-reference sightings with known aircraft',
  GDELT: 'Global Database of Events — UAP-related news from CJK and Russian media',
  AARO: 'All-domain Anomaly Resolution Office — US DoD official UAP investigations',
  GEIPAN: 'French space agency UAP research unit — European sighting database',
  ENIGMA: 'International catalogue of UFO events and encounter classifications',
  CJK_SCRAPER: 'Custom scraper for Chinese, Japanese, and Korean UAP/UFO forums and news'
} as const

// ─── Welcome modal ──────────────────────────────────────────────────

export const WELCOME = {
  TITLE: 'UAP MONITOR',
  SUBTITLE: 'Open-Source Intelligence Platform',
  BODY: [
    'Unidentified Aerial Phenomena are documented across dozens of databases, languages, and decades — scattered, inconsistent, and hard to search. This tool unifies them.',
    'We aggregate, standardize, and surface UAP reports from verified open-source feeds so researchers, journalists, and curious minds can explore the data freely.'
  ],
  CTA: 'BEGIN MONITORING',
  SOURCES_TITLE: 'ACTIVE SOURCES',
  STAT_TIMESPAN: '70 AD–present',
  STAT_TIMESPAN_LABEL: 'Time span',
  STAT_RECORDS: '193,000+',
  STAT_RECORDS_LABEL: 'Records',
  STAT_SOURCES: '12 active',
  STAT_SOURCES_LABEL: 'Sources',
  STAT_OPEN: '100%',
  STAT_OPEN_LABEL: 'Open data',
  CLOSING: 'All data is open. All code is open. The truth should be too.'
} as const

// ─── Errors ─────────────────────────────────────────────────────────

export const ERRORS = {
  UNEXPECTED: 'An unexpected error occurred',
  NUFORC_MANIFEST: 'Malformed NUFORC manifest',
  NUFORC_LOAD: 'Failed to load NUFORC manifest',
  HATCH_MANIFEST: 'Malformed Hatch UDB manifest',
  HATCH_LOAD: 'Failed to load Hatch UDB manifest',
  CHRONOLOGY_MANIFEST: 'Malformed chronology manifest',
  CHRONOLOGY_LOAD: 'Failed to load chronology manifest'
} as const
