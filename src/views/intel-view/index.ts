/* ------------------------------------------------------------------ *
 *  IntelView — Full-page intelligence news feed                       *
 *                                                                     *
 *  Wraps the NewsFeed component in a full-height layout.              *
 *  Lazy-loaded on first navigation to /intel.                         *
 * ------------------------------------------------------------------ */

import './styles.css'
import { cx } from './cx'
import { cx as appCx } from '../app/cx'
import { Component } from '@/core'
import { h, hide, show } from '@/core/dom'
import { Loader } from '@/components/loader'
import { NewsFeed } from '@/components/news-feed'
import { Footer } from '@/components/footer'

// ─── Component ──────────────────────────────────────────────────────

export class IntelView extends Component {
  private newsFeed!: NewsFeed
  private loaderEl!: HTMLElement
  private contentEl!: HTMLElement
  private loaded = false

  protected create (): HTMLElement {
    this.newsFeed = this.ownChild(new NewsFeed({}))
    this.loaderEl = h('div', { className: appCx.viewLoader }, new Loader({}).el)
    this.contentEl = h('div', { className: appCx.appViewContent })
    hide(this.contentEl)

    // Footer sits as a flex sibling to contentEl — outside the feed's flex chain
    // so it doesn't collapse the grid height. contentEl (flex: 1) absorbs remaining space.
    return h('div', { className: [cx.root, appCx.appView].join(' ') },
      this.loaderEl,
      this.contentEl,
      new Footer({}).el
    )
  }

  async load (): Promise<void> {
    if (this.loaded) return

    await this.newsFeed.load()

    this.contentEl.appendChild(this.newsFeed.el)
    this.loaded = true

    hide(this.loaderEl)
    show(this.contentEl)
  }
}
