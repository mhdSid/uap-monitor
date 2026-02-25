import type { Sighting } from '@/types'
import { TagVariant } from '@/enums'
import { h } from '@/utils/dom'
import { renderStatusTag, renderTag } from '@/components/tags'
import { openModal } from '@/components/modal'

export function openSightingModal(sighting: Sighting): void {
  openModal({
    header: () =>
      h('div', { className: 'modal-sighting__header' },
        h('span', { className: 'modal-sighting__title' },
          `${sighting.region}, ${sighting.country}`,
        ),
        renderStatusTag({ status: sighting.status }),
      ),

    content: () => {
      const coordsStr = sighting.coordinates
        ? `${sighting.coordinates.lat.toFixed(2)}°N, ${sighting.coordinates.lng.toFixed(2)}°E`
        : sighting.location

      const rows: [string, string][] = [
        ['Shape', sighting.shape],
        ['Location', coordsStr],
        ['Duration', sighting.duration || '—'],
        ['Observers', sighting.observers ? String(sighting.observers) : '—'],
        ['Credibility', `${sighting.credibility}/100`],
        ['Occurred', sighting.occurredAt],
        ['Reported', sighting.reportedAt],
        ['Source', sighting.source],
        ['Continent', sighting.continent],
      ]

      if (sighting.characteristics.length > 0) {
        rows.push(['Characteristics', sighting.characteristics.join(', ')])
      }

      return h('div', { className: 'modal-sighting__content' },
        ...rows.map(([label, value]) =>
          h('div', { className: 'modal-sighting__row' },
            h('span', { className: 'modal-sighting__label' }, label),
            h('span', { className: 'modal-sighting__value' }, value),
          ),
        ),
        h('div', { className: 'modal-sighting__summary-label' }, 'SUMMARY'),
        h('p', { className: 'modal-sighting__summary' }, sighting.summary),
      )
    },

    footer: () =>
      h('div', { className: 'modal-sighting__footer' },
        renderTag({ variant: TagVariant.DISABLED, label: `SOURCE: ${sighting.source}` }),
      ),
  })
}
