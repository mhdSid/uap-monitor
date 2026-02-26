import { ARIA } from '@/data/strings'
import { AlertVariant } from '@/enums'
import { h } from '@/utils/dom'

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
  [AlertVariant.NEUTRAL]: { border: 'var(--color-dim)', text: 'var(--color-muted)', icon: '—' },
}

export function renderAlert(props: AlertProps): HTMLElement {
  const colors = VARIANT_COLORS[props.variant]

  const alert = h('div', {
    className: `alert alert--${props.variant}`,
    role: 'alert',
    style: {
      borderColor: colors.border,
    },
  })

  const icon = h('span', {
    className: 'alert__icon',
    style: { color: colors.text },
  }, colors.icon)

  const body = h('div', { className: 'alert__body' })

  if (props.title) {
    body.appendChild(
      h('div', {
        className: 'alert__title',
        style: { color: colors.text },
      }, props.title),
    )
  }

  const content = h('div', { className: 'alert__content' })
  if (typeof props.content === 'string') {
    content.textContent = props.content
  } else {
    content.appendChild(props.content)
  }
  body.appendChild(content)

  alert.appendChild(icon)
  alert.appendChild(body)

  if (props.dismissible) {
    const closeBtn = h('button', {
      className: 'alert__close',
      'aria-label': ARIA.DISMISS_ALERT,
      onClick: () => {
        alert.style.opacity = '0'
        setTimeout(() => alert.remove(), 200)
      },
    }, '×')
    alert.appendChild(closeBtn)
  }

  return alert
}
