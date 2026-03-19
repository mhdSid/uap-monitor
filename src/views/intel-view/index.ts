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

// ─── Component ──────────────────────────────────────────────────────

export class IntelView extends Component {
  private newsFeed!: NewsFeed
  private loaderEl!: HTMLElement
  private contentEl!: HTMLElement
  private loaded = false

  protected create (): HTMLElement {
    this.newsFeed = new NewsFeed({})
    this.loaderEl = h('div', { className: cx.loader }, new Loader({}).el)
    this.contentEl = h('div', { className: [cx.content, appCx.appViewContent].join(' ') })
    hide(this.contentEl)

    return h('div', { className: [cx.root, appCx.appView].join(' ') },
      this.loaderEl,
      this.contentEl
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
