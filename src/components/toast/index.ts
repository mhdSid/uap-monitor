import type { ToastMessage } from '@/types'
import { ToastVariant } from '@/enums'
import { h, addClass, generateId, qsa } from '@/utils/dom'

const TOAST_DURATION = 4000

const VARIANT_CLASS: Record<ToastVariant, string> = {
  [ToastVariant.ERROR]: 'toast--error',
  [ToastVariant.SUCCESS]: 'toast--success',
  [ToastVariant.INFO]: 'toast--info',
}

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

function renderToast(message: ToastMessage): HTMLElement {
  const variantClass = VARIANT_CLASS[message.variant]
  return h('div', {
    className: `toast ${variantClass}`,
    dataset: { id: message.id },
    role: 'alert',
  }, message.text)
}

export function useToast() {
  function show(text: string, variant: ToastVariant = ToastVariant.INFO) {
    const id = generateId()
    const toastEl = renderToast({ id, text, variant })
    const c = ensureContainer()
    c.appendChild(toastEl)
    setTimeout(() => removeToast(id), TOAST_DURATION)
  }

  return {
    info: (text: string) => show(text, ToastVariant.INFO),
    success: (text: string) => show(text, ToastVariant.SUCCESS),
    error: (text: string) => show(text, ToastVariant.ERROR),
  }
}
