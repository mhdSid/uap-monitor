import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { Button } from '@/components/button'
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

    effect(() => {
      const total = store.totalCount.get()
      sightingsValue.textContent = total > 0 ? total.toLocaleString() : '—'
    })

    effect(() => {
      const years = store.availableYears.get()
      if (years.length > 0) {
        const oldest = years[years.length - 1]
        const newest = years[0]
        yearsValue.textContent = `${newest - oldest}+`
      }
    })

    const cta = new Button({
      label: HERO.CTA,
      variant: 'filled',
      color: 'primary',
      size: 'sm',
      onClick: () => this.props.onExplore?.()
    })

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
      cta.el
    )
  }
}
