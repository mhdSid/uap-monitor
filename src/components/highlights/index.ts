import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { Carousel } from '@/components/carousel'
import { HighlightCard } from '@/components/highlight-card'
import { SightingModal } from '@/components/sighting-modal'
import { HIGHLIGHTS } from '@/data/strings'
import { useAppStore } from '@/composables'
import type { Sighting } from '@/types'

export class Highlights extends Component {
  protected create(): HTMLElement {
    const store = useAppStore()

    const cards = HIGHLIGHTS.ITEMS.map(item => {
      return new HighlightCard({
        year: item.year,
        location: item.location,
        headline: item.headline,
        onClick: () => {
          const sightings = store.sightings.get()
          const match = Highlights.findSighting(sightings, item.year, item.searchKey)

          if (match) {
            SightingModal.open(match)
            return
          }

          // Not in current range — set a 10-year window around the target
          const targetYear = parseInt(item.year, 10)
          const { from, to } = store.yearRange.get()

          if (targetYear >= from && targetYear <= to) return // Already in range, just no match
          if (store.loading.get()) return // Already loading

          store.yearRange.set({ from: targetYear, to: targetYear + 10 })

          // Wait for loading to finish, then search again
          const unsub = store.loading.subscribe((loading) => {
            if (loading) return
            unsub()
            const updated = store.sightings.get()
            const found = Highlights.findSighting(updated, item.year, item.searchKey)
            if (found) SightingModal.open(found)
          })
        }
      }).el
    })

    const carousel = new Carousel({
      label: HIGHLIGHTS.TITLE,
      children: cards
    })

    return h('section', { className: cx.root },
      h('h2', { className: cx.title }, HIGHLIGHTS.TITLE),
      carousel.el
    )
  }

  private static findSighting(sightings: Sighting[], year: string, searchKey: string): Sighting | null {
    const key = searchKey.toLowerCase()

    for (const s of sightings) {
      if (s.occurredAt.startsWith(year) && s.location.toLowerCase().includes(key)) return s
    }

    for (const s of sightings) {
      if (s.occurredAt.startsWith(year) && (
        s.summary.toLowerCase().includes(key) ||
        s.description.toLowerCase().includes(key)
      )) return s
    }

    for (const s of sightings) {
      if (s.location.toLowerCase().includes(key)) return s
    }

    for (const s of sightings) {
      if (
        s.summary.toLowerCase().includes(key) ||
        s.description.toLowerCase().includes(key)
      ) return s
    }

    return null
  }
}
