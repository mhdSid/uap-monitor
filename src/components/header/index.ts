import { h } from '@/utils/dom'
import { iconRadar, iconGithub } from '@/components/icons'

const REPO_URL = import.meta.env.VITE_REPO_URL ?? 'https://github.com/mhdSid/uap-monitor'

export function renderHeader(): HTMLElement {
  const radar = iconRadar(16)
  radar.style.color = 'var(--color-green)'

  const left = h('div', { className: 'app-header__left' },
    radar,
    h('span', { className: 'app-header__title' }, 'UAP MONITOR'),
    h('span', { className: 'app-header__version' }, 'v0.1.0'),
  )

  const clock = h('time', {
    className: 'app-header__clock',
    'aria-label': 'Current UTC time',
  })

  function updateClock(): void {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const iso = now.toISOString()
    clock.setAttribute('datetime', iso)
    clock.textContent =
      `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
      `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`
  }
  updateClock()
  setInterval(updateClock, 1000)

  const githubIcon = iconGithub(14)
  githubIcon.style.color = 'var(--color-muted)'

  const githubLink = h('a', {
    className: 'app-header__github',
    href: REPO_URL,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': 'View source on GitHub',
  }, githubIcon)

  const right = h('div', { className: 'app-header__right' },
    clock,
    githubLink,
  )

  return h('header', { className: 'app-header', role: 'banner' }, left, right)
}
