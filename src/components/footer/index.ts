import './styles.css'
import { cx } from './cx'
import { Component } from '@/core'
import { h } from '@/utils/dom'
import { APP_FOOTER_NAME, APP_FOOTER_TAGLINE, APP_URL } from '@/data/strings'
import { FOOTER_LINKS, CONTACT } from '@/data/legal'
import { TermsModal } from '@/components/terms-modal'
import { WelcomeModal } from '@/components/welcome-modal'

export class Footer extends Component {
  protected create (): HTMLElement {
    const year = new Date().getFullYear()

    const aboutLink = h('button', {
      className: cx.link,
      onClick: () => WelcomeModal.show()
    }, FOOTER_LINKS.ABOUT)

    const termsLink = h('button', {
      className: cx.link,
      onClick: (e: Event) => TermsModal.open(e.target as HTMLElement)
    }, FOOTER_LINKS.TERMS)

    const contactLink = h('a', {
      className: cx.link,
      href: CONTACT.MAILTO
    }, FOOTER_LINKS.CONTACT)

    return h('footer', { className: cx.root, role: 'contentinfo' },
      h('div', { className: cx.inner },
        h('span', { className: cx.name }, `\u00A9 ${year} ${APP_FOOTER_NAME}`),
        h('span', { className: cx.separator }, '\u00A0\u00B7\u00A0'),
        h('span', { className: cx.tagline }, APP_FOOTER_TAGLINE)
      ),
      h('div', { className: cx.links },
        h('a', {
          className: cx.domain,
          href: APP_URL,
          rel: 'noopener'
        }, 'uapmonitor.org'),
        h('span', { className: cx.linkSep }, '\u00B7'),
        aboutLink,
        h('span', { className: cx.linkSep }, '\u00B7'),
        termsLink,
        h('span', { className: cx.linkSep }, '\u00B7'),
        contactLink
      )
    )
  }
}
