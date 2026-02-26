import { h } from '@/utils/dom'
import { formatDate } from '@/utils/format'
import { renderStatusTag } from '@/components/tags'
import { renderCredibilityBar } from '@/components/credibility-bar'
import type { Sighting, DataGridColumn } from '@/types'

export function sightingColumns(): DataGridColumn<Sighting>[] {
  return [
    {
      key: 'summary',
      label: 'REPORT',
      width: '50%',
      sortable: false,
      render: (row) =>
        h('div', { className: 'cell-report' },
          h('span', { className: 'cell-report__summary' }, row.summary || '—'),
          h('span', { className: 'cell-report__meta' },
            `${row.region}${row.country ? ', ' + row.country : ''} · ${row.shape}`,
          ),
          h('span', { className: 'cell-report__date' }, formatDate(row.occurredAt)),
        ),
    },
    {
      key: 'credibility',
      label: 'CRED',
      width: '100px',
      align: 'right',
      render: (row) => renderCredibilityBar({ value: row.credibility }),
    },
    {
      key: 'status',
      label: 'STATUS',
      width: '80px',
      align: 'right',
      render: (row) => renderStatusTag({ status: row.status }),
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
