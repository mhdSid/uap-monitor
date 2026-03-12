import type {
  Continent,
  DataSourceId,
  DataSourceStatus,
  SightingShape,
  SightingStatus,
  TagSize,
  TagVariant,
  ToastVariant
} from '@/enums'

// ─── Core domain ─────────────────────────────────────────────────────

export interface Coordinates {
  lat: number
  lng: number
}

/**
 * A UAP sighting record.
 *
 * Fields fall into three categories:
 *   1. NUFORC-native  — directly from the source data
 *   2. Geocoded       — derived from location string (lat/lng, country, continent)
 *   3. Computed       — calculated by our pipeline (credibility, status)
 */
export interface Sighting {
  /** Unique identifier (NUFORC sighting number as string) */
  id: string

  /** Source database */
  source: DataSourceId

  /** Sub-source identifier (chronology sources: EBERHART, JOHNSON, etc.) */
  subSource?: string

  // ─── NUFORC-native fields ────────────────────────────────────────

  /** When the sighting occurred (ISO 8601) */
  occurredAt: string

  /** When the sighting was reported to NUFORC (ISO 8601) */
  reportedAt: string

  /** When the report was posted/published (ISO 8601) */
  postedAt: string

  /** Raw location string from source (e.g. "Basye, VA, USA") */
  location: string

  /** Shape classification */
  shape: SightingShape

  /** Duration as reported (free text, e.g. "2 min", "several seconds") */
  duration: string

  /** Number of witnesses (0 = unknown) */
  observers: number

  /** First ~200 chars of the witness summary */
  summary: string

  /** Full witness account / description text */
  description: string

  /** Observable characteristics reported (passthrough from source, not restricted to enum) */
  characteristics: string[]

  // ─── Geocoded fields (nullable until geocoded) ───────────────────

  /** Resolved coordinates (null if geocoding failed) */
  coordinates: Coordinates | null

  /** City / region name parsed from location */
  region: string

  /** Country parsed from location */
  country: string

  /** Continent (derived from country) */
  continent: Continent

  // ─── Computed fields ─────────────────────────────────────────────

  /** Investigation status */
  status: SightingStatus

  /** Credibility score 0-100 (computed from observers, characteristics, etc.) */
  credibility: number

  // ─── Extended fields (source-dependent, optional) ──────────────

  /** Searchable tags derived from source attributes (e.g. "Military observer", "Historical account") */
  tags?: string[]

  /** Strangeness rating 0-100 (Hatch UDB: original 1-10 scaled ×10) */
  strangeness?: number

  /** Bibliographic reference / source citation */
  ref?: string
}

export interface RegionStats {
  region: string
  continent: Continent
  sightings: number
  highCredibility: number
  trend: string
}

export interface Fireball {
  id: string
  date: string
  lat: number | null
  lng: number | null
  altitude: number | null
  velocity: number | null
  energy: number | null
  impactEnergy: number | null
  source: string
}

export interface FireballCollection {
  generatedAt: string
  source: string
  totalResults: number
  withCoordinates: number
  fireballs: Fireball[]
}

// ─── GDELT news layer ───────────────────────────────────────────────

export interface GdeltArticle {
  id: string
  title: string
  url: string
  domain: string
  publishedAt: string
  language: string
  sourceName?: string
  country?: string
  imageUrl?: string | null
  tone: number
}

export interface GdeltCollection {
  generatedAt: string
  query: string
  totalResults: number
  articles: GdeltArticle[]
}

// ─── GNews layer ────────────────────────────────────────────────────

export interface GnewsArticle {
  id: string
  title: string
  description: string
  content: string
  url: string
  imageUrl?: string | null
  publishedAt: string
  sourceName: string
  sourceUrl?: string | null
}

export interface GnewsCollection {
  generatedAt: string
  query: string
  totalResults: number
  articles: GnewsArticle[]
}

// ─── Twitter / X layer ──────────────────────────────────────────────

export interface TwitterArticle {
  id: string
  text: string
  url: string
  publishedAt: string
  lang: string
  authorName: string
  authorUsername: string
  authorImageUrl?: string | null
  authorVerified: boolean
  imageUrl?: string | null
  likeCount: number
  repostCount: number
  replyCount: number
  quoteCount: number
}

export interface TwitterCollection {
  generatedAt: string
  queries: number
  totalResults: number
  articles: TwitterArticle[]
}

// ─── Unified intelligence feed ──────────────────────────────────────

