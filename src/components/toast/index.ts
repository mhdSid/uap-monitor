import type { ToastMessage } from '@/types'
import { h, addClass, generateId, qsa } from '@/utils/dom'

const TOAST_DURATION = 4000
let container: HTMLElement | null = null

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container
  container = h('div', { className: 'toast-container', 'aria-live': 'polite' })
  document.body.appendChild(container)
  return container
}

function removeToast(id: string) {
  const matches = qsa(`[data-id="${id}"]`)
  const el = matches[0]
  if (!el) return
  addClass(el, 'toast--exit')
  setTimeout(() => el.remove(), 300)
}

export function renderToast(message: ToastMessage): HTMLElement {
  return h('div', {
    className: `toast toast--${message.type}`,
    dataset: { id: message.id },
    role: 'alert',
  }, message.text)
}

export function useToast() {
  function show(text: string, type: ToastMessage['type'] = 'info') {
    const id = generateId()
    const toastEl = renderToast({ id, text, type })
    const c = ensureContainer()
    c.appendChild(toastEl)
    setTimeout(() => removeToast(id), TOAST_DURATION)
  }

  return {
    info: (text: string) => show(text, 'info'),
    success: (text: string) => show(text, 'success'),
    error: (text: string) => show(text, 'error'),
  }
}
