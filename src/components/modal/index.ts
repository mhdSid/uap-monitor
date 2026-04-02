import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  Modal — singleton dialog with focus trap & WAI-ARIA compliance     *
 *                                                                     *
 *  Usage:                                                             *
 *    Modal.open({ header, content, footer }, triggerEl)               *
 *    Modal.close()                                                    *
 *                                                                     *
 *  Only one modal can be open at a time. Opening a new one closes     *
 *  the previous. Focus is trapped and returned on close.              *
 * ------------------------------------------------------------------ */

import type { ModalSlots } from '@/types'
import { h, addClass, removeClass, setAttrs, qs } from '@/core/dom'
import { iconClose } from '@/components/icons'
import { ARIA } from '@/data/strings'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const TRANSITION_MS = 200

export class Modal {
  // ─── Singleton state ────────────────────────────────────────────
  private static overlay: HTMLElement | null = null
  public static dialog: HTMLElement | null = null
  private static trigger: HTMLElement | null = null
  private static onKeydown: ((e: KeyboardEvent) => void) | null = null
  private static onCloseCallback: (() => void) | null = null

  // ─── Public API ─────────────────────────────────────────────────

  static open (slots: ModalSlots, trigger?: HTMLElement | null): void {
    Modal.close()

    Modal.trigger = trigger ?? (document.activeElement as HTMLElement | null)

    const closeBtn = h('button', {
      className: cx.close,
      'aria-label': ARIA.CLOSE_MODAL,
      onClick: () => Modal.close()
    }, iconClose(14))

    const headerBar = h('div', { className: cx.header })
    if (slots.header) headerBar.appendChild(slots.header())
    headerBar.appendChild(closeBtn)

    const dialog = h('div', {
      className: cx.root,
      role: 'dialog',
      'aria-modal': 'true'
    }, headerBar)

    const headerEl = qs(`.${cx.header}`, headerBar)
    if (headerEl) {
      const headerId = headerEl.id || `modal-header-${Date.now()}`
      headerEl.id = headerId
      setAttrs(dialog, { 'aria-labelledby': headerId })
    }

    if (slots.content) {
      dialog.appendChild(h('div', { className: cx.content }, slots.content()))
    }
    if (slots.footer) {
      dialog.appendChild(h('div', { className: cx.footer }, slots.footer()))
    }

    const overlay = h('div', { className: cx.overlay }, dialog)
    overlay.addEventListener('click', (e: Event) => {
      if (e.target === overlay) Modal.close()
    })

    document.body.appendChild(overlay)
    Modal.overlay = overlay
    Modal.dialog = dialog
    Modal.onCloseCallback = slots.onClose ?? null

    addClass(document.body, 'modal-open')

    // Hide app content from assistive tech (not body — overlay is a body child)
    const appRoot = document.getElementById('app')
    if (appRoot) setAttrs(appRoot, { 'aria-hidden': 'true' })

    Modal.onKeydown = Modal.handleKeydown.bind(Modal)
    document.addEventListener('keydown', Modal.onKeydown)

    const firstFocusable = Modal.getFocusable(dialog)[0] ?? closeBtn
    firstFocusable.focus()

    requestAnimationFrame(() => addClass(overlay, 'modal-overlay--visible'))
  }

  static close (): void {
    if (!Modal.overlay) return

    removeClass(Modal.overlay, 'modal-overlay--visible')
    removeClass(document.body, 'modal-open')

    const appRoot = document.getElementById('app')
    if (appRoot) setAttrs(appRoot, { 'aria-hidden': null })

    if (Modal.onKeydown) {
      document.removeEventListener('keydown', Modal.onKeydown)
      Modal.onKeydown = null
    }

    if (Modal.onCloseCallback) Modal.onCloseCallback()

    setTimeout(() => {
      Modal.overlay?.remove()

      if (Modal.trigger?.isConnected) {
        Modal.trigger.focus()
      }

      Modal.overlay = null
      Modal.dialog = null
      Modal.trigger = null
      Modal.onCloseCallback = null
    }, TRANSITION_MS)
  }

  static get isOpen (): boolean {
    return Modal.overlay !== null
  }

  // ─── Internal ───────────────────────────────────────────────────

  private static getFocusable (root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
  }

  private static handleKeydown (e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      Modal.close()
      return
    }

    if (e.key === 'Tab' && Modal.dialog) {
      const focusable = Modal.getFocusable(Modal.dialog)
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }
}
