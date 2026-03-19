import './styles.css'
import { cx } from './cx'
import type { RedditArticle } from '@/types'
import { h } from '@/core/dom'
import { Modal } from '@/components/modal'
import { AsyncImage } from '@/components/async-image'
import { formatDate } from '@/utils/format'
import { REDDIT_MODAL, ARIA, GDELT_MODAL } from '@/data/strings'

function formatCount (n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export class RedditModal {
  static open (article: RedditArticle, trigger?: HTMLElement): void {
    Modal.open({
      header: () => RedditModal.buildHeader(article),
      content: () => RedditModal.buildContent(article),
      footer: () => RedditModal.buildFooter(article)
    }, trigger)
  }

  private static buildHeader (a: RedditArticle): HTMLElement {
    return h('div', { className: cx.header },
      h('span', { className: cx.title }, REDDIT_MODAL.FOOTER_PREFIX),
      h('div', { className: cx.meta },
        h('span', { className: cx.subreddit }, a.sourceName || REDDIT_MODAL.EMPTY_VALUE),
        h('span', { className: cx.author }, a.authorName || REDDIT_MODAL.EMPTY_VALUE)
      )
    )
  }

  private static buildContent (a: RedditArticle): HTMLElement {
    const children: HTMLElement[] = []

    if (a.imageUrl) {
      children.push(
        h('div', { className: cx.image },
          new AsyncImage({
            src: a.imageUrl,
            alt: a.title || REDDIT_MODAL.IMAGE_ALT
          }).el
        )
      )
    }

    if (a.title) {
      children.push(h('h3', { className: cx.titleText }, a.title))
    }

    if (a.description) {
      children.push(h('p', { className: cx.description }, a.description))
    }

    children.push(
      h('div', { className: cx.stats },
        RedditModal.buildStat(a.score, REDDIT_MODAL.SCORE),
        RedditModal.buildStat(a.commentCount, REDDIT_MODAL.COMMENTS)
      )
    )

    const rows: [string, string][] = [
      [REDDIT_MODAL.SUBREDDIT, a.sourceName || REDDIT_MODAL.EMPTY_VALUE],
      [REDDIT_MODAL.AUTHOR, a.authorName || REDDIT_MODAL.EMPTY_VALUE],
      [REDDIT_MODAL.PUBLISHED, formatDate(a.publishedAt)],
      [REDDIT_MODAL.DOMAIN, a.domain || REDDIT_MODAL.EMPTY_VALUE]
    ]

    children.push(...rows.map(([label, value]) =>
      h('div', { className: cx.row },
        h('span', { className: cx.label }, label),
        h('span', { className: cx.value }, value)
      )
    ))

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

  private static buildStat (count: number, label: string): HTMLElement {
    return h('div', { className: cx.stat },
      h('span', { className: cx.statValue }, formatCount(count)),
      h('span', { className: cx.statLabel }, label)
    )
  }

  private static buildFooter (a: RedditArticle): HTMLElement {
    return h('div', { className: cx.footer },
      h('span', { className: cx.sourceTag }, a.sourceName || REDDIT_MODAL.FOOTER_PREFIX),
      h('a', {
        className: cx.footerLink,
        href: a.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': ARIA.VISIT_ON_REDDIT
      }, REDDIT_MODAL.VIEW_ON_REDDIT)
    )
  }
}
