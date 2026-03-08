import { Continent } from '@/enums'
import { WelcomeSource } from '@/types'

// ─── App metadata ───────────────────────────────────────────────────

export const APP_NAME = 'UAP MONITOR'
export const APP_FOOTER_NAME = 'UAP MONITOR'
export const APP_FOOTER_TAGLINE = 'Global UAP Intelligence Platform'
export const APP_URL = 'https://uapmonitor.org'

// ─── Aria labels ────────────────────────────────────────────────────

export const ARIA = {
  CLOCK: 'Current UTC time',
  SEARCH: 'Search sighting reports',
  FILTER_SHAPE: 'Filter by shape',
  FILTER_REGION: 'Filter by region',
  FILTER_COUNTRY: 'Filter by country',
  FILTER_BAR: 'Filter sighting reports',
  YEAR_FROM: 'From year',
  YEAR_TO: 'To year',
  LOADING: 'Loading sighting data',
  CLOSE_MODAL: 'Close modal',
  DISMISS_ALERT: 'Dismiss alert',
  TICKER: 'Click to scroll to this sighting in the grid',
  TICKER_IDLE: 'UAP Monitor live feed',
  TOOLTIP: 'More info',
  ARTICLE_IMAGE: 'Article thumbnail image',
  VISIT_SOURCE: 'Visit source website',
  THEME_TOGGLE: 'Toggle light and dark mode',
  FILTER_TOGGLE: 'Toggle search filters'
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
  EMPTY_DEFAULT: 'No data',
  SOURCES_LABEL: 'SOURCES'
} as const

// ─── Map layer controls ─────────────────────────────────────────────

export const MAP_LAYERS = {
  SIGHTINGS: 'Sightings',
  FIREBALLS: 'Fireballs'
} as const

export const MAP_INFO = {
  TITLE: 'GEOSPATIAL INTELLIGENCE',
  CONTENT: 'Interactive density map of UAP sighting reports and NASA fireball events. Marker colors indicate data source — green for civilian reports, orange for government sensor data. Cluster numbers reveal concentration hotspots. Cross-referencing coordinates with temporal data exposes patterns invisible in tabular views: recurring locations, proximity to military installations, and correlation with atmospheric bolide events.'
} as const

// ─── Section titles ─────────────────────────────────────────────────

export const SECTION = {
  DATA_SOURCES: 'DATA SOURCES',
  DATA_SOURCES_TOOLTIP: 'Open-source intelligence feeds aggregated by UAP Monitor. Green = live, amber = syncing, grey = planned. Click any source to visit its website.',
  INTEL_TITLE: 'INTELLIGENCE SOURCES',
  INTEL_CONTENT: 'UAP Monitor aggregates data from multiple open-source intelligence feeds. Green indicators are live. Disabled sources are planned integrations — hover any source for details.',
  EXPERIENCER: 'EXPERIENCER REPORTS',
  EXPERIENCER_TOOLTIP: 'Firsthand structural encounter testimony from anonymous experiencers. Source identity protected. Material reviewed for internal consistency and cross-referenced against known observation patterns.',
  GDELT_NEWS: 'GDELT FEED',
  GDELT_NEWS_TOOLTIP: 'Global UAP/UFO media coverage via the GDELT Project. Monitors broadcast, print, and web sources across 100+ languages with sentiment analysis.',
  GNEWS: 'GNEWS FEED',
  GNEWS_TOOLTIP: 'Latest UAP/UFO news aggregated from 60,000+ worldwide sources via GNews. English-language articles sorted by recency.',
  INTEL_FEED: 'INTELLIGENCE FEED',
  INTEL_FEED_TOOLTIP: 'Unified UAP/UFO news from two sources: GDELT Project (broadcast, print, and web across 100+ languages with sentiment analysis) and GNews (60,000+ worldwide sources, English-language). Merged and sorted by date.',
  SIGHTING_REPORTS: 'SIGHTING REPORTS'
} as const

