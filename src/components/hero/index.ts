import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { HERO } from '@/data/strings'
import { useAppStore, effect } from '@/composables'

export interface HeroProps {
  onExplore?: () => void
}

export class Hero extends Component<HeroProps> {
  protected create(): HTMLElement {
    const store = useAppStore()

    const sightingsValue = h('span', { className: cx.statValue }, '—')
    const sourcesValue = h('span', { className: cx.statValue }, '15')
    const yearsValue = h('span', { className: cx.statValue }, '—')

    // Live-update sighting count
    effect(() => {
      const total = store.totalCount.get()
      sightingsValue.textContent = total > 0 ? total.toLocaleString() : '—'
    })

    // Live-update year span
    effect(() => {
      const years = store.availableYears.get()
      if (years.length > 0) {
        const oldest = years[years.length - 1]
        const newest = years[0]
        yearsValue.textContent = `${newest - oldest}+`
      }
    })

    const cta = h('button', {
      className: cx.cta,
      type: 'button',
      onClick: () => this.props.onExplore?.()
    }, HERO.CTA)

    return h('section', { className: cx.root },
      h('p', { className: cx.tagline }, HERO.TAGLINE),
      h('div', { className: cx.stats },
        h('div', { className: cx.stat },
          sightingsValue,
          h('span', { className: cx.statLabel }, HERO.STAT_SIGHTINGS)
        ),
        h('div', { className: cx.stat },
          sourcesValue,
          h('span', { className: cx.statLabel }, HERO.STAT_SOURCES)
        ),
        h('div', { className: cx.stat },
          yearsValue,
          h('span', { className: cx.statLabel }, HERO.STAT_YEARS)
        )
      ),
      cta
    )
  }
}
