import { Continent } from '@/enums'
import { WelcomeSource } from '@/types'

// ─── App metadata ───────────────────────────────────────────────────

export const APP_NAME = 'UAP MONITOR'
export const APP_FOOTER_NAME = 'UAP MONITOR'
export const APP_FOOTER_TAGLINE = 'Global UAP Intelligence Platform'
export const APP_URL = import.meta.env.VITE_REPO_URL

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
  VISIT_ON_X: 'View tweet on X',
  VISIT_ON_REDDIT: 'View post on Reddit',
  THEME_TOGGLE: 'Toggle light and dark mode',
  FILTER_TOGGLE: 'Toggle search filters',
  CLEAR_SEARCH: 'Clear search',
  SEARCH_SIGHTINGS: 'Search sighting reports',
  SEARCH_INTEL: 'Search intelligence articles',
  OPEN_BOOKMARKS: 'Open saved sightings',
  SIGHTING_ACTIONS: 'Sighting actions',
  SHARE_SIGHTING: 'Share sighting',
  SUBMIT_SIGHTING: 'Open sighting report form',
  SUBMIT_DATE: 'Date of sighting',
  SUBMIT_LOCATION: 'Sighting location',
  SUBMIT_SHAPE: 'Object shape',
  SUBMIT_DURATION: 'Sighting duration',
  SUBMIT_OBSERVERS: 'Number of observers',
  SUBMIT_TITLE: 'Sighting title',
  SUBMIT_DESCRIPTION: 'Sighting description',
  SUBMIT_EMAIL: 'Contact email'
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
  FIREBALLS: 'Fireballs',
  NUCLEAR: 'Nuclear Sites'
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
  INTEL_FEED: 'INTELLIGENCE NEWS FEED',
  INTEL_FEED_TOOLTIP: 'Unified UAP/UFO intelligence feed combining four sources: GDELT Project (global broadcast, print, and web monitoring across 100+ languages with sentiment analysis), GNews (international news coverage), X/Twitter (real-time public sightings and researcher posts), and Reddit (community eyewitness reports and discussions). Results are merged and sorted chronologically.',
  SIGHTING_REPORTS: 'SIGHTING REPORTS',
  SUBMIT_SIGHTING: 'REPORT A SIGHTING',
  SUBMIT_SIGHTING_TOOLTIP: 'Submit a firsthand UAP sighting report. No account required. All submissions are reviewed before being added to the dataset.'
} as const

export const GDELT_TONE_BANDS = {
  VERY_POSITIVE: { min: 5, label: 'VERY POSITIVE', color: 'positive' },
  POSITIVE:      { min: 0, max: 5, label: 'POSITIVE', color: 'positive-dim' },
  NEUTRAL:       { min: -1, max: 1, label: 'NEUTRAL', color: 'neutral' },
  NEGATIVE:      { min: -5, max: 0, label: 'NEGATIVE', color: 'negative-dim' },
  VERY_NEGATIVE: { max: -5, label: 'VERY NEGATIVE', color: 'negative' }
} as const

// Action Menu
export const ACTION_MENU_LABELS = {
  REMOVE_BOOKMARK: 'Remove bookmark',
  SHARE: 'Share'
}

// Toast
export const TOAST_MESSAGES = {
  BOOKARK_REMOVED: 'BOOKMARK REMOVED',
  SHARED: 'SHARED',
  LINK_COPIED: 'LINK COPIED',
  SHARE_ERROR: 'COULD NOT SHARE'
}

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
  NUCLEAR_TITLE: 'NEARBY NUCLEAR FACILITIES',
  NUCLEAR_EMPTY: 'No nuclear facilities within 150 km',
  NUCLEAR_TYPE_REACTOR: 'Reactor',
  NUCLEAR_TYPE_WEAPONS_LAB: 'Weapons Lab',
  NUCLEAR_TYPE_TEST_SITE: 'Test Site',
  NUCLEAR_TYPE_ENRICHMENT: 'Enrichment',
  NUCLEAR_TYPE_RESEARCH: 'Research',
  NUCLEAR_TYPE_REPROCESSING: 'Reprocessing',
  NUCLEAR_TYPE_STORAGE: 'Storage',
  NUCLEAR_TYPE_DECOMMISSIONED: 'Decommissioned',
  NUCLEAR_DISTANCE_UNIT: ' km',
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

// ─── Twitter modal ──────────────────────────────────────────────────

