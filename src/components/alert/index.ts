import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { AlertVariant } from '@/enums'
import { ARIA } from '@/data/strings'
import { h, setStyles } from '@/utils/dom'

export interface AlertProps {
  variant: AlertVariant
  title?: string
  content: string | HTMLElement
  dismissible?: boolean
}

const VARIANT_COLORS: Record<AlertVariant, { border: string; text: string; icon: string }> = {
  [AlertVariant.PRIMARY]: { border: 'var(--color-green)', text: 'var(--color-green)', icon: '◉' },
  [AlertVariant.SECONDARY]: { border: 'var(--color-purple)', text: 'var(--color-purple)', icon: '◈' },
  [AlertVariant.SUCCESS]: { border: 'var(--color-green)', text: 'var(--color-green)', icon: '✓' },
  [AlertVariant.INFO]: { border: 'var(--color-cyan)', text: 'var(--color-cyan)', icon: 'ℹ' },
  [AlertVariant.WARNING]: { border: 'var(--color-amber)', text: 'var(--color-amber)', icon: '⚠' },
  [AlertVariant.ERROR]: { border: 'var(--color-red)', text: 'var(--color-red)', icon: '✕' },
  [AlertVariant.NEUTRAL]: { border: 'var(--color-dim)', text: 'var(--color-muted)', icon: '—' }
}

export class Alert extends Component<AlertProps> {
  protected create (): HTMLElement {
    const colors = VARIANT_COLORS[this.props.variant]

    const alert = h('div', {
      className: `${cx.root} alert--${this.props.variant}`,
      role: 'alert',
      style: { borderColor: colors.border }
    })

    const icon = h('span', {
      className: cx.icon,
      style: { color: colors.text }
    }, colors.icon)

    const body = h('div', { className: cx.body })

    if (this.props.title) {
      body.appendChild(
        h('div', {
          className: cx.title,
          style: { color: colors.text }
        }, this.props.title)
      )
    }

    const content = h('div', { className: cx.content })
    if (typeof this.props.content === 'string') {
      content.textContent = this.props.content
    } else {
      content.appendChild(this.props.content)
    }
    body.appendChild(content)

    alert.appendChild(icon)
    alert.appendChild(body)

    if (this.props.dismissible) {
      alert.appendChild(
        h('button', {
          className: cx.close,
          'aria-label': ARIA.DISMISS_ALERT,
          onClick: () => {
            setStyles(alert, { opacity: '0' })
            setTimeout(() => alert.remove(), 200)
          }
        }, '×')
      )
    }

    return alert
  }
}
