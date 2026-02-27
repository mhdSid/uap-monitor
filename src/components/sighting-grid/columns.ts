import { h } from '@/utils/dom'
import { formatDate } from '@/utils/format'
import { StatusTag } from '@/components/tags'
import { CredibilityBar } from '@/components/credibility-bar'
import { DataSourceId } from '@/enums'
import type { Sighting, DataGridColumn } from '@/types'

const SOURCE_LABELS: Partial<Record<DataSourceId, string>> = {
  [DataSourceId.NUFORC]: 'NUFORC',
  [DataSourceId.HATCH_UDB]: 'HATCH',
}

export function sightingColumns(): DataGridColumn<Sighting>[] {
  return [
    {
      key: 'summary',
      label: 'REPORT',
      width: '50%',
      sortable: false,
      render: (row) => {
        const sourceLabel = SOURCE_LABELS[row.source] ?? row.source
        const tagCount = row.tags?.length ?? 0

        const metaParts = [
          `${row.region}${row.country ? ', ' + row.country : ''}`,
          row.shape,
        ]

        const meta = h('span', { className: 'cell-report__meta' }, metaParts.join(' · '))

        const badges = h('span', { className: 'cell-report__badges' },
          h('span', {
            className: `cell-report__source cell-report__source--${row.source.toLowerCase().replace('_', '-')}`,
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
