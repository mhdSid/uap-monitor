import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setText } from '@/core/dom'
import { Button } from '@/components/button'
import { HERO } from '@/data/strings'
import { ButtonSize } from '@/enums'
import { useAppStore, effect } from '@/composables'

export interface HeroProps {
  onExplore?: () => void
}

export class Hero extends Component<HeroProps> {
  protected create (): HTMLElement {
    const store = useAppStore()

    const sightingsValue = h('span', { className: cx.statValue }, '—')
    const sourcesValue = h('span', { className: cx.statValue }, '15')
    const yearsValue = h('span', { className: cx.statValue }, '—')

    this.own(effect(() => {
      const total = store.totalCount.get()
      setText(sightingsValue, total > 0 ? total.toLocaleString() : '—')
    }))

    this.own(effect(() => {
      const years = store.availableYears.get()
      if (years.length > 0) {
        const oldest = years[years.length - 1]
        const newest = years[0]
        setText(yearsValue, `${newest - oldest}+`)
      }
    }))

    const cta = new Button({
      label: HERO.CTA,
      variant: 'filled',
      color: 'primary',
      size: ButtonSize.MD,
      onClick: () => this.props.onExplore?.()
    })

    return h('section', { className: cx.root },
      h('h1', { className: cx.tagline }, HERO.TAGLINE),
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
        ),
        h('a', {
          className: `${cx.stat} ${cx.statResearch}`,
          href: '/research',
          'aria-label': HERO.STAT_HYPOTHESES,
          onClick: (e: Event) => {
            e.preventDefault()
            window.history.pushState(null, '', '/research')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }
        },
          h('span', { className: cx.statValue }, HERO.STAT_HYPOTHESES_VALUE),
          h('span', { className: cx.statLabel }, HERO.STAT_HYPOTHESES)
        )
      ),
      cta.el
    )
  }
}
