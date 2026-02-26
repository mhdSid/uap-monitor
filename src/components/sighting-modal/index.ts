import type { Sighting } from '@/types'
import { TagVariant } from '@/enums'
import { h } from '@/utils/dom'
import { renderStatusTag, renderTag } from '@/components/tags'
import { openModal } from '@/components/modal'
import { MODAL } from '@/data/strings'

export function openSightingModal(sighting: Sighting, trigger?: HTMLElement): void {
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
        [MODAL.SHAPE, sighting.shape],
        [MODAL.LOCATION, coordsStr],
        [MODAL.DURATION, sighting.duration || MODAL.EMPTY_VALUE],
        [MODAL.OBSERVERS, sighting.observers ? String(sighting.observers) : MODAL.EMPTY_VALUE],
        [MODAL.CREDIBILITY, `${sighting.credibility}/100`],
        [MODAL.OCCURRED, sighting.occurredAt],
        [MODAL.REPORTED, sighting.reportedAt],
        [MODAL.SOURCE, sighting.source],
        [MODAL.CONTINENT, sighting.continent],
      ]

      if (sighting.characteristics.length > 0) {
        rows.push([MODAL.CHARACTERISTICS, sighting.characteristics.join(', ')])
      }

      const children: HTMLElement[] = [
        ...rows.map(([label, value]) =>
          h('div', { className: 'modal-sighting__row' },
            h('span', { className: 'modal-sighting__label' }, label),
            h('span', { className: 'modal-sighting__value' }, value),
          ),
        ),
      ]

      // Summary
      if (sighting.summary) {
        children.push(
          h('div', { className: 'modal-sighting__summary-label' }, MODAL.SUMMARY),
          h('p', { className: 'modal-sighting__summary' }, sighting.summary),
        )
      }

      // Full description / witness account
      if (sighting.description) {
        children.push(
          h('div', { className: 'modal-sighting__summary-label' }, MODAL.WITNESS_ACCOUNT),
          h('p', { className: 'modal-sighting__description' }, sighting.description),
        )
      }

      return h('div', { className: 'modal-sighting__content' }, ...children)
    },

    footer: () =>
      h('div', { className: 'modal-sighting__footer' },
        renderTag({ variant: TagVariant.DISABLED, label: `${MODAL.SOURCE}: ${sighting.source}` }),
      ),
  }, trigger)
}
