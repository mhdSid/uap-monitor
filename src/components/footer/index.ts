import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { APP_FOOTER_NAME, APP_FOOTER_TAGLINE, APP_URL } from '@/data/strings'

export class Footer extends Component {
  protected create(): HTMLElement {
    const year = new Date().getFullYear()

    return h('footer', { className: cx.root, role: 'contentinfo' },
      h('div', { className: cx.inner },
        h('span', { className: cx.name }, `\u00A9 ${year} ${APP_FOOTER_NAME}`),
        h('span', { className: cx.separator }, '\u00A0\u00B7\u00A0'),
        h('span', { className: cx.tagline }, APP_FOOTER_TAGLINE)
      ),
      h('a', {
        className: cx.domain,
        href: APP_URL,
        rel: 'noopener'
      }, 'uapmonitor.org')
    )
  }
}
