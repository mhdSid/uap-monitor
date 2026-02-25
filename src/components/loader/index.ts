import { h, rawHtml } from '@/utils/dom'

export function renderLoader(): HTMLElement {
  const sweep = h('div', { className: 'radar-loader__sweep' })
  sweep.appendChild(rawHtml(`
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-border)" stroke-width="1"/>
      <circle cx="40" cy="40" r="24" fill="none" stroke="var(--color-border)" stroke-width="1"/>
      <circle cx="40" cy="40" r="12" fill="none" stroke="var(--color-border)" stroke-width="1"/>
      <circle cx="40" cy="40" r="2.5" fill="var(--color-green)"/>
      <line x1="40" y1="40" x2="40" y2="6" stroke="var(--color-green)" stroke-width="1.5" stroke-linecap="round" class="radar-loader__hand"/>
    </svg>
  `))

  return h('div', {
    className: 'radar-loader',
    role: 'status',
    'aria-label': 'Loading sighting data',
  },
    sweep,
    h('div', { className: 'radar-loader__text' }, 'Loading...'),
  )
}
