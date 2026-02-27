import { h } from '@/utils/dom'
import { formatDate } from '@/utils/format'
import { StatusTag } from '@/components/tags'
import { CredibilityBar } from '@/components/credibility-bar'
import { DataSourceId } from '@/enums'
import type { Sighting, DataGridColumn } from '@/types'

const SOURCE_LABELS: Partial<Record<DataSourceId, string>> = {
  [DataSourceId.NUFORC]: 'NUFORC',
  [DataSourceId.HATCH_UDB]: 'HATCH',
  [DataSourceId.CHRONOLOGY]: 'CHRON',
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
  DOLAN: 'DOLN',
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
        const sourceClass = row.source === DataSourceId.CHRONOLOGY
          ? 'cell-report__source cell-report__source--chronology'
          : `cell-report__source cell-report__source--${row.source.toLowerCase().replace('_', '-')}`
        const tagCount = row.tags?.length ?? 0

        const metaParts = [
          `${row.region}${row.country ? ', ' + row.country : ''}`,
          row.shape,
        ]

        const meta = h('span', { className: 'cell-report__meta' }, metaParts.join(' · '))

        const badges = h('span', { className: 'cell-report__badges' },
          h('span', {
            className: sourceClass,
          }, sourceLabel),
          ...(tagCount > 0
            ? [h('span', { className: 'cell-report__tag-count' }, `${tagCount} tag${tagCount > 1 ? 's' : ''}`)]
            : []),
        )

        return h('div', { className: 'cell-report' },
          h('span', { className: 'cell-report__summary' }, row.summary || '—'),
          meta,
          h('span', { className: 'cell-report__bottom' },
            badges,
            h('span', { className: 'cell-report__date' }, formatDate(row.occurredAt)),
          ),
        )
      },
    },
    {
      key: 'credibility',
      label: 'CRED',
      width: '100px',
      align: 'right',
      render: (row) => new CredibilityBar({ value: row.credibility }).el,
    },
    {
      key: 'status',
      label: 'STATUS',
      width: '80px',
      align: 'right',
      render: (row) => new StatusTag({ status: row.status }).el,
    },
    {
      key: 'occurredAt',
      label: 'DATE',
      width: '90px',
      align: 'right',
      render: (row) => h('span', { className: 'cell-time' }, formatDate(row.occurredAt)),
    },
  ]
}
