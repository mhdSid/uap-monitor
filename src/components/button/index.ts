import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  Button — styled, accessible button component                       *
 *                                                                     *
 *  Variants: solid, outline, soft, ghost                              *
 *  Colors:   primary (green), secondary (cyan), neutral, error        *
 *  Sizes:    xs, sm, md, lg                                           *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import { h, addClass } from '@/utils/dom'

// ─── Types ──────────────────────────────────────────────────────────

export type ButtonVariant = 'solid' | 'outline' | 'soft' | 'ghost'
export type ButtonColor = 'primary' | 'secondary' | 'neutral' | 'error'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps {
  label: string
  variant?: ButtonVariant
  color?: ButtonColor
  size?: ButtonSize
  block?: boolean
  disabled?: boolean
  icon?: () => SVGSVGElement
  trailingIcon?: () => SVGSVGElement
  onClick?: () => void
}

// ─── Component ──────────────────────────────────────────────────────

export class Button extends Component<ButtonProps> {
  protected create(): HTMLElement {
    const {
      label,
      variant = 'solid',
      color = 'primary',
      size = 'md',
      block = false,
      disabled = false,
      icon,
      trailingIcon,
      onClick
    } = this.props

    const classes = [
      'btn',
      `btn--${variant}`,
      `btn--${color}`,
      `btn--${size}`
    ]
    if (block) classes.push('btn--block')

    const children: (HTMLElement | SVGSVGElement | string)[] = []

    if (icon) {
      const svg = icon()
      addClass(svg, cx.icon)
      children.push(svg)
    }

    children.push(h('span', { className: cx.label }, label))

    if (trailingIcon) {
      const svg = trailingIcon()
      addClass(svg, cx.icon, cx.iconTrailing)
      children.push(svg)
    }

    const btn = h('button', {
      className: classes.join(' '),
      type: 'button',
      disabled: disabled || undefined,
      onClick: onClick ?? undefined
    }, ...children)

    return btn
  }
}
