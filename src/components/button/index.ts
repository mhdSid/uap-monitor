import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  Button — styled, accessible button component                       *
 *                                                                     *
 *  Variants: solid, filled, outline, soft, ghost                      *
 *  Colors:   primary (green), secondary (cyan), neutral, error        *
 *  Sizes:    xs, sm, md, lg                                           *
 *  Shape:    round (icon-only circular button)                        *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, addClass } from '@/core/dom'
import { ButtonSize, ButtonVariant, ButtonColor } from '@/enums'

// ─── Types ──────────────────────────────────────────────────────────

export interface ButtonProps {
  label: string
  variant?: ButtonVariant
  color?: ButtonColor
  size?: ButtonSize
  block?: boolean
  round?: boolean
  disabled?: boolean
  pill?: boolean
  ariaLabel?: string
  icon?: () => SVGSVGElement
  trailingIcon?: () => SVGSVGElement
  onClick?: () => void
}

// ─── Component ──────────────────────────────────────────────────────

export class Button extends Component<ButtonProps> {
  protected create (): HTMLElement {
    const {
      label,
      variant = ButtonVariant.SOLID,
      color = ButtonColor.PRIMARY,
      size = ButtonSize.MD,
      block = false,
      round = false,
      disabled = false,
      ariaLabel,
      pill,
      icon,
      trailingIcon,
      onClick
    } = this.props

    const classes: string[] = [
      cx.root,
      `btn--${variant}`,
      `btn--${color}`,
      `btn--${size}`
    ]
    if (block) classes.push(cx.block)
    if (round) classes.push(cx.round)
    if (pill) classes.push(cx.pill)

    const children: (HTMLElement | SVGSVGElement | string)[] = []

    if (icon) {
      const svg = icon()
      addClass(svg, cx.icon)
      children.push(svg)
    }

    // Round buttons are icon-only — hide label visually
    if (!round) {
      children.push(h('span', { className: cx.label }, label))
    }

    if (trailingIcon && !round) {
      const svg = trailingIcon()
      addClass(svg, cx.icon, cx.iconTrailing)
      children.push(svg)
    }

    const btn = h('button', {
      className: classes.join(' '),
      type: 'button',
      disabled: disabled || undefined,
      'aria-label': round ? (ariaLabel || label) : ariaLabel,
      onClick: onClick ?? undefined
    }, ...children)

    return btn
  }
}