export const GDELT_TONE_BANDS = {
  VERY_POSITIVE: { min: 5, label: 'VERY POSITIVE', color: 'positive' },
  POSITIVE:      { min: 0, max: 5, label: 'POSITIVE', color: 'positive-dim' },
  NEUTRAL:       { min: -1, max: 1, label: 'NEUTRAL', color: 'neutral' },
  NEGATIVE:      { min: -5, max: 0, label: 'NEGATIVE', color: 'negative-dim' },
  VERY_NEGATIVE: { max: -5, label: 'VERY NEGATIVE', color: 'negative' }
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

// ─── Related content (sighting modal) ───────────────────────────────

export const RELATED = {
  FIREBALLS_TITLE: 'RELATED FIREBALLS',
  FIREBALLS_EMPTY: 'No NASA fireball events within 200 km / 72 hrs',
  NEWS_TITLE: 'RELATED NEWS',
  NEWS_EMPTY: 'No related news articles within ±7 days',
  FIREBALL_ENERGY: 'Energy',
  FIREBALL_IMPACT: 'Impact',
  FIREBALL_ALTITUDE: 'Alt',
  FIREBALL_VELOCITY: 'Vel',
  FIREBALL_DISTANCE: 'Distance',
  FIREBALL_ENERGY_UNIT: ' J×10¹⁰',
  FIREBALL_IMPACT_UNIT: ' kt',
  FIREBALL_ALTITUDE_UNIT: ' km',
  FIREBALL_VELOCITY_UNIT: ' km/s',
  FIREBALL_DISTANCE_UNIT: ' km'
} as const

// ─── GDELT modal labels ────────────────────────────────────────────

export const GDELT_MODAL = {
  SOURCE: 'Source',
  PUBLISHED: 'Published',
  LANGUAGE: 'Language',
  COUNTRY: 'Country',
  TONE: 'Tone',
  URL: 'URL',
  FOOTER_PREFIX: 'GDELT',
  FOOTER_SEPARATOR: ' · ',
  EMPTY_VALUE: '—',
  IMAGE_ALT: 'Article thumbnail',
  VIEW_SOURCE: 'View source article'
} as const

// ─── GDELT grid ─────────────────────────────────────────────────────

export const GDELT_GRID = {
  EMPTY: 'No GDELT articles available.',
  EMPTY_FILTERED: 'No articles match current filters.'
} as const

// ─── GNews modal labels ─────────────────────────────────────────────

export const GNEWS_MODAL = {
  SOURCE: 'Source',
  PUBLISHED: 'Published',
  DESCRIPTION: 'Description',
  URL: 'URL',
  FOOTER_PREFIX: 'GNews',
  FOOTER_SEPARATOR: ' · ',
  EMPTY_VALUE: '—',
  IMAGE_ALT: 'Article thumbnail',
  VIEW_SOURCE: 'View source article'
} as const

// ─── GNews grid ─────────────────────────────────────────────────────

export const GNEWS_GRID = {
  EMPTY: 'No GNews articles available.',
  EMPTY_FILTERED: 'No articles match current filters.'
} as const

export const INTEL_FEED = {
  EMPTY: 'No articles available.',
  EMPTY_FILTERED: 'No articles match current filters.',
  SOURCE_GDELT: 'GDELT',
  SOURCE_GNEWS: 'GNews'
} as const

// ─── Vessel viewer ──────────────────────────────────────────────────

export const VESSEL = {
  TITLE: 'FRACTAL VESSEL',
  AUTO_ROTATE: '↻ AUTO',
  MODE_SPHERE: 'SPHERE',
  MODE_DISC: 'DISC',
  MODE_FRACTAL: 'FRACTAL',
  MODE_SPINE: 'SPINE',
  MODE_TRANSIT: 'TRANSIT',
  INFO_SPHERE: '~800 blades · 400–900m diameter · overlapping shell',
  INFO_DISC: 'Flattened configuration · ~200–400m · low profile',
  INFO_FRACTAL: 'Fully extended · blades at max reach · starburst',
  INFO_SPINE: 'Acceleration survival · ~2km axial extension',
  INFO_TRANSIT: 'Singularity ring · spacetime deformation · FTL'
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
  GNEWS: 'GNews — UAP/UFO news aggregation from 60,000+ worldwide sources via API',
  AARO: 'All-domain Anomaly Resolution Office — US DoD official UAP investigations',
  GEIPAN: 'French space agency UAP research unit — European sighting database',
  ENIGMA: 'International catalogue of UFO events and encounter classifications',
  CJK_SCRAPER: 'Custom scraper for Chinese, Japanese, and Korean UAP/UFO forums and news',
  EXPERIENCER: 'Firsthand structural encounter testimony from vetted experiencer sources'
} as const

// ─── Welcome modal ──────────────────────────────────────────────────

export const WELCOME = {
  TITLE: 'UAP MONITOR',
  SUBTITLE: 'Global UAP Intelligence Platform',
  BODY: [
    'Unidentified Aerial Phenomena are documented across dozens of databases, languages, and decades — scattered, inconsistent, and hard to search. This platform unifies them.',
    'We aggregate, standardize, and surface UAP reports from verified intelligence feeds so researchers, journalists, and curious minds can explore the data freely.'
  ],
  CTA: 'BEGIN MONITORING',
  SOURCES_TITLE: 'ACTIVE SOURCES',
  STAT_TIMESPAN: '70 AD–present',
  STAT_TIMESPAN_LABEL: 'Time span',
  STAT_RECORDS: '230,000+',
  STAT_RECORDS_LABEL: 'Records',
  STAT_SOURCES: '15 active',
  STAT_SOURCES_LABEL: 'Sources',
  STAT_COVERAGE: 'Global',
  STAT_COVERAGE_LABEL: 'Coverage',
  CLOSING: 'Transparency drives understanding. All data is open. The truth should be too.'
} as const

export const HERO = {
  TAGLINE: 'Global UAP/UFO Sighting Intelligence',
  CTA: 'EXPLORE MAP',
  STAT_SIGHTINGS: 'Sightings',
  STAT_SOURCES: 'Sources',
  STAT_YEARS: 'Years of Data'
} as const


export const ACTIVE_SOURCES: WelcomeSource[] = [
  { name: 'NUFORC',              records: '195K',  period: '1974–2026', tier: 'high' },
  { name: 'Hatch *U* Database',  records: '18K',   period: '1942–2003', tier: 'high' },
  { name: 'Eberhart Timeline',   records: '5.9K',  period: '70 AD–2024', tier: 'high' },
  { name: 'NICAP',               records: '5.2K',  period: '1942–1975', tier: 'high' },
  { name: 'Pre-Roswell (Rife)',  records: '5K',    period: '1880–1947', tier: 'base' },
  { name: 'Johnson UFOCAT',      records: '4.1K',  period: '1900–2004', tier: 'mid' },
  { name: 'Overmeire Catalogue', records: '4K',    period: '500 BC–2005', tier: 'base' },
  { name: 'Vallée (Magonia)',    records: '923',   period: '1868–1968', tier: 'high' },
  { name: 'Blue Book Unknowns',  records: '700+',  period: '1947–1969', tier: 'high' },
  { name: 'Hall (UFO Evidence)', records: '600+',  period: '1947–2003', tier: 'high' },
  { name: 'Wonders in the Sky',  records: '500+',  period: '70 AD–1879', tier: 'base' },
  { name: 'Dolan',               records: '300+',  period: '1941–2003', tier: 'mid' },
  { name: 'GDELT News',          records: 'Live',  period: 'Daily',     tier: 'mid' },
  { name: 'GNews',               records: 'Live',  period: 'Daily',     tier: 'mid' }
]

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

// ─── Historical highlights ──────────────────────────────────────────

export const HIGHLIGHTS = {
  TITLE: 'HISTORICAL CASES',
  NO_MATCH: 'Sighting not found in current dataset.',
  EXPANDING: 'Loading historical data...',
  ITEMS: [
    {
      year: '1663',
      location: 'Lake Robozero, Russia',
      headline: 'Monastery monks recorded a 40-meter flaming sphere hovering over a lake for two hours. Water illuminated to the bottom.',
      searchKey: 'Robozero'
    },
    {
      year: '1908',
      location: 'Tunguska, Siberia',
      headline: '80 million trees flattened across 2,150 km\u00B2. No impact crater ever found. Cause remains debated.',
      searchKey: 'Tunguska'
    },
    {
      year: '1947',
      location: 'Roswell, New Mexico',
      headline: 'Debris recovered from a ranch. Military initially announced a "flying disc" then retracted to weather balloon. Became the defining UFO case.',
      searchKey: 'Roswell'
    },
    {
      year: '1952',
      location: 'Washington, D.C.',
      headline: 'UFOs tracked on radar over the U.S. Capitol on two consecutive weekends. Fighter jets scrambled.',
      searchKey: 'Washington'
    },
    {
      year: '1977',
      location: 'Petrozavodsk, Russia',
      headline: 'Jellyfish-shaped object emitted light rays over the city. Circular holes melted through apartment windows.',
      searchKey: 'Petrozavodsk'
    },
    {
      year: '1988',
      location: 'Dalnegorsk, Hill 611',
      headline: 'Sphere crashed into a hilltop. Scientists recovered 17-micron metallic mesh interwoven with gold wire.',
      searchKey: 'Dalnegorsk'
    },
    {
      year: '1989',
      location: 'Voronezh, Russia',
      headline: 'TASS reported 9-foot, three-eyed beings in a city park. Police confirmed. Ground radiation 2x above baseline.',
      searchKey: 'Voronezh'
    },
    {
      year: '2004',
      location: 'USS Nimitz, Pacific',
      headline: 'Navy pilots tracked a Tic Tac-shaped object performing impossible maneuvers. FLIR footage later declassified.',
      searchKey: 'Nimitz'
    },
    {
      year: '2023',
      location: 'Leningrad Oblast, Russia',
      headline: 'Object near nuclear plant. Military confirmed: no engines, not a drone. Fighter jets scrambled. Airspace closed.',
      searchKey: 'Sosnovy Bor'
    }
  ]
} as const

export const TAGS = {
  LIVE: 'LIVE'
} as const

export const SUB_SOURCE_LABELS: Record<string, string> = {
  EBERHART: 'Eberhart',
  JOHNSON: 'Johnson',
  NICAP: 'NICAP',
  VALLEE_MAGONIA: 'Vallée (Magonia)',
  BB_UNKNOWNS: 'Blue Book Unknowns',
  OVERMEIRE: 'Overmeire',
  HALL: 'Hall (UFO Evidence)',
  WONDERS_SKY: 'Wonders in the Sky',
  PRE_ROSWELL: 'Pre-Roswell (Rife)',
  DOLAN: 'Dolan',
  RUSSIAN_HISTORICAL: 'Russian Historical'
} as const
