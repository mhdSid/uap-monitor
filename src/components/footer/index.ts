import { h } from '@/utils/dom'
import { APP_FOOTER } from '@/data/strings'

export function renderFooter(): HTMLElement {
  return h('div', {
    className: 'app-footer',
    role: 'contentinfo',
  }, APP_FOOTER)
}
