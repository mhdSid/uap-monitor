import type { TickerMessage } from '@/composables/use-ticker'
import { h, addClass, removeClass, toggleClass } from '@/utils/dom'
import { TICKER, ARIA } from '@/data/strings'

const DEFAULT_MESSAGES: TickerMessage[] = [
  { lines: ['Scanning open-source intelligence feeds for new UAP reports...'] },
  { lines: ['Aggregating reports from NUFORC database...'] },
  { lines: ['Processing witness accounts and credibility scores...'] },
]

export interface TickerHandle {
  el: HTMLElement
  setMessages: (messages: TickerMessage[]) => void
}

export interface TickerOptions {
  onClick?: (sightingId: string) => void
}

const PREFIX = TICKER.PREFIX
const GHOST_TEXT = TICKER.GHOST_TEXT

export function renderTicker(options?: TickerOptions): TickerHandle {
  let messages: TickerMessage[] = [...DEFAULT_MESSAGES]

  const contentEl = h('div', { className: 'ticker__content' })
  const cursorEl = h('span', { className: 'ticker__cursor' }, '█')

  // Ghost lines: subtle placeholders visible when real content doesn't fill both rows
  const ghostEl = h('div', { className: 'ticker__ghost' },
    h('div', { className: 'ticker__ghost-line' }, GHOST_TEXT),
    h('div', { className: 'ticker__ghost-line' }, GHOST_TEXT),
  )

  const ticker = h('div', {
    className: 'ticker',
    role: 'button',
    tabIndex: 0,
    'aria-label': ARIA.TICKER,
  },
    contentEl,
    ghostEl,
  )

  let msgIdx = 0
  let lineIdx = 0
  let charIdx = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let phase: 'typing' | 'holding' = 'typing'
  let dataLoaded = false

  /** Get current sighting ID if available. */
  function getCurrentSightingId(): string | undefined {
    return messages[msgIdx % messages.length]?.sightingId
  }

  /** Flatten current message lines with prefix. */
  function getCurrentLines(): string[] {
    const msg = messages[msgIdx % messages.length]
    if (!msg) return [PREFIX + '...']
    return msg.lines.map(line => PREFIX + line)
  }

  /** Update CSS class tracking how many lines are rendered. */
  function updateLineClass(count: number): void {
    toggleClass(ticker, 'ticker--lines-2', count >= 2)
  }

  function render(): void {
    const lines = getCurrentLines()
    contentEl.textContent = ''

    let renderedCount = 0

    for (let i = 0; i <= lineIdx && i < lines.length; i++) {
      const lineEl = h('div', { className: 'ticker__line' })

      if (i < lineIdx) {
        lineEl.textContent = lines[i]
      } else if (phase === 'holding') {
        lineEl.textContent = lines[i]
        lineEl.appendChild(cursorEl)
      } else {
        lineEl.textContent = lines[i].slice(0, charIdx)
        lineEl.appendChild(cursorEl)
      }

      contentEl.appendChild(lineEl)
      renderedCount++
    }

    updateLineClass(renderedCount)
  }

  function tick(): void {
    if (messages.length === 0) return
    const lines = getCurrentLines()

    if (phase === 'typing') {
      const currentLine = lines[lineIdx]
      if (!currentLine) {
        advanceMessage()
        return
      }

      if (charIdx <= currentLine.length) {
        removeClass(cursorEl, 'ticker__cursor--blink')
        render()
        charIdx++
        timer = setTimeout(tick, 25)
      } else if (lineIdx < lines.length - 1) {
        lineIdx++
        charIdx = 0
        timer = setTimeout(tick, 25)
      } else {
        phase = 'holding'
        addClass(cursorEl, 'ticker__cursor--blink')
        render()
        timer = setTimeout(tick, 3000)
      }
    } else {
      advanceMessage()
    }
  }

  function advanceMessage(): void {
    removeClass(cursorEl, 'ticker__cursor--blink')
    msgIdx = (msgIdx + 1) % messages.length
    lineIdx = 0
    charIdx = 0
    phase = 'typing'
    updateLineClass(0)
    tick()
  }

  function handleClick(): void {
    if (!dataLoaded) return
    const id = getCurrentSightingId()
    if (id && options?.onClick) {
      options.onClick(id)
    }
  }

  ticker.addEventListener('click', handleClick)
  ticker.addEventListener('keydown', (e: Event) => {
    const ke = e as KeyboardEvent
    if (ke.key === 'Enter' || ke.key === ' ') {
      ke.preventDefault()
      handleClick()
    }
  })

  function setMessages(newMessages: TickerMessage[]): void {
    if (newMessages.length === 0) return
    messages = newMessages
    msgIdx = 0
    lineIdx = 0
    charIdx = 0
    phase = 'typing'
    dataLoaded = true
    addClass(ticker, 'ticker--clickable')
    updateLineClass(0)
    if (timer) clearTimeout(timer)
    tick()
  }

  tick()

  return { el: ticker, setMessages }
}
