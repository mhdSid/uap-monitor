/* ------------------------------------------------------------------ *
 *  SightingModal — detail view for a single UAP sighting              *
 *                                                                     *
 *  Opens via Modal.open() with structured header/content/footer.      *
 * ------------------------------------------------------------------ */

import type { Sighting } from '@/types'
import { DataSourceId, TagVariant } from '@/enums'
import { h } from '@/utils/dom'
import { StatusTag, Tag } from '@/components/tags'
import { Modal } from '@/components/modal'
import { MODAL } from '@/data/strings'
import { useAnalytics } from '@/composables'

// ─── Sub-source display names (chronology) ──────────────────────────

const SUB_SOURCE_LABELS: Record<string, string> = {
  EBERHART: 'Eberhart',
  JOHNSON: 'Johnson',
  NICAP: 'NICAP',
  VALLEE_MAGONIA: 'Vallée (Magonia)',
  BB_UNKNOWNS: 'Blue Book Unknowns',
  OVERMEIRE: 'Overmeire',
  HALL: 'Hall (UFO Evidence)',
  WONDERS_SKY: 'Wonders in the Sky',
  PRE_ROSWELL: 'Pre-Roswell (Rife)',
  DOLAN: 'Dolan',
}

function resolveSourceLabel(s: Sighting): string {
  if (s.source === DataSourceId.CHRONOLOGY && s.subSource) {
    return SUB_SOURCE_LABELS[s.subSource] || s.subSource
  }
  return s.source
}

export class SightingModal {
  static open(sighting: Sighting, trigger?: HTMLElement): void {
    const analytics = useAnalytics()
    analytics.sightingViewed(sighting)

    Modal.open({
      header: () => SightingModal.buildHeader(sighting),
      content: () => SightingModal.buildContent(sighting),
      footer: () => SightingModal.buildFooter(sighting),
      onClose: () => analytics.sightingDismissed(sighting),
    }, trigger)
  }

  // ─── Slots ──────────────────────────────────────────────────────

  private static buildHeader(s: Sighting): HTMLElement {
    return h('div', { className: 'modal-sighting__header' },
      h('span', { className: 'modal-sighting__title' }, `${s.region}, ${s.country}`),
      new StatusTag({ status: s.status }).el,
    )
  }

  private static buildContent(s: Sighting): HTMLElement {
    const coordsStr = s.coordinates
      ? `${s.coordinates.lat.toFixed(2)}°N, ${s.coordinates.lng.toFixed(2)}°E`
      : s.location

    const children: HTMLElement[] = []

    // Summary + description at the top
    const hasSummary = !!s.summary
    const hasDescription = !!s.description

    if (hasSummary) {
      children.push(
        h('p', { className: `modal-sighting__summary${hasDescription ? ' modal-sighting__summary--with-desc' : ' modal-sighting__summary--solo'}` }, s.summary),
      )
    }

    if (hasDescription) {
      children.push(
        h('p', { className: `modal-sighting__description${hasSummary ? ' modal-sighting__description--with-summary' : ' modal-sighting__description--solo'}` }, s.description),
      )
    }

    // Metadata rows
    const rows: [string, string][] = [
      [MODAL.SHAPE, s.shape],
      [MODAL.LOCATION, coordsStr],
      [MODAL.DURATION, s.duration || MODAL.EMPTY_VALUE],
      [MODAL.OBSERVERS, s.observers ? String(s.observers) : MODAL.EMPTY_VALUE],
      [MODAL.CREDIBILITY, `${s.credibility}/100`],
      ...(s.strangeness !== undefined
        ? [[MODAL.STRANGENESS, `${s.strangeness}/100`] as [string, string]]
        : []),
      [MODAL.OCCURRED, s.occurredAt],
      [MODAL.REPORTED, s.reportedAt],
      [MODAL.SOURCE, resolveSourceLabel(s)],
      [MODAL.CONTINENT, s.continent],
    ]

    if (s.characteristics.length > 0) {
      rows.push([MODAL.CHARACTERISTICS, s.characteristics.join(', ')])
    }
    if (s.tags && s.tags.length > 0) {
      rows.push([MODAL.TAGS, s.tags.join(', ')])
    }
    if (s.ref) {
      rows.push([MODAL.REFERENCE, s.ref])
    }

    children.push(...rows.map(([label, value]) =>
      h('div', { className: 'modal-sighting__row' },
        h('span', { className: 'modal-sighting__label' }, label),
        h('span', { className: 'modal-sighting__value' }, value),
      ),
    ))

    return h('div', { className: 'modal-sighting__content' }, ...children)
  }

  private static buildFooter(s: Sighting): HTMLElement {
    return h('div', { className: 'modal-sighting__footer' },
      new Tag({ variant: TagVariant.DISABLED, label: `${MODAL.SOURCE}: ${resolveSourceLabel(s)}` }).el,
    )
  }
}
