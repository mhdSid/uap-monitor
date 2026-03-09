import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { ARIA } from '@/data/strings'

export interface DrawerProps {
  /** Content to render inside the drawer body */
  content: HTMLElement
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

  protected create(): HTMLElement {
    this.overlay = h('div', {
      className: cx.overlay,
      onClick: () => this.close()
    })

    const handle = h('div', {
      className: cx.handle,
      'aria-hidden': 'true'
    }, h('div', { className: cx.handleBar }))

    this.panel = h('div', {
      className: cx.panel,
      role: 'dialog',
      tabIndex: -1,
      'aria-modal': 'true',
      'aria-label': ARIA.FILTER_BAR
    },
      handle,
      h('div', { className: cx.body }, this.props.content)
    )

    // ── Drag to close (from handle only) ───────────────────────────
    handle.addEventListener('touchstart', (e: TouchEvent) => this.onDragStart(e.touches[0].clientY), { passive: true })
    document.addEventListener('touchmove', (e: TouchEvent) => {
      if (this.dragging) this.onDragMove(e.touches[0].clientY)
    }, { passive: true })
    document.addEventListener('touchend', () => {
      if (this.dragging) this.onDragEnd()
    })

    handle.addEventListener('mousedown', (e: MouseEvent) => this.onDragStart(e.clientY))
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.dragging) this.onDragMove(e.clientY)
    })
    document.addEventListener('mouseup', () => {
      if (this.dragging) this.onDragEnd()
    })

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

  private onDragStart(y: number): void {
    if (!this.isOpen) return
    this.dragging = true
    this.startY = y
    this.currentY = y
    this.panel.style.transition = 'none'
    this.overlay.style.transition = 'none'
    document.body.style.cursor = 'grabbing'
  }

  private onDragMove(y: number): void {
    if (!this.dragging) return
    this.currentY = y
    const delta = Math.max(0, this.currentY - this.startY)
    this.panel.style.transform = `translateY(${delta}px)`

    // Fade overlay proportionally
    const progress = Math.min(delta / CLOSE_THRESHOLD, 1)
    this.overlay.style.opacity = String(1 - progress * 0.5)
  }

  private onDragEnd(): void {
    if (!this.dragging) return
    this.dragging = false
    const delta = this.currentY - this.startY

    // Restore transitions + cursor
    this.panel.style.transition = ''
    this.overlay.style.transition = ''
    document.body.style.cursor = ''

    if (delta > CLOSE_THRESHOLD) {
      this.close()
    } else {
      // Snap back
      this.panel.style.transform = 'translateY(0)'
      this.overlay.style.opacity = '1'
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  open(): void {
    if (this.isOpen) return
    this.isOpen = true
    this.el.classList.add(cx.rootOpen)
    this.panel.style.transform = ''
    this.overlay.style.opacity = ''
    document.body.style.overflow = 'hidden'

    // If onOpen is provided, let it handle focus (e.g. auto-focus search input).
    // Otherwise focus the panel for keyboard accessibility.
    if (this.props.onOpen) {
      this.props.onOpen()
    } else {
      this.panel.focus()
    }
  }

  close(): void {
    if (!this.isOpen) return
    this.isOpen = false
    this.el.classList.remove(cx.rootOpen)
    this.panel.style.transform = ''
    this.overlay.style.opacity = ''
    document.body.style.overflow = ''
    this.props.onClose?.()
  }

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  get opened(): boolean {
    return this.isOpen
  }
}
