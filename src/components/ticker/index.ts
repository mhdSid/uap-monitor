import './styles.css'
import { cx } from './cx'
/* ------------------------------------------------------------------ *
 *  Ticker — typing-animation status bar with click-to-scroll          *
 *                                                                     *
 *  Displays auto-cycling messages with a terminal-style typing effect.*
 *  Once data loads, clicking scrolls to the referenced sighting.      *
 * ------------------------------------------------------------------ */

import { Component } from '@/core'
import type { TickerMessage } from '@/composables/use-ticker'
import { h, addClass, removeClass, toggleClass } from '@/utils/dom'
import { TICKER, ARIA } from '@/data/strings'

export interface TickerProps {
  onClick?: (sightingId: string) => void
}

const DEFAULT_MESSAGES: TickerMessage[] = [
  { lines: ['Scanning open-source intelligence feeds for new UAP reports...'] },
  { lines: ['Aggregating reports from NUFORC database...'] },
  { lines: ['Processing witness accounts and credibility scores...'] },
]

const PREFIX = TICKER.PREFIX
const GHOST_TEXT = TICKER.GHOST_TEXT

type Phase = 'typing' | 'holding'

export class Ticker extends Component<TickerProps> {
  // All fields initialized in create() — field initializers run AFTER super(),
  // but create()/didMount() run DURING super().
  private messages!: TickerMessage[]
  private contentEl!: HTMLElement
  private cursorEl!: HTMLElement
  private ghostEl!: HTMLElement

  private msgIdx!: number
  private lineIdx!: number
  private charIdx!: number
  private phase!: Phase
  private timer!: ReturnType<typeof setTimeout> | null
  private dataLoaded!: boolean

  // ─── Lifecycle ──────────────────────────────────────────────────

  protected create(): HTMLElement {
    this.messages = [...DEFAULT_MESSAGES]
    this.msgIdx = 0
    this.lineIdx = 0
    this.charIdx = 0
    this.phase = 'typing'
    this.timer = null
    this.dataLoaded = false

    this.contentEl = h('div', { className: cx.content })
    this.cursorEl = h('span', { className: cx.cursor }, '█')

    this.ghostEl = h('div', { className: cx.ghost },
      h('div', { className: cx.ghostLine }, GHOST_TEXT),
      h('div', { className: cx.ghostLine }, GHOST_TEXT),
    )

    return h('div', {
      className: cx.root,
      role: 'button',
      tabIndex: 0,
      'aria-label': ARIA.TICKER,
    }, this.contentEl, this.ghostEl)
  }

  protected didMount(): void {
    this.el.addEventListener('click', () => this.handleClick())
    this.el.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault()
        this.handleClick()
      }
    })

    this.tick()
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer)
    super.destroy()
  }

  // ─── Public API ─────────────────────────────────────────────────

  setMessages(messages: TickerMessage[]): void {
    if (messages.length === 0) return

    this.messages = messages
    this.msgIdx = 0
    this.lineIdx = 0
    this.charIdx = 0
    this.phase = 'typing'
    this.dataLoaded = true

    addClass(this.el, 'ticker--clickable')
    this.updateLineClass(0)

    if (this.timer) clearTimeout(this.timer)
    this.tick()
  }

  // ─── Animation engine ──────────────────────────────────────────

  private getCurrentSightingId(): string | undefined {
    return this.messages[this.msgIdx % this.messages.length]?.sightingId
  }

  private getCurrentLines(): string[] {
    const msg = this.messages[this.msgIdx % this.messages.length]
    if (!msg) return [PREFIX + '...']
    return msg.lines.map(line => PREFIX + line)
  }

  private updateLineClass(count: number): void {
    toggleClass(this.el, 'ticker--lines-2', count >= 2)
  }

  private render(): void {
    const lines = this.getCurrentLines()
    this.contentEl.textContent = ''

    let renderedCount = 0

    for (let i = 0; i <= this.lineIdx && i < lines.length; i++) {
      const lineEl = h('div', { className: cx.line })

      if (i < this.lineIdx) {
        lineEl.textContent = lines[i]
      } else if (this.phase === 'holding') {
        lineEl.textContent = lines[i]
        lineEl.appendChild(this.cursorEl)
      } else {
        lineEl.textContent = lines[i].slice(0, this.charIdx)
        lineEl.appendChild(this.cursorEl)
      }

      this.contentEl.appendChild(lineEl)
      renderedCount++
    }

    this.updateLineClass(renderedCount)
  }

  private tick(): void {
    if (this.messages.length === 0) return
    const lines = this.getCurrentLines()

    if (this.phase === 'typing') {
      const currentLine = lines[this.lineIdx]
      if (!currentLine) {
        this.advanceMessage()
        return
      }

      if (this.charIdx <= currentLine.length) {
        removeClass(this.cursorEl, cx.cursorBlink)
        this.render()
        this.charIdx++
        this.timer = setTimeout(() => this.tick(), 25)
      } else if (this.lineIdx < lines.length - 1) {
        this.lineIdx++
        this.charIdx = 0
        this.timer = setTimeout(() => this.tick(), 25)
      } else {
        this.phase = 'holding'
        addClass(this.cursorEl, cx.cursorBlink)
        this.render()
        this.timer = setTimeout(() => this.tick(), 3000)
      }
    } else {
      this.advanceMessage()
    }
  }

  private advanceMessage(): void {
    removeClass(this.cursorEl, cx.cursorBlink)
    this.msgIdx = (this.msgIdx + 1) % this.messages.length
    this.lineIdx = 0
    this.charIdx = 0
    this.phase = 'typing'
    this.updateLineClass(0)
    this.tick()
  }

  private handleClick(): void {
    if (!this.dataLoaded) return
    const id = this.getCurrentSightingId()
    if (id && this.props.onClick) this.props.onClick(id)
  }
}
