import { h } from '@/utils/dom'
import { formatDate, formatDateCompact } from '@/utils/format'
import { StatusTag } from '@/components/tags'
import { CredibilityBar } from '@/components/credibility-bar'
import { DataSourceId } from '@/enums'
import { cx } from './cx'
import type { Sighting, DataGridColumn } from '@/types'

const SOURCE_LABELS: Partial<Record<DataSourceId, string>> = {
  [DataSourceId.NUFORC]: 'NUFORC',
  [DataSourceId.HATCH_UDB]: 'HATCH',
  [DataSourceId.CHRONOLOGY]: 'CHRON'
}

const SUB_SOURCE_SHORT: Record<string, string> = {
  EBERHART: 'EBER',
  JOHNSON: 'JOHN',
  NICAP: 'NICAP',
  VALLEE_MAGONIA: 'MAGN',
  BB_UNKNOWNS: 'BB',
  OVERMEIRE: 'OVRM',
  HALL: 'HALL',
  WONDERS_SKY: 'WNDR',
  PRE_ROSWELL: 'RIFE',
  DOLAN: 'DOLN'
}

/** Source badge class by data source id */
const SOURCE_CLASS: Record<string, string> = {
  [DataSourceId.CHRONOLOGY]: `${cx.source} ${cx.sourceChronology}`,
  [DataSourceId.HATCH_UDB]: `${cx.source} ${cx.sourceHatchUdb}`
}

function resolveGridSourceLabel(row: Sighting): string {
  if (row.source === DataSourceId.CHRONOLOGY && row.subSource) {
    return SUB_SOURCE_SHORT[row.subSource] || 'CHRON'
  }
  return SOURCE_LABELS[row.source] ?? row.source
}

export function sightingColumns(): DataGridColumn<Sighting>[] {
  return [
    {
      key: 'summary',
      label: 'REPORT',
      width: '50%',
      sortable: false,
      render: (row) => {
        const sourceLabel = resolveGridSourceLabel(row)
        const sourceClass = SOURCE_CLASS[row.source] || `${cx.source} ${cx.source}--${row.source.toLowerCase().replace('_', '-')}`
        const tagCount = row.tags?.length ?? 0

        const metaParts = [
          [row.region, row.country].filter(Boolean).join(', '),
          row.shape
        ]

        const meta = h('span', { className: cx.meta }, metaParts.join(' · '))

        const occuredAt = row.occurredAt?.slice(0, 10) || ''
        const badges = h('span', { className: cx.badges },
          h('span', { className: sourceClass }, sourceLabel),
          h('span', { className: cx.badgeDate }, occuredAt ? `• ${occuredAt}` : ''),
          ...(tagCount > 0
            ? [h('span', { className: cx.tagCount }, `${tagCount} tag${tagCount > 1 ? 's' : ''}`)]
            : [])
        )

        return h('div', { className: cx.root },
          h('span', { className: cx.summary }, row.summary || '—'),
          meta,
          h('span', { className: cx.bottom },
            badges,
            h('span', { className: cx.date }, formatDate(row.occurredAt))
          )
        )
      }
    },
    {
      key: 'credibility',
      label: 'CRED',
      width: '100px',
      align: 'right',
      render: (row) => new CredibilityBar({ value: row.credibility }).el
    },
    {
      key: 'status',
      label: 'STATUS',
      width: '80px',
      align: 'right',
      render: (row) => new StatusTag({ status: row.status }).el
    },
    {
      key: 'occurredAt',
      label: 'DATE',
      width: '90px',
      align: 'right',
      render: (row) => {
        const full = formatDate(row.occurredAt)
        const compact = formatDateCompact(row.occurredAt)
        return h('span', { className: cx.cellTime, title: full }, compact)
      }
    }
  ]
}
