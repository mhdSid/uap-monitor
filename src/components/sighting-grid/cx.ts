import { Continent } from "@/enums"

/** Class name constants for sighting-grid. Auto-generated — edit styles.css, re-run gen. */
export const cx = {
  root: 'cell-report',
  badgeDate: 'cell-report__badge-date',
  badges: 'cell-report__badges',
  bottom: 'cell-report__bottom',
  date: 'cell-report__date',
  meta: 'cell-report__meta',
  summary: 'cell-report__summary',
  tagCount: 'cell-report__tag-count',
  inlineCred: 'cell-report__inline-cred',
  cellTime: 'cell-time',
  cellType: 'cell-type',
  heading: 'grids-heading',
  searchBar: 'grids-search',
  gridsList: 'grids-list',
  [Continent.AFRICA]: 'grids-africa',
  [Continent.AMERICAS]: 'grids-americas',
  [Continent.EUROPE]: 'grids-europe',
  [Continent.EURASIA]: 'grids-eurasia',
  [Continent.ASIA_MIDDLE_EAST]: 'grids-asia-middleeast',
  [Continent.ASIA_PACIFIC]: 'grids-asia-pacific',
  [Continent.OCEANIA]: 'grids-oceania',
  sectionWrapper: 'grids-section',
  emptyState: 'empty-state',
  emptyStateCompact: 'empty-state--compact',
  emptyStateText: 'empty-state__text'
} as const
