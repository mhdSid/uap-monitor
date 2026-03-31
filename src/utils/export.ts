/**
 * Export utilities — serialize sighting data for researcher download.
 *
 * Supports:
 *   exportToCsv(sightings)  — flat CSV with key fields
 *   exportToJson(sightings) — wrapped JSON with provenance metadata
 *
 * Both trigger a browser download via Blob + object URL.
 */

import type { Sighting } from '@/types'

// ─── Internal ───────────────────────────────────────────────────────

function triggerDownload (content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function datestamp (): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── JSON ───────────────────────────────────────────────────────────

export function exportToJson (sightings: Sighting[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'UAP Monitor — uapmonitor.org',
    license: 'Data sourced from publicly available databases. See uapmonitor.org for attribution.',
    totalRecords: sightings.length,
    sightings
  }
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `uap-monitor-${datestamp()}.json`,
    'application/json'
  )
}

// ─── CSV ────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'ID', 'SOURCE', 'SUB_SOURCE', 'OCCURRED_AT', 'LOCATION',
  'REGION', 'COUNTRY', 'CONTINENT', 'SHAPE', 'DURATION',
  'OBSERVERS', 'CREDIBILITY', 'STATUS', 'LAT', 'LNG', 'SUMMARY'
]

function csvEscape (val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function sightingToRow (s: Sighting): string {
  const fields = [
    s.id,
    s.source,
    s.subSource ?? '',
    s.occurredAt?.slice(0, 10) ?? '',
    s.location,
    s.region,
    s.country,
    s.continent,
    s.shape,
    s.duration,
    String(s.observers),
    String(s.credibility),
    s.status,
    s.coordinates ? String(s.coordinates.lat) : '',
    s.coordinates ? String(s.coordinates.lng) : '',
    s.summary
  ]
  return fields.map(csvEscape).join(',')
}

export function exportToCsv (sightings: Sighting[]): void {
  const rows = [CSV_HEADERS.join(','), ...sightings.map(sightingToRow)]
  triggerDownload(
    rows.join('\n'),
    `uap-monitor-${datestamp()}.csv`,
    'text/csv;charset=utf-8;'
  )
}
