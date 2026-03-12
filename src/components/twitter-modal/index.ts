import './styles.css'
import { cx } from './cx'
import type { TwitterArticle } from '@/types'
import { h } from '@/utils/dom'
import { Modal } from '@/components/modal'
import { AsyncImage } from '@/components/async-image'
import { formatDate } from '@/utils/format'
import { TWITTER_MODAL, ARIA, GDELT_MODAL } from '@/data/strings'

function formatCount (n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export class TwitterModal {
  static open (article: TwitterArticle, trigger?: HTMLElement): void {
    Modal.open({
      header: () => TwitterModal.buildHeader(article),
      content: () => TwitterModal.buildContent(article),
      footer: () => TwitterModal.buildFooter(article)
    }, trigger)
  }

  private static buildHeader (a: TwitterArticle): HTMLElement {
    const author = h('div', { className: cx.author },
      h('span', { className: cx.authorName }, a.authorName || TWITTER_MODAL.EMPTY_VALUE),
      h('span', { className: cx.authorHandle }, a.authorUsername ? `@${a.authorUsername}` : '')
    )

    if (a.authorVerified) {
      author.appendChild(h('span', { className: cx.verified }, TWITTER_MODAL.VERIFIED))
    }

    return h('div', { className: cx.header },
      h('span', { className: cx.title }, TWITTER_MODAL.FOOTER_PREFIX),
      author
    )
  }

  private static buildContent (a: TwitterArticle): HTMLElement {
    const children: HTMLElement[] = []

    if (a.imageUrl) {
      children.push(
        h('div', { className: cx.image },
          new AsyncImage({ src: a.imageUrl, alt: a.text?.slice(0, 60) || TWITTER_MODAL.IMAGE_ALT }).el
        )
      )
    }

    if (a.text) {
      children.push(h('p', { className: cx.text }, a.text))
    }

    // Engagement stats
    const stats = h('div', { className: cx.stats },
      TwitterModal.buildStat(a.likeCount, TWITTER_MODAL.LIKES),
      TwitterModal.buildStat(a.repostCount, TWITTER_MODAL.REPOSTS),
      TwitterModal.buildStat(a.replyCount, TWITTER_MODAL.REPLIES)
    )
    children.push(stats)

    // Metadata rows
    const rows: [string, string][] = [
      [TWITTER_MODAL.AUTHOR, a.authorUsername ? `@${a.authorUsername}` : a.authorName || TWITTER_MODAL.EMPTY_VALUE],
      [TWITTER_MODAL.PUBLISHED, formatDate(a.publishedAt)]
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

  private static buildFooter (a: TwitterArticle): HTMLElement {
    const authorTag = a.authorUsername
      ? `${TWITTER_MODAL.FOOTER_PREFIX}${TWITTER_MODAL.FOOTER_SEPARATOR}@${a.authorUsername}`
      : TWITTER_MODAL.FOOTER_PREFIX

    return h('div', { className: cx.footer },
      h('span', { className: cx.sourceTag }, authorTag),
      h('a', {
        className: cx.footerLink,
        href: a.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': ARIA.VISIT_ON_X
      }, TWITTER_MODAL.VIEW_ON_X)
    )
  }
}
