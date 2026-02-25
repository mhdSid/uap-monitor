import { h } from '@/utils/dom'

export function renderFooter(): HTMLElement {
  return h('div', {
    className: 'app-footer',
    role: 'contentinfo',
  }, 'UAP MONITOR v0.1.0 — CJK + RUSSIA INTELLIGENCE LAYER')
}
