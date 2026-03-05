import './styles.css'
import { cx } from './cx'
import type { GnewsArticle } from '@/types'
import { h } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { AsyncImage } from '@/components/async-image'
import { formatDate } from '@/utils/format'
import { GNEWS_MODAL, ARIA } from '@/data/strings'

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

    // Article image (if available)
    if (a.imageUrl) {
      const image = new AsyncImage({
        src: a.imageUrl,
        alt: a.title || GNEWS_MODAL.IMAGE_ALT
      })
      children.push(
        h('div', { className: cx.image }, image.el)
      )
    }

    // Description as summary text
    if (a.description) {
      children.push(h('p', { className: cx.desc }, a.description))
    }

    // Full content body (longer text from GNews API)
    if (a.content && a.content !== a.description) {
      children.push(h('p', { className: cx.body }, a.content))
    }

    // Metadata rows
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

    return h('div', { className: cx.content }, ...children)
  }

  private static buildFooter(a: GnewsArticle): HTMLElement {
    const sourceTarget = a.sourceUrl || a.url

    return h('div', { className: cx.footer },
      h('span', { className: cx.sourceTag },
        GNEWS_MODAL.FOOTER_PREFIX + GNEWS_MODAL.FOOTER_SEPARATOR + a.sourceName
      ),
      h('a', {
        className: cx.footerLink,
        href: sourceTarget,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': ARIA.VISIT_SOURCE
      }, GNEWS_MODAL.VIEW_SOURCE)
    )
  }
}