export type IntelSource = 'gdelt' | 'gnews' | 'twitter' | 'reddit'

export interface IntelArticle {
  id: string
  title: string
  url: string
  publishedAt: string
  sourceName: string
  intelSource: IntelSource
  /** GDELT-specific */
  tone?: number
  country?: string
  domain?: string
  /** GNews-specific */
  description?: string
  imageUrl?: string | null
  /** Twitter-specific */
  authorUsername?: string
  authorVerified?: boolean
  likeCount?: number
  repostCount?: number
  /** Reddit-specific */
  subreddit?: string
  commentCount?: number
  score?: number
}

export interface DataSource {
  id: DataSourceId
  label: string
  status: DataSourceStatus
  url?: string
  description?: string
  /** Direct link to the raw JSON data file (shown as secondary link) */
  dataUrl?: string
  /** Label for the data badge (defaults to 'JSON') */
  dataLabel?: string
  /** Sub-source identifier (for chronology sources) */
  subSourceId?: string
  /** Parent group label (e.g. 'Researcher Chronologies') — used for visual grouping */
  group?: string
}

// ─── NUFORC data layer ──────────────────────────────────────────────

export interface YearChunkMeta {
  count: number
  file: string
  sizeKB: number
  /** Distinct years with data (present for ancient and decade chunks only) */
  years?: number[]
}

export interface SourceManifest {
  generatedAt: string
  totalRecords: number
  skippedRecords: number
  years: Record<string, YearChunkMeta>
}

export interface SubSourceMeta {
  label: string
  description: string
  url: string
  count: number
  skipped: number
}

export interface ChronologyManifest extends SourceManifest {
  subSources: Record<string, SubSourceMeta>
}

/** @deprecated Use SourceManifest — kept for backward compat */
export type NuforcManifest = SourceManifest

export interface SightingFilter {
  search?: string
  shape?: SightingShape
  continent?: Continent
  minCredibility?: number
  country?: string
  /** Active source IDs — undefined means all sources shown */
  sources?: Set<string>
}

// ─── UI state ────────────────────────────────────────────────────────

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface ToastMessage {
  id: string
  text: string
  variant: ToastVariant
}

// ─── Component props ─────────────────────────────────────────────────

export interface ModalSlots {
  header?: () => HTMLElement
  content?: () => HTMLElement
  footer?: () => HTMLElement
  onClose?: () => void
}

export interface DataGridColumn<T> {
  key: keyof T | string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
  sortable?: boolean
  tooltip?: string
  render?: (row: T) => HTMLElement | string
}

export interface DataGridProps<T> {
  columns: DataGridColumn<T>[]
  data: T[]
  onRowClick?: (row: T, trigger: HTMLElement) => void
  emptyText?: string
}

export interface DataGridHandle<T> {
  el: HTMLElement
  /** Scroll to and highlight the first item matching the predicate. Returns true if found. */
  scrollToItem: (predicate: (item: T) => boolean) => boolean
}

export interface SectionProps {
  title: string
  live?: boolean
  count?: number
  tag?: HTMLElement
  tooltip?: string
}

export interface TagProps {
  variant: TagVariant
  label?: string
  size?: TagSize
}

export interface TagStyle {
  color: string
  bg: string
  border?: string
}

export interface StatusTagProps {
  status: string
}

export interface CredibilityBarProps {
  value: number
}

export interface DataSourcesProps {
  sources: DataSource[]
}

export interface TickerProps {
  messages: string[]
}

export interface ContinentGroup<T> {
  continent: Continent
  label: string
  items: T[]
  count: number
}

export interface WelcomeSource {
  name: string
  records: string
  period: string
  tier: 'high' | 'mid' | 'base'
}

export interface ManifestSource {
  getTotalCount(): number
  getAvailableYears(): number[]
}

export interface WelcomeStats {
  timespan: string
  records: string
  sources: string
  coverage: string
}

export interface WelcomeData {
  stats: WelcomeStats
  sources: WelcomeSource[]
}

// ─── Reddit layer ───────────────────────────────────────────────────

export interface RedditArticle {
  id: string
  title: string
  description: string
  content: string
  url: string
  sourceUrl?: string | null
  imageUrl?: string | null
  publishedAt: string
  sourceName: string
  authorName: string
  score: number
  commentCount: number
  over18: boolean
  isVideo: boolean
  domain: string
  subreddit: string
}

export interface RedditCollection {
  generatedAt: string
  queries: number
  totalResults: number
  articles: RedditArticle[]
}
