import { h, mount, clearChildren } from '@/utils/dom'
import { useDataSource } from '@/composables'
import { renderHeader } from '@/components/header'
import { renderTicker } from '@/components/ticker'
import { renderLoader } from '@/components/loader'
import { renderSection } from '@/components/layout'
import { renderDataGrid } from '@/components/data-grid'
import { renderStatusTag, renderLiveTag } from '@/components/tags'
import { renderCredibilityBar } from '@/components/credibility-bar'
import { renderDataSources } from '@/components/data-sources'
import { renderNewsFeed } from '@/components/news-feed'
import { renderFooter } from '@/components/footer'
import { openSightingModal } from '@/components/sighting-modal'
import { groupByContinent, getRegionStats, getNewsItems } from '@/data/sightings'
import type { Sighting, DataGridColumn, RegionStats } from '@/types'

// ─── Column definitions ──────────────────────────────────────────────

function sightingColumns(): DataGridColumn<Sighting>[] {
  return [
    {
      key: 'region',
      label: 'REGION',
      render: (row) =>
        h('div', { className: 'cell-region' },
          h('span', { className: 'cell-region__name' }, `${row.region}, ${row.country}`),
          h('span', { className: 'cell-region__coords' },
            `${row.coordinates.lat.toFixed(1)}°N ${row.coordinates.lng.toFixed(1)}°E`,
          ),
        ),
    },
    {
      key: 'shape',
      label: 'TYPE',
      render: (row) => h('span', { className: 'cell-type' }, row.shape),
    },
    {
      key: 'credibility',
      label: 'CRED',
      align: 'right',
      render: (row) => renderCredibilityBar({ value: row.credibility }),
    },
    {
      key: 'status',
      label: 'STATUS',
      align: 'right',
      render: (row) => renderStatusTag({ status: row.status }),
    },
    {
      key: 'reportedAt',
      label: '',
      align: 'right',
      render: (row) => h('span', { className: 'cell-time' }, row.reportedAt),
    },
  ]
}

function statsColumns(): DataGridColumn<RegionStats>[] {
  return [
    {
      key: 'region',
      label: 'REGION',
      render: (row) =>
        h('span', { style: { color: 'var(--color-green)' } }, row.region),
    },
    { key: 'sightings', label: 'SIGHTINGS', align: 'right' },
    {
      key: 'highCredibility',
      label: 'HIGH',
      align: 'right',
      render: (row) =>
        h('span', {
          style: { color: row.highCredibility > 0 ? 'var(--color-red)' : 'var(--color-muted)' },
        }, String(row.highCredibility)),
    },
    {
      key: 'trend',
      label: 'TREND',
      align: 'right',
      render: (row) =>
        h('span', {
          style: { color: row.trend.startsWith('+') ? 'var(--color-green)' : 'var(--color-red)' },
        }, row.trend),
    },
  ]
}

// ─── App entry ───────────────────────────────────────────────────────

export async function createApp(root: HTMLElement): Promise<void> {
  const main = h('main', { className: 'app-main', role: 'main' },
    h('div', { className: 'app-loader' }, renderLoader()),
  )

  const app = h('div', { className: 'app' },
    h('div', { className: 'scanlines' }),
    renderHeader(),
    renderTicker(),
    main,
  )

  mount(root, app)

  // Fetch data
  const { fetchSightings, getSources } = useDataSource()
  const sightings = await fetchSightings()

  clearChildren(main)

  // Sighting grids by continent
  const columns = sightingColumns()
  for (const group of groupByContinent(sightings)) {
    main.appendChild(
      renderSection(
        {
          title: group.label,
          live: true,
          count: group.count,
          tag: h('span', { className: 'tag tag--count' }, `${group.count} NEW`),
        },
        renderDataGrid<Sighting>({
          columns,
          data: group.items,
          onRowClick: openSightingModal,
        }),
      ),
    )
  }

  // Region stats by continent
  const statsCols = statsColumns()
  for (const group of groupByContinent(getRegionStats())) {
    main.appendChild(
      renderSection(
        {
          title: `${group.label} — STATS`,
          count: group.items.reduce((a, r) => a + r.sightings, 0),
        },
        renderDataGrid<RegionStats>({ columns: statsCols, data: group.items }),
      ),
    )
  }

  // Intel feed
  const newsItems = getNewsItems()
  main.appendChild(
    renderSection(
      { title: 'INTEL FEED', live: true, tag: renderLiveTag(), count: newsItems.length },
      renderNewsFeed({ items: newsItems }),
    ),
  )

  // Data sources
  main.appendChild(
    renderSection(
      { title: 'DATA SOURCES' },
      renderDataSources({ sources: getSources() }),
    ),
  )

  // Footer
  main.appendChild(renderFooter())
}