export const TWITTER_MODAL = {
  AUTHOR: 'Author',
  PUBLISHED: 'Published',
  ENGAGEMENT: 'Engagement',
  FOOTER_PREFIX: 'X',
  FOOTER_SEPARATOR: ' · ',
  EMPTY_VALUE: '—',
  IMAGE_ALT: 'Tweet media',
  VIEW_ON_X: 'View on X',
  LIKES: 'likes',
  REPOSTS: 'reposts',
  REPLIES: 'replies',
  VERIFIED: 'Verified'
} as const

// ─── Reddit modal ──────────────────────────────────────────────────

export const REDDIT_MODAL = {
  SUBREDDIT: 'Subreddit',
  AUTHOR: 'Author',
  PUBLISHED: 'Published',
  DOMAIN: 'Domain',
  FOOTER_PREFIX: 'Reddit',
  FOOTER_SEPARATOR: ' · ',
  EMPTY_VALUE: '—',
  IMAGE_ALT: 'Reddit post preview',
  VIEW_ON_REDDIT: 'View on Reddit',
  SCORE: 'score',
  COMMENTS: 'comments'
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
  SOURCE_GNEWS: 'GNews',
  SOURCE_TWITTER: 'X',
  SOURCE_REDDIT: 'Reddit',
  SEARCH_PLACEHOLDER: 'SEARCH ARTICLES...'
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
  TWITTER: 'X / Twitter — real-time public posts from UAP witnesses and researchers',
  NUCLEAR: 'Nuclear facilities worldwide — reactors, weapons labs, test sites, enrichment and reprocessing plants from IAEA, NRC, and public records',
  REDDIT: 'Reddit — public eyewitness posts and discussion threads from UAP/UFO communities',
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
  STAT_YEARS: 'Years of Data',
  STAT_HYPOTHESES: 'Hypotheses Confirmed',
  STAT_HYPOTHESES_VALUE: '6/8'
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

export const BOOKMARKS = {
  TITLE: 'SAVED SIGHTINGS',
  EMPTY: 'No saved sightings yet. Tap the radar icon on any sighting to save it here.',
  CLEAR: 'CLEAR ALL',
  CLEAR_CONFIRM: 'Remove all saved sightings?',
  CLEARED: 'ALL BOOKMARKS CLEARED'
} as const

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark'
} as const

// Submit Form
export const SUBMIT_FORM = {
  MODAL_TITLE: 'REPORT A SIGHTING',
  MODAL_SUBTITLE: 'Your report is *anonymous*. No account required.',
  DATE_LABEL: 'DATE OF SIGHTING',
  LOCATION_LABEL: 'LOCATION',
  LOCATION_PLACEHOLDER: 'City, State, Country',
  SHAPE_LABEL: 'SHAPE',
  SHAPE_DEFAULT: 'Select shape...',
  DURATION_LABEL: 'DURATION',
  DURATION_PLACEHOLDER: 'e.g. 30 seconds, 5 minutes',
  OBSERVERS_LABEL: 'OBSERVERS',
  OBSERVERS_PLACEHOLDER: '1',
  TITLE_LABEL: 'TITLE',
  TITLE_PLACEHOLDER: 'Add a title to what you saw.',
  DESCRIPTION_LABEL: 'DESCRIPTION',
  DESCRIPTION_PLACEHOLDER: 'Describe what you saw — direction, altitude, movement pattern, color, sounds, any details you remember.',
  EMAIL_LABEL: 'CONTACT EMAIL',
  EMAIL_PLACEHOLDER: 'Optional — for follow-up questions only',
  EMAIL_HINT: 'Optional. Never shared publicly. Used only if we need to verify details.',
  SUBMIT_LABEL: 'SUBMIT REPORT',
  SUCCESS_ICON: '✓',
  SUCCESS_MESSAGE: 'Report submitted. Thank you for contributing to the global UAP dataset. Your submission will be reviewed and added.',
  TOAST_SUCCESS: 'SIGHTING REPORT SUBMITTED',
  ERROR_REQUIRED: 'Please fill in all required fields (date, location, shape, description).',
  ERROR_GENERIC: 'Submission failed. Please try again.',
  ERROR_NETWORK: 'Network error. Check your connection and try again.'
} as const

export const HEADER = {
  SUBMIT_CTA: '+ REPORT'
} as const

// ─── Navigation ─────────────────────────────────────────────────────

export const NAV = {
  MONITOR: 'MONITOR',
  GEOMAGNETIC: 'GEOMAGNETIC',
  SEISMIC: 'SEISMIC',
  INTEL: 'INTEL FEED',
  SPIRITUAL: 'SPIRITUAL',
  RESEARCH: 'RESEARCH'
} as const

