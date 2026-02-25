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
      const rows: [string, string][] = [
        ['Shape', sighting.shape],
        ['Coordinates', `${sighting.coordinates.lat.toFixed(2)}°N, ${sighting.coordinates.lng.toFixed(2)}°E`],
        ['Credibility', `${sighting.credibility}/100`],
        ['Reported', sighting.reportedAt],
        ['Source', sighting.source],
        ['Continent', sighting.continent],
      ]

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
