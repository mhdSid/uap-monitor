import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { APP_FOOTER } from '@/data/strings'

export class Footer extends Component {
  protected create(): HTMLElement {
    return h('div', {
      className: cx.root,
      role: 'contentinfo',
    }, APP_FOOTER)
  }
}