// ─── Geomagnetic visualizer ─────────────────────────────────────────

export const GEOMAGNETIC = {
  TITLE: 'GEOMAGNETIC CORRELATION',
  SUBTITLE: 'Kp index vs UAP sighting density — testing geomagnetic storm correlation',
  SOURCE: 'GFZ Potsdam (CC BY 4.0)',
  STAT_TOTAL: 'TOTAL SIGHTINGS',
  STAT_STORM_PCT: 'DURING Kp ≥ 5',
  STAT_AVG_KP: 'AVG Kp',
  STAT_PEAK_KP: 'PEAK Kp',
  STAT_OVERREP: 'OVERREP.',
  STAT_OVERREP_SUB: 'at Kp ≥ 5 vs expected',
  TIMELINE_TITLE: 'TEMPORAL CORRELATION',
  TIMELINE_SUBTITLE: 'Monthly Kp index vs sighting density',
  DIST_TITLE: 'SIGHTING DISTRIBUTION BY Kp',
  DIST_SUBTITLE: 'Observed sighting counts per Kp level vs expected from random distribution',
  LEGEND_CALM: 'CALM (Kp < 5)',
  LEGEND_STORM: 'STORM (Kp ≥ 5)',
  LABEL_KP_INDEX: 'Kp INDEX',
  LABEL_SIGHTINGS: 'SIGHTINGS',
  LABEL_OBSERVED: 'OBSERVED',
  LABEL_EXPECTED: 'EXPECTED',
  NO_DATA: 'No geomagnetic data available',
  LOADING: 'Loading geomagnetic data...'
} as const

// ─── Seismic visualizer ─────────────────────────────────────────────

export const SEISMIC = {
  TITLE: 'SEISMIC CORRELATION',
  SUBTITLE: 'Earthquake proximity vs UAP sightings — identifying earthquake light candidates',
  SOURCE: 'USGS Earthquake Hazards Program',
  STAT_PAIRS: 'CORRELATED PAIRS',
  STAT_PAIRS_SUB: 'sighting ↔ quake',
  STAT_EQL: 'EQL CANDIDATES',
  STAT_EQL_SUB: '< 120km, < 48h, M4.5+',
  STAT_AVG_DIST: 'AVG DISTANCE',
  STAT_AVG_DIST_SUB: 'sighting to epicenter',
  STAT_AVG_MAG: 'AVG MAGNITUDE',
  STAT_AVG_MAG_SUB: 'correlated quakes',
  SCATTER_TITLE: 'PROXIMITY-TIME SCATTER',
  SCATTER_SUBTITLE: 'Each dot is a sighting–earthquake pair',
  SCATTER_X: 'HOURS RELATIVE TO QUAKE',
  SCATTER_Y: 'DISTANCE (km)',
  TABLE_TITLE: 'STRONGEST CORRELATIONS',
  TABLE_SUBTITLE: 'Earthquakes with the most UAP sightings within 300 km / 72 hours',
  TABLE_COL_LOCATION: 'LOCATION',
  TABLE_COL_MAG: 'MAG',
  TABLE_COL_DATE: 'DATE',
  TABLE_COL_SIGHTINGS: 'SIGHTINGS',
  TABLE_COL_DIST: 'AVG DIST',
  LEGEND_PAIR: 'CORRELATED PAIR',
  LEGEND_EQL: 'EQL CANDIDATE ZONE',
  NOTE_BLUE_LABEL: 'Correlated pair:',
  NOTE_BLUE_DESC: 'UAP sighting that occurred near an earthquake within 300 km / 72 hours.',
  NOTE_ORANGE_LABEL: 'EQL candidate:',
  NOTE_ORANGE_DESC: 'Sighting within 120 km and 48 hours of an M4.5+ shallow quake — potential earthquake light.',
  NOTE_SIZE_LABEL: 'Dot size:',
  NOTE_SIZE_DESC: 'Scaled by earthquake magnitude.',
  TABLE_NOTE: 'Showing earthquakes with at least one nearby UAP sighting',
  NO_DATA: 'No seismic data available',
  NO_PAIRS: 'No sighting–earthquake correlations for this year range',
  LOADING: 'Loading seismic data...',
  POSSIBLE_EQL: 'POSSIBLE EQL'
} as const

// ─── Sighting modal — environmental context ─────────────────────────

