import type { TickerMessage } from '@/composables/use-ticker'
import { h } from '@/utils/dom'

const DEFAULT_MESSAGES: TickerMessage[] = [
  ['Scanning open-source intelligence feeds for new UAP reports...'],
  ['Aggregating reports from NUFORC database...'],
  ['Processing witness accounts and credibility scores...'],
]

export interface TickerHandle {
  el: HTMLElement
  setMessages: (messages: TickerMessage[]) => void
}

const PREFIX = '// '

export function renderTicker(): TickerHandle {
  let messages: TickerMessage[] = [...DEFAULT_MESSAGES]
  const contentEl = h('div', { className: 'ticker__content' })
  const cursorEl = h('span', { className: 'ticker__cursor' }, '█')
  const ticker = h('div', { className: 'ticker', role: 'marquee', 'aria-live': 'off' }, contentEl)

  let msgIdx = 0
  let lineIdx = 0
  let charIdx = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let phase: 'typing' | 'holding' = 'typing'

  /** Flatten current message lines with prefix into typed segments. */
  function getCurrentLines(): string[] {
    const msg = messages[msgIdx % messages.length]!
    return msg.map(line => PREFIX + line)
  }

  function render(): void {
    const lines = getCurrentLines()

    // Clear content
    contentEl.textContent = ''

    // Build completed lines + current typing line
    for (let i = 0; i <= lineIdx && i < lines.length; i++) {
      const lineEl = h('div', { className: 'ticker__line' })

      if (i < lineIdx) {
        // Completed line
        lineEl.textContent = lines[i]
      } else if (phase === 'holding') {
        // Last line, done typing
        lineEl.textContent = lines[i]
        lineEl.appendChild(cursorEl)
      } else {
        // Currently typing this line
        lineEl.textContent = lines[i].slice(0, charIdx)
        lineEl.appendChild(cursorEl)
      }

      contentEl.appendChild(lineEl)
    }
  }

  function tick(): void {
    if (messages.length === 0) return
    const lines = getCurrentLines()

    if (phase === 'typing') {
      const currentLine = lines[lineIdx]
      if (!currentLine) {
        // Safety: advance to next message
        advanceMessage()
        return
      }

      if (charIdx <= currentLine.length) {
        cursorEl.classList.remove('ticker__cursor--blink')
        render()
        charIdx++
        timer = setTimeout(tick, 25)
      } else if (lineIdx < lines.length - 1) {
        // Move to next line
        lineIdx++
        charIdx = 0
        timer = setTimeout(tick, 25)
      } else {
        // All lines typed — hold with blinking cursor
        phase = 'holding'
        cursorEl.classList.add('ticker__cursor--blink')
        render()
        timer = setTimeout(tick, 3000)
      }
    } else {
      advanceMessage()
    }
  }

  function advanceMessage(): void {
    cursorEl.classList.remove('ticker__cursor--blink')
    msgIdx = (msgIdx + 1) % messages.length
    lineIdx = 0
    charIdx = 0
    phase = 'typing'
    tick()
  }

  function setMessages(newMessages: TickerMessage[]): void {
    if (newMessages.length === 0) return
    messages = newMessages
    msgIdx = 0
    lineIdx = 0
    charIdx = 0
    phase = 'typing'
    if (timer) clearTimeout(timer)
    tick()
  }

  tick()

  return { el: ticker, setMessages }
}
