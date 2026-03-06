import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  SightingModal — detail view for a single UAP sighting              *
 *                                                                     *
 *  Opens via Modal.open() with structured header/content/footer.      *
 * ------------------------------------------------------------------ */

import type { Sighting, Fireball, GdeltArticle, GnewsArticle } from '@/types'
import { DataSourceId, TagVariant } from '@/enums'
import { h } from '@/utils/dom'
import { StatusTag, Tag } from '@/components/tags'
import { Modal } from '@/components/modal'
import { MODAL, RELATED } from '@/data/strings'
import { useAnalytics, getSourceUrl, useFireball, useAppStore } from '@/composables'
import { haversineKm } from '@/composables/use-fireball'

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
  DOLAN: 'Dolan'
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
      onClose: () => analytics.sightingDismissed(sighting)
    }, trigger)
  }

  // ─── Slots ──────────────────────────────────────────────────────

  private static buildHeader(s: Sighting): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, [s.region, s.country].filter(Boolean).join(', ') || '—'),
      new StatusTag({ status: s.status }).el
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
      const cls = hasDescription ? `${cx.summary} ${cx.summaryWithDesc}` : `${cx.summary} ${cx.summarySolo}`
      children.push(h('p', { className: cls }, s.summary))
    }

    if (hasDescription) {
      const cls = hasSummary ? `${cx.description} ${cx.descriptionWithSummary}` : `${cx.description} ${cx.descriptionSolo}`
      children.push(h('p', { className: cls }, s.description))
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
      [MODAL.CONTINENT, s.continent]
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
      h('div', { className: cx.row },
        h('span', { className: cx.label }, label),
        h('span', { className: cx.value }, value)
      )
    ))

    // Source row — clickable link if URL exists
    const sourceLabel = resolveSourceLabel(s)
    const sourceUrl = getSourceUrl(s.source, s.subSource)
    const sourceValueEl = sourceUrl
      ? h('a', {
          className: `${cx.value} ${cx.sourceLink}`,
          href: sourceUrl,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, sourceLabel)
      : h('span', { className: cx.value }, sourceLabel)

    children.push(
      h('div', { className: cx.row },
        h('span', { className: cx.label }, MODAL.SOURCE),
        sourceValueEl
      )
    )

    // ── Related fireballs ──────────────────────────────────────────
    const fireball = useFireball()
    const nearbyFireballs = fireball.findNearSighting(s)
    children.push(SightingModal.buildRelatedFireballs(s, nearbyFireballs))

    // ── Related news ───────────────────────────────────────────────
    const store = useAppStore()
    const related = fireball.findRelatedNews(
      s,
      store.gdeltArticles.get(),
      store.gnewsArticles.get()
    )
    if (related.gdelt.length > 0 || related.gnews.length > 0) {
      children.push(SightingModal.buildRelatedNews(related.gdelt, related.gnews))
    }

    return h('div', { className: cx.content }, ...children)
  }

  private static buildFooter(s: Sighting): HTMLElement {
    return h('div', { className: cx.footer },
      new Tag({ variant: TagVariant.DISABLED, label: `${MODAL.SOURCE}: ${resolveSourceLabel(s)}` }).el
    )
  }

  // ─── Related content ────────────────────────────────────────────

  private static buildRelatedFireballs(s: Sighting, fireballs: Fireball[]): HTMLElement {
    const section = h('div', { className: cx.relatedSection })
    section.appendChild(h('div', { className: cx.relatedTitle }, RELATED.FIREBALLS_TITLE))

    if (fireballs.length === 0) {
      section.appendChild(h('div', { className: cx.relatedEmpty }, RELATED.FIREBALLS_EMPTY))
      return section
    }

    for (const fb of fireballs) {
      const date = fb.date?.slice(0, 10) ?? MODAL.EMPTY_VALUE
      const parts: string[] = []
      if (fb.energy != null) parts.push(`${RELATED.FIREBALL_ENERGY}: ${fb.energy}${RELATED.FIREBALL_ENERGY_UNIT}`)
      if (fb.impactEnergy != null) parts.push(`${RELATED.FIREBALL_IMPACT}: ${fb.impactEnergy}${RELATED.FIREBALL_IMPACT_UNIT}`)
      if (fb.altitude != null) parts.push(`${RELATED.FIREBALL_ALTITUDE}: ${fb.altitude}${RELATED.FIREBALL_ALTITUDE_UNIT}`)
      if (fb.velocity != null) parts.push(`${RELATED.FIREBALL_VELOCITY}: ${fb.velocity}${RELATED.FIREBALL_VELOCITY_UNIT}`)

      let distStr = ''
      if (s.coordinates && fb.lat != null && fb.lng != null) {
        const km = haversineKm(s.coordinates.lat, s.coordinates.lng, fb.lat, fb.lng)
        distStr = `${Math.round(km)}${RELATED.FIREBALL_DISTANCE_UNIT}`
      }

      section.appendChild(
        h('div', { className: cx.relatedItem },
          h('span', { className: cx.relatedItemDate }, date),
          h('span', { className: cx.relatedItemMeta }, parts.join(' · ')),
          distStr
            ? h('span', { className: cx.relatedItemDistance }, distStr)
            : h('span', {})
        )
      )
    }

    return section
  }

  private static buildRelatedNews(
    gdelt: GdeltArticle[],
    gnews: GnewsArticle[]
  ): HTMLElement {
    const section = h('div', { className: cx.relatedSection })
    section.appendChild(h('div', { className: cx.relatedTitle }, RELATED.NEWS_TITLE))

    const allNews = [
      ...gdelt.map(a => ({ title: a.title, url: a.url, date: a.publishedAt, source: a.domain })),
      ...gnews.map(a => ({ title: a.title, url: a.url, date: a.publishedAt, source: a.sourceName }))
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

    if (allNews.length === 0) {
      section.appendChild(h('div', { className: cx.relatedEmpty }, RELATED.NEWS_EMPTY))
      return section
    }

    for (const item of allNews) {
      section.appendChild(
        h('div', { className: cx.relatedItem },
          h('a', {
            className: cx.relatedItemLink,
            href: item.url,
            target: '_blank',
            rel: 'noopener noreferrer'
          }, item.title.length > 80 ? item.title.slice(0, 77) + '\u2026' : item.title),
          h('span', { className: cx.relatedItemMeta },
            `${item.source} · ${item.date.slice(0, 10)}`
          )
        )
      )
    }

    return section
  }
}
