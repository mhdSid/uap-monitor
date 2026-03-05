import './styles.css'
import { cx } from './cx'
import type { GdeltArticle } from '@/types'
import { h } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { AsyncImage } from '@/components/async-image'
import { createToneTag } from '@/components/tags'
import { formatDate } from '@/utils/format'
import { GDELT_MODAL, ARIA } from '@/data/strings'

export class GdeltModal {
  static open(article: GdeltArticle, trigger?: HTMLElement): void {
    Modal.open({
      header: () => GdeltModal.buildHeader(article),
      content: () => GdeltModal.buildContent(article),
      footer: () => GdeltModal.buildFooter(article)
    }, trigger)
  }

  private static buildHeader(a: GdeltArticle): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, a.title || GDELT_MODAL.EMPTY_VALUE),
      h('span', { className: cx.domain }, a.domain)
    )
  }

  private static buildContent(a: GdeltArticle): HTMLElement {
    const children: HTMLElement[] = []

    // Article image (if available)
    if (a.imageUrl) {
      const image = new AsyncImage({
        src: a.imageUrl,
        alt: a.title || GDELT_MODAL.IMAGE_ALT
      })
      children.push(
        h('div', { className: cx.image }, image.el)
      )
    }

    // Metadata rows
    const rows: [string, string | HTMLElement][] = [
      [GDELT_MODAL.SOURCE, a.sourceName || a.domain],
      [GDELT_MODAL.PUBLISHED, formatDate(a.publishedAt)],
      [GDELT_MODAL.LANGUAGE, (a.language || 'en').toUpperCase()],
      [GDELT_MODAL.COUNTRY, a.country || GDELT_MODAL.EMPTY_VALUE],
      [GDELT_MODAL.TONE, createToneTag(a.tone)]
    ]

    children.push(...rows.map(([label, value]) =>
      h('div', { className: cx.row },
        h('span', { className: cx.label }, label),
        typeof value === 'string'
          ? h('span', { className: cx.value }, value)
          : value
      )
    ))

    // Article link
    children.push(
      h('div', { className: cx.row },
        h('span', { className: cx.label }, GDELT_MODAL.URL),
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

  private static buildFooter(a: GdeltArticle): HTMLElement {
    return h('div', { className: cx.footer },
      h('span', { className: cx.sourceTag },
        `${GDELT_MODAL.FOOTER_PREFIX}${GDELT_MODAL.FOOTER_SEPARATOR}${a.domain}`
      ),
      h('a', {
        className: cx.footerLink,
        href: a.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': ARIA.VISIT_SOURCE
      }, GDELT_MODAL.VIEW_SOURCE)
    )
  }
}