export const ENV_CONTEXT = {
  TITLE: 'ENVIRONMENTAL CONTEXT',
  GEOMAGNETIC_LABEL: 'Geomagnetic',
  SEISMIC_LABEL: 'Seismic Activity',
  KP_LABEL: 'Kp',
  KP_STORM: 'STORM',
  KP_CALM: 'CALM',
  KP_MODERATE: 'MODERATE',
  NO_KP_DATA: 'No Kp data for this date',
  NO_SEISMIC: 'No earthquakes within 300 km / 72 hrs',
  EQL_FLAG: 'Possible earthquake lights'
} as const

// ─── Spiritual realm ────────────────────────────────────────────────

export const SPIRITUAL = {
  TITLE: 'SPIRITUAL REALM',
  SUBTITLE: 'Immersive consciousness exploration field — enter the beyond',
  ENTER: 'ENTER THE FIELD',
  ENTER_SUB: 'Breathe deeply. Release control.',
  EXIT: 'EXIT REALM',
  HUD_FREQUENCY: 'FREQUENCY',
  HUD_COHERENCE: 'COHERENCE',
  HUD_DEPTH: 'DEPTH',
  HUD_FIELD: 'FIELD STRENGTH',
  CONTROL_SPEED: 'FLOW SPEED',
  CONTROL_COMPLEXITY: 'FRACTAL DEPTH',
  CONTROL_ZOOM: 'ZOOM DEPTH',
  CONTROL_PALETTE: 'SPECTRUM',
  CONTROL_GEOMETRY: 'GEOMETRY',
  CONTROL_MODE: 'RENDER MODE',
  PALETTE_COSMIC: 'COSMIC',
  PALETTE_ETHEREAL: 'ETHEREAL',
  PALETTE_SOLAR: 'SOLAR',
  PALETTE_VOID: 'VOID',
  GEO_FLOWER: 'FLOWER',
  GEO_YANTRA: 'YANTRA',
  GEO_METATRON: 'METATRON',
  GEO_TORUS: 'TORUS',
  MODE_FRACTAL: 'FRACTAL',
  MODE_TUNNEL: 'TUNNEL',
  MODE_MANDELBROT: 'MANDELBROT',
  MODE_FIELD: 'FIELD',
  MODE_WORMHOLE: 'WORMHOLE',
  FAB_LABEL: 'Open realm controls',
  DRAWER_CLOSE: 'Close controls'
} as const

// ─── Data export ────────────────────────────────────────────────────

export const EXPORT = {
  ARIA_MENU: 'Export sighting data',
  CSV: 'Export CSV',
  JSON: 'Export JSON',
  TOAST_CSV: 'CSV DOWNLOADED',
  TOAST_JSON: 'JSON DOWNLOADED'
} as const

// ─── Research view ─────────────────────────────────────────────────

export const HYPOTHESIS_MODAL = {
  SECTION_DESCRIPTION: 'HYPOTHESIS',
  SECTION_DATASETS: 'DATASETS',
  SECTION_RESULT: 'RESULT',
  SECTION_ALGORITHM: 'ALGORITHM',
  DATASETS_LABEL: 'Required datasets',
  EFFECT_LABEL: 'Effect size',
  CHI_LABEL: 'χ²',
  SUMMARY_LABEL: 'Summary',
  NOT_SUPPORTED_NOTE: 'This hypothesis was tested and not supported by the data.'
} as const

// ─── Research view ─────────────────────────────────────────────────

export const RESEARCH = {
  TITLE: 'RESEARCH & METHODOLOGY',
  SUBTITLE: 'Statistical hypothesis testing across 200K+ sighting reports and five environmental datasets.',
  STAT_TOTAL: 'HYPOTHESES TESTED',
  STAT_SUPPORTED: 'SUPPORTED',
  STAT_DATASETS: 'DATASETS',
  STAT_SIGHTINGS: 'SIGHTINGS ANALYZED',
  CARD_SUPPORTED: 'SUPPORTED',
  CARD_NOT_SUPPORTED: 'NOT SUPPORTED',
  CARD_EFFECT: 'Effect',
  CARD_CHI: 'χ²',
  LOADING: 'Loading research data...',
  ERROR: 'Could not load hypothesis results.',
  METHODOLOGY_TITLE: 'METHODOLOGY NOTES',
  METHODOLOGY_BODY: 'Population density controls applied via 20 sets of random geographic control points. Time-shifted baselines (±90 days) used for temporal hypotheses to isolate signal from geographic co-location. All p-values are two-tailed. Effect sizes: Cohen\'s d for continuous, odds ratio for proportions.',
  ATTRIBUTION: 'Data sources: NUFORC, Hatch UDB, Researcher Chronologies, NASA CNEOS, USGS Earthquakes, GFZ Potsdam Kp Index, IAEA Nuclear Facilities.'
} as const
