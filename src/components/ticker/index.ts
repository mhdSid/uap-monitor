import type { TickerProps } from '@/types'
import { h } from '@/utils/dom'

const DEFAULT_MESSAGES = [
  '// SCANNING CJK SOURCES FOR NEW UAP REPORTS...',
  '// 3 NEW SIGHTINGS DETECTED IN LAST HOUR — EAST ASIA CLUSTER',
  '// CROSS-REFERENCING OPENSKY FLIGHT DATA WITH SIGHTING COORDS...',
  '// NASA FIREBALL API: 1 NEW EVENT NEAR HOKKAIDO',
  '// GDELT: 14 NEW UAP-RELATED ARTICLES IN JP/KR/CN/RU SOURCES',
]

export function renderTicker(props?: TickerProps): HTMLElement {
  const messages = props?.messages ?? DEFAULT_MESSAGES
  const textEl = h('span', { className: 'ticker__text' })
  const ticker = h('div', { className: 'ticker', role: 'marquee', 'aria-live': 'off' }, textEl)

  let msgIdx = 0
  let charIdx = 0

  function tick() {
    const msg = messages[msgIdx]!
    if (charIdx <= msg.length) {
      textEl.textContent = msg.slice(0, charIdx) + '▊'
      charIdx++
      setTimeout(tick, 25)
    } else {
      textEl.textContent = msg
      setTimeout(() => {
        msgIdx = (msgIdx + 1) % messages.length
        charIdx = 0
        tick()
      }, 2500)
    }
  }

  tick()
  return ticker
}
