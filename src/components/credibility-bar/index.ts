import { Component } from '@/core'
import type { CredibilityBarProps } from '@/types'
import { h } from '@/utils/dom'

enum CredibilityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

const LEVEL_COLORS: Record<CredibilityLevel, string> = {
  [CredibilityLevel.HIGH]: 'var(--color-green)',
  [CredibilityLevel.MEDIUM]: 'var(--color-amber)',
  [CredibilityLevel.LOW]: 'var(--color-muted)',
}

function getLevel(value: number): CredibilityLevel {
  if (value > 80) return CredibilityLevel.HIGH
  if (value > 65) return CredibilityLevel.MEDIUM
  return CredibilityLevel.LOW
}

export class CredibilityBar extends Component<CredibilityBarProps> {
  protected create(): HTMLElement {
    const { value } = this.props
    const color = LEVEL_COLORS[getLevel(value)]

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
}
