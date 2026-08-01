import { h, addClass } from '@/core/dom'
import { formatDate, formatDateCompact, formatLocation } from '@/utils/format'
import { StatusTag, createSourceTag } from '@/components/tags'
import { CredibilityBar } from '@/components/credibility-bar'
import { BookmarkButton } from '@/components/bookmark-button'
import { DataSourceId } from '@/enums'
import { cx } from './cx'
import type { Sighting, DataGridColumn } from '@/types'
import { ShareButton } from '../share-button'

const SOURCE_LABELS: Partial<Record<DataSourceId, string>> = {
  [DataSourceId.NUFORC]: 'NUFORC',
  [DataSourceId.HATCH_UDB]: 'HATCH',
  [DataSourceId.CHRONOLOGY]: 'CHRON',
  [DataSourceId.EXPERIENCER]: 'HUMAN',
  [DataSourceId.GEIPAN]: 'GEIPAN',
  [DataSourceId.DOW_PURSUE]: 'DOW'
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

function resolveGridSourceLabel (row: Sighting): string {
  if (row.source === DataSourceId.CHRONOLOGY && row.subSource) {
    return SUB_SOURCE_SHORT[row.subSource] || 'CHRON'
  }
  return SOURCE_LABELS[row.source] ?? row.source
}

export function sightingColumns (): DataGridColumn<Sighting>[] {
  return [
    {
      key: 'summary',
      label: 'REPORT',
      width: '50%',
      sortable: false,
      render: (row) => {
        const sourceLabel = resolveGridSourceLabel(row)
        const tagCount = row.tags?.length ?? 0

        const metaParts = [
          formatLocation(row.region, row.country),
          row.shape
        ].filter(v => v && v !== '—')

        const meta = h('span', { className: cx.meta }, metaParts.join(' · '))

        const badges = h('span', { className: cx.badges },
          createSourceTag(row.source, sourceLabel),
          h('span', { className: cx.badgeDate }, row.occurredAt?.slice(0, 10) || ''),
          ...(tagCount > 0
            ? [h('span', { className: cx.tagCount }, `${tagCount} tag${tagCount > 1 ? 's' : ''}`)]
            : [])
        )

        // Inline credibility for mobile (CRED column hidden on SP)
        const inlineCred = new CredibilityBar({ value: row.credibility })
        addClass(inlineCred.el, cx.inlineCred)

        return h('div', { className: cx.root },
          h('span', { className: cx.summary }, row.summary || '—'),
          meta,
          h('span', { className: cx.bottom },
            badges,
            inlineCred.el,
            new BookmarkButton({ sightingId: row.id, size: 14 }).el,
            new ShareButton({ size: 14, sightingId: row.id, year: row.occurredAt ? parseInt(row.occurredAt, 10) : undefined, title: row.summary?.slice(0, 60) }).el
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
