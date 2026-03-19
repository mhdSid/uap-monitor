import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { RouteName } from '@/core/router'
import { h, addClass, removeClass } from '@/utils/dom'
import { NAV } from '@/data/strings'

// ─── Types ──────────────────────────────────────────────────────────

interface NavTab {
  label: string
  route: RouteName
}

export interface NavTabsProps {
  active: RouteName
  onNavigate: (route: RouteName) => void
}

// ─── Constants ──────────────────────────────────────────────────────

const TABS: readonly NavTab[] = [
  { label: NAV.MONITOR, route: RouteName.MONITOR },
  { label: NAV.GEOMAGNETIC, route: RouteName.GEOMAGNETIC },
  { label: NAV.SEISMIC, route: RouteName.SEISMIC },
  { label: NAV.INTEL, route: RouteName.INTEL }
] as const

// ─── Component ──────────────────────────────────────────────────────

export class NavTabs extends Component<NavTabsProps> {
  private buttons!: HTMLButtonElement[]

  protected create (): HTMLElement {
    this.buttons = []
    const nav = h('nav', { className: cx.root, role: 'tablist' })

    for (const tab of TABS) {
      const btn = h('button', {
        className: cx.tab,
        role: 'tab',
        type: 'button',
        'aria-selected': String(tab.route === this.props.active)
      }, tab.label) as HTMLButtonElement

      if (tab.route === this.props.active) {
        addClass(btn, cx.active)
      }

      btn.addEventListener('click', () => {
        this.props.onNavigate(tab.route)
      })

      this.buttons.push(btn)
      nav.appendChild(btn)
    }

    return nav
  }

  /** Update active tab visuals (called by app on route change) */
  setActive (route: RouteName): void {
    for (let i = 0; i < TABS.length; i++) {
      const btn = this.buttons[i]
      const tab = TABS[i]
      if (tab.route === route) {
        addClass(btn, cx.active)
        btn.setAttribute('aria-selected', 'true')
      } else {
        removeClass(btn, cx.active)
        btn.setAttribute('aria-selected', 'false')
      }
    }
  }
}
