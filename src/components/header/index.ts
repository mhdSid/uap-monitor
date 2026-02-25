import { h } from '@/utils/dom'
import { iconRadar } from '@/components/icons'

export function renderHeader(): HTMLElement {
  const radar = iconRadar(16)
  radar.style.color = 'var(--color-green)'

  const left = h('div', { className: 'app-header__left' },
    radar,
    h('span', { className: 'app-header__title' }, 'UAP MONITOR'),
    h('span', { className: 'app-header__version' }, 'v0.1.0'),
  )

  const clock = h('span', { className: 'app-header__clock' })

  function updateClock() {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    clock.textContent =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} UTC`
  }
  updateClock()
  setInterval(updateClock, 1000)

  return h('header', { className: 'app-header', role: 'banner' }, left, clock)
}
