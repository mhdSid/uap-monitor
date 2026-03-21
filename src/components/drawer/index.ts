import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h, addClass, removeClass, setStyles } from '@/core/dom'
import { ARIA } from '@/data/strings'

export type DrawerDensity = 'compact' | 'default' | 'spacious'

export interface DrawerProps {
  /** Content to render inside the drawer body */
  content: HTMLElement
  /** Inner padding density. Default: 'default' */
  density?: DrawerDensity
  /** Called when drawer opens */
  onOpen?: () => void
  /** Called when drawer is dismissed (overlay click, Escape, or swipe down) */
  onClose?: () => void
}

/** Minimum downward drag distance (px) to trigger close */
const CLOSE_THRESHOLD = 80

export class Drawer extends Component<DrawerProps> {
  private isOpen = false
  private overlay!: HTMLElement
  private panel!: HTMLElement

  // ── Drag state ──────────────────────────────────────────────────
  private dragging = false
  private startY = 0
  private currentY = 0

  protected create (): HTMLElement {
    this.overlay = h('div', {
      className: cx.overlay,
      onClick: () => this.close()
    })

    const handle = h('div', {
      className: cx.handle,
      'aria-hidden': 'true'
    }, h('div', { className: cx.handleBar }))

    const density = this.props.density ?? 'default'
    const bodyClasses = [cx.body, cx[`body_${density}` as keyof typeof cx]].filter(Boolean).join(' ')

    this.panel = h('div', {
      className: cx.panel,
      role: 'dialog',
      tabIndex: -1,
      'aria-modal': 'true',
      'aria-label': ARIA.FILTER_BAR
    },
      handle,
      h('div', { className: bodyClasses }, this.props.content)
    )

    // ── Drag to close (from handle only) ───────────────────────────
    handle.addEventListener('touchstart', (e: TouchEvent) => this.onDragStart(e.touches[0].clientY), { passive: true })

    const onTouchMove = (e: TouchEvent): void => {
      if (this.dragging) this.onDragMove(e.touches[0].clientY)
    }
    const onTouchEnd = (): void => {
      if (this.dragging) this.onDragEnd()
    }
    const onMouseMove = (e: MouseEvent): void => {
      if (this.dragging) this.onDragMove(e.clientY)
    }
    const onMouseUp = (): void => {
      if (this.dragging) this.onDragEnd()
    }

    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    this.own(() => document.removeEventListener('touchmove', onTouchMove))
    this.own(() => document.removeEventListener('touchend', onTouchEnd))
    this.own(() => document.removeEventListener('mousemove', onMouseMove))
    this.own(() => document.removeEventListener('mouseup', onMouseUp))

    handle.addEventListener('mousedown', (e: MouseEvent) => this.onDragStart(e.clientY))

    // Escape key
    this.panel.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close()
    })

    const root = h('div', { className: cx.root },
      this.overlay,
      this.panel
    )

    return root
  }

  // ── Drag handlers ───────────────────────────────────────────────

  private onDragStart (y: number): void {
    if (!this.isOpen) return
    this.dragging = true
    this.startY = y
    this.currentY = y
    setStyles(this.panel, { transition: 'none' })
    setStyles(this.overlay, { transition: 'none' })
    setStyles(document.body, { cursor: 'grabbing' })
  }

  private onDragMove (y: number): void {
    if (!this.dragging) return
    this.currentY = y
    const delta = Math.max(0, this.currentY - this.startY)
    setStyles(this.panel, { transform: `translateY(${delta}px)` })

    // Fade overlay proportionally
    const progress = Math.min(delta / CLOSE_THRESHOLD, 1)
    setStyles(this.overlay, { opacity: String(1 - progress * 0.5) })
  }

  private onDragEnd (): void {
    if (!this.dragging) return
    this.dragging = false
    const delta = this.currentY - this.startY

    // Restore transitions + cursor
    setStyles(this.panel, { transition: '' })
    setStyles(this.overlay, { transition: '' })
    setStyles(document.body, { cursor: '' })

    if (delta > CLOSE_THRESHOLD) {
      this.close()
    } else {
      // Snap back
      setStyles(this.panel, { transform: 'translateY(0)' })
      setStyles(this.overlay, { opacity: '1' })
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  open (): void {
    if (this.isOpen) return
    this.isOpen = true
    addClass(this.el, cx.rootOpen)
    setStyles(this.panel, { transform: '' })
    setStyles(this.overlay, { opacity: '' })
    setStyles(document.body, { overflow: 'hidden' })

    // If onOpen is provided, let it handle focus (e.g. auto-focus search input).
    // Otherwise focus the panel for keyboard accessibility.
    if (this.props.onOpen) {
      this.props.onOpen()
    } else {
      this.panel.focus()
    }
  }

  close (): void {
    if (!this.isOpen) return
    this.isOpen = false
    removeClass(this.el, cx.rootOpen)
    setStyles(this.panel, { transform: '' })
    setStyles(this.overlay, { opacity: '' })
    setStyles(document.body, { overflow: '' })
    this.props.onClose?.()
  }

  toggle (): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  get opened (): boolean {
    return this.isOpen
  }
}
