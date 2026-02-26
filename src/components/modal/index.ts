import type { ModalSlots } from '@/types'
import { h, addClass, removeClass, setAttrs } from '@/utils/dom'
import { iconClose } from '@/components/icons'

let activeModal: HTMLElement | null = null
let triggerElement: HTMLElement | null = null

/**
 * Query all focusable elements inside the modal dialog.
 */
function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  const selectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(dialog.querySelectorAll<HTMLElement>(selectors))
}

/**
 * Open a modal dialog with focus trap, sticky header, and scrollable content.
 * Follows WAI-ARIA Dialog (Modal) pattern.
 *
 * @param slots - Content slots for header, content, and footer
 * @param trigger - The element that triggered the modal (for focus return)
 */
export function openModal(slots: ModalSlots, trigger?: HTMLElement | null): void {
  closeModal()

  // Store the trigger explicitly, fall back to activeElement
  triggerElement = trigger ?? (document.activeElement as HTMLElement | null)

  const closeIcon = iconClose(14)

  const closeBtn = h('button', {
    className: 'modal__close',
    'aria-label': 'Close modal',
    onClick: closeModal,
  }, closeIcon)

  const headerBar = h('div', { className: 'modal__header' })
  if (slots.header) headerBar.appendChild(slots.header())
  headerBar.appendChild(closeBtn)

  const dialog = h('div', {
    className: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
  }, headerBar)

  // aria-labelledby: point to the title element if present
  const titleEl = headerBar.querySelector('.modal-sighting__title, .modal__title')
  if (titleEl) {
    const titleId = titleEl.id || `modal-title-${Date.now()}`
    titleEl.id = titleId
    dialog.setAttribute('aria-labelledby', titleId)
  }

  if (slots.content) {
    dialog.appendChild(h('div', { className: 'modal__content' }, slots.content()))
  }
  if (slots.footer) {
    dialog.appendChild(h('div', { className: 'modal__footer' }, slots.footer()))
  }

  const overlay = h('div', { className: 'modal-overlay' }, dialog)
  overlay.addEventListener('click', (e: Event) => {
    if (e.target === overlay) closeModal()
  })

  document.body.appendChild(overlay)
  activeModal = overlay
  addClass(document.body, 'modal-open')
  setAttrs(document.body, { 'aria-hidden': 'true' })

  document.addEventListener('keydown', handleKeydown)

  // Focus the close button
  closeBtn.focus()

  requestAnimationFrame(() => addClass(overlay, 'modal-overlay--visible'))
}

export function closeModal(): void {
  if (!activeModal) return
  removeClass(activeModal, 'modal-overlay--visible')
  removeClass(document.body, 'modal-open')
  setAttrs(document.body, { 'aria-hidden': null })

  document.removeEventListener('keydown', handleKeydown)

  const ref = activeModal
  const returnTarget = triggerElement

  activeModal = null
  triggerElement = null

  setTimeout(() => {
    ref.remove()

    // Restore focus to the element that triggered the modal
    if (returnTarget && returnTarget.isConnected) {
      returnTarget.focus()
    }
  }, 200)
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeModal()
    return
  }

  // Focus trap: cycle Tab/Shift+Tab within modal
  if (e.key === 'Tab' && activeModal) {
    const dialog = activeModal.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) return

    const focusable = getFocusableElements(dialog)
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
