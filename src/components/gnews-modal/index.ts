import './styles.css'
import { cx } from './cx'
import type { GnewsArticle } from '@/types'
import { h } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { formatDate } from '@/utils/format'
import { GNEWS_MODAL } from '@/data/strings'

export class GnewsModal {
  static open(article: GnewsArticle, trigger?: HTMLElement): void {
    Modal.open({
      header: () => GnewsModal.buildHeader(article),
      content: () => GnewsModal.buildContent(article),
      footer: () => GnewsModal.buildFooter(article)
    }, trigger)
  }

  private static buildHeader(a: GnewsArticle): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, a.title || GNEWS_MODAL.EMPTY_VALUE),
      h('span', { className: cx.sourceName }, a.sourceName)
    )
  }

  private static buildContent(a: GnewsArticle): HTMLElement {
    const children: HTMLElement[] = []

    // Description at the top if available
    if (a.description) {
      children.push(h('p', { className: cx.desc }, a.description))
    }

    const rows: [string, string][] = [
      [GNEWS_MODAL.SOURCE, a.sourceName || GNEWS_MODAL.EMPTY_VALUE],
      [GNEWS_MODAL.PUBLISHED, formatDate(a.publishedAt)]
    ]

    children.push(...rows.map(([label, value]) =>
      h('div', { className: cx.row },
        h('span', { className: cx.label }, label),
        h('span', { className: cx.value }, value)
      )
    ))

    // Article link
    children.push(
      h('div', { className: cx.row },
        h('span', { className: cx.label }, GNEWS_MODAL.URL),
        h('a', {
          className: `${cx.value} ${cx.link}`,
          href: a.url,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, a.url.length > 60 ? a.url.slice(0, 60) + '\u2026' : a.url)
      )
    )

    return h('div', { className: cx.content }, ...children)
  }

  private static buildFooter(a: GnewsArticle): HTMLElement {
    return h('div', { className: cx.footer },
      h('span', { className: cx.sourceTag },
        GNEWS_MODAL.FOOTER_PREFIX + GNEWS_MODAL.FOOTER_SEPARATOR + a.sourceName
      )
    )
  }
}
