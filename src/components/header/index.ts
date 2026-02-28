import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, setAttrs } from '@/utils/dom'
import { iconRadar, iconGithub } from '@/components/icons'
import { APP_NAME, APP_VERSION, APP_REPO_FALLBACK, ARIA } from '@/data/strings'

const REPO_URL = import.meta.env.VITE_REPO_URL ?? APP_REPO_FALLBACK

export class Header extends Component {
  private clockTimer!: number

  protected create(): HTMLElement {
    this.clockTimer = 0
    const radar = iconRadar(16)
    radar.style.color = 'var(--color-green)'

    const left = h('div', { className: cx.left },
      radar,
      h('span', { className: cx.title }, APP_NAME),
      h('span', { className: cx.version }, APP_VERSION)
    )

    const clock = h('time', {
      className: cx.clock,
      'aria-label': ARIA.CLOCK
    })

    const updateClock = (): void => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setAttrs(clock, { datetime: now.toISOString() })
      clock.textContent =
        `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
        `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`
    }
    updateClock()
    this.clockTimer = window.setInterval(updateClock, 1000)

    const githubIcon = iconGithub(14)
    githubIcon.style.color = 'var(--color-muted)'

    const githubLink = h('a', {
      className: cx.github,
      href: REPO_URL,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': ARIA.GITHUB
    }, githubIcon)

    const right = h('div', { className: cx.right },
      clock,
      githubLink
    )

    return h('header', { className: cx.root, role: 'banner' }, left, right)
  }

  destroy(): void {
    clearInterval(this.clockTimer)
    super.destroy()
  }
}
