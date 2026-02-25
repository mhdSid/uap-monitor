import type { CredibilityBarProps } from '@/types'
import { h } from '@/utils/dom'

export function renderCredibilityBar(props: CredibilityBarProps): HTMLElement {
  const { value } = props
  let color = 'var(--color-muted)'
  if (value > 80) color = 'var(--color-green)'
  else if (value > 65) color = 'var(--color-amber)'

  return h('div', { className: 'credibility-bar' },
    h('div', { className: 'credibility-bar__track' },
      h('div', {
        className: 'credibility-bar__fill',
        style: { width: `${Math.min(value, 100)}%`, backgroundColor: color },
      }),
    ),
    h('span', { className: 'credibility-bar__label' }, String(value)),
  )
}
