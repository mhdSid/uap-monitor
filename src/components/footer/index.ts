import { Component } from '@/core'
import { h } from '@/utils/dom'
import { APP_FOOTER } from '@/data/strings'

export class Footer extends Component {
  protected create(): HTMLElement {
    return h('div', {
      className: 'app-footer',
      role: 'contentinfo',
    }, APP_FOOTER)
  }
}
