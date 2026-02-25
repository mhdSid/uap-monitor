import type {
  Continent,
  DataSourceId,
  DataSourceStatus,
  SightingShape,
  SightingStatus,
  TagVariant,
} from '@/enums'

// ─── Core domain ─────────────────────────────────────────────────────

export interface Coordinates {
  lat: number
  lng: number
}

export interface Sighting {
  id: string
  coordinates: Coordinates
  region: string
  country: string
  continent: Continent
  shape: SightingShape
  status: SightingStatus
  credibility: number
  reportedAt: string
  summary: string
  source: DataSourceId
}

export interface RegionStats {
  region: string
  continent: Continent
  sightings: number
  highCredibility: number
  trend: string
}

export interface NewsItem {
  id: string
  source: string
  text: string
  time: string
  tag: TagVariant | null
  continent: Continent
}

export interface Fireball {
  date: string
  coordinates: Coordinates
  energy: string
  location: string
}

export interface DataSource {
  id: DataSourceId
  label: string
  status: DataSourceStatus
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
  type: 'error' | 'success' | 'info'
}

// ─── Component props ─────────────────────────────────────────────────

export interface ModalSlots {
  header?: () => HTMLElement
  content?: () => HTMLElement
  footer?: () => HTMLElement
}

export interface DataGridColumn<T> {
  key: keyof T | string
  label: string
  align?: 'left' | 'right' | 'center'
  render?: (row: T) => HTMLElement | string
}

export interface DataGridProps<T> {
  columns: DataGridColumn<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyText?: string
}

export interface SectionProps {
  title: string
  live?: boolean
  count?: number
  tag?: HTMLElement
}

export interface TagProps {
  variant: TagVariant
  label?: string
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

export interface NewsFeedProps {
  items: NewsItem[]
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
