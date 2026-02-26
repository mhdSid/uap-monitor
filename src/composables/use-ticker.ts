import type { Sighting } from '@/types'
import type { Continent } from '@/enums'

// ─── Types ──────────────────────────────────────────────────────────

/** A ticker message: 1–2 lines, each rendered with a `//` prefix. */
export type TickerMessage = [string] | [string, string]

export interface UseTickerReturn {
  /** Get the default loading-phase messages. */
  getDefaultMessages: () => TickerMessage[]
  /** Generate randomized messages from loaded sighting data. */
  generateMessages: (sightings: Sighting[]) => TickerMessage[]
}

// ─── Continent display names ────────────────────────────────────────

const CONTINENT_NAMES: Record<string, string> = {
  AMERICAS: 'Americas',
  EUROPE: 'Europe',
  EURASIA: 'Eurasia',
  ASIA_MIDDLE_EAST: 'Middle East',
  ASIA_PACIFIC: 'Asia-Pacific',
  OCEANIA: 'Oceania',
  AFRICA: 'Africa',
}

// ─── Default messages (shown during loading) ────────────────────────

const DEFAULT_MESSAGES: TickerMessage[] = [
  ['Scanning open-source intelligence feeds for new UAP reports...'],
  ['Aggregating reports from NUFORC database...'],
  ['Processing witness accounts and credibility scores...'],
  ['Cross-referencing flight data with sighting coordinates...'],
  ['Monitoring CJK and Russian language sources', 'for new activity...'],
]

// ─── Message generators ─────────────────────────────────────────────

type MessageGenerator = (sightings: Sighting[]) => TickerMessage | null

/** Pick a random item from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/** Count sightings per continent. */
function countByContinent(sightings: Sighting[]): Map<Continent, number> {
  const map = new Map<Continent, number>()
  for (const s of sightings) {
    map.set(s.continent, (map.get(s.continent) ?? 0) + 1)
  }
  return map
}

/** Count sightings per shape. */
function countByShape(sightings: Sighting[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of sightings) {
    map.set(s.shape, (map.get(s.shape) ?? 0) + 1)
  }
  return map
}

/** Format a recent sighting as a headline. */
const recentSighting: MessageGenerator = (sightings) => {
  const s = pick(sightings)
  const summary = s.summary.length > 60 ? s.summary.slice(0, 57) + '...' : s.summary
  return [`${s.region}, ${s.country}:`, `"${summary}"`]
}

/** Report top shape in dataset. */
const topShape: MessageGenerator = (sightings) => {
  const shapes = countByShape(sightings)
  let top = '', max = 0
  for (const [shape, count] of shapes) {
    if (count > max) { top = shape; max = count }
  }
  if (!top) return null
  const pct = ((max / sightings.length) * 100).toFixed(1)
  return [`Most reported shape: ${top}`, `${pct}% of ${sightings.length.toLocaleString()} sightings`]
}

/** Report continent with most activity. */
const topContinent: MessageGenerator = (sightings) => {
  const continents = countByContinent(sightings)
  let top = '' as string, max = 0
  for (const [continent, count] of continents) {
    if (count > max) { top = continent; max = count }
  }
  const name = CONTINENT_NAMES[top] ?? top
  return [`Highest activity region: ${name}`, `${max.toLocaleString()} reports in dataset`]
}

/** Report high-credibility count. */
const highCredibility: MessageGenerator = (sightings) => {
  const high = sightings.filter(s => s.credibility > 80).length
  if (high === 0) return null
  const pct = ((high / sightings.length) * 100).toFixed(1)
  return [`${high.toLocaleString()} sightings with credibility >80`, `${pct}% of total reports`]
}

/** Report a random characteristic found in data. */
const randomCharacteristic: MessageGenerator = (sightings) => {
  const withChars = sightings.filter(s => s.characteristics.length > 0)
  if (withChars.length === 0) return null
  const s = pick(withChars)
  const char = pick(s.characteristics)
  return [`${s.region}, ${s.country}:`, `Witness reported "${char}" during ${s.shape.toLowerCase()} sighting`]
}

/** Total dataset stats. */
const datasetStats: MessageGenerator = (sightings) => {
  const countries = new Set(sightings.map(s => s.country)).size
  const continents = new Set(sightings.map(s => s.continent)).size
  return [`Monitoring ${sightings.length.toLocaleString()} reports`, `across ${countries} countries and ${continents} regions`]
}

const GENERATORS: MessageGenerator[] = [
  recentSighting,
  recentSighting,
  recentSighting,
  topShape,
  topContinent,
  highCredibility,
  randomCharacteristic,
  datasetStats,
]

// ─── Composable ─────────────────────────────────────────────────────

export function useTicker(): UseTickerReturn {
  function getDefaultMessages(): TickerMessage[] {
    return [...DEFAULT_MESSAGES]
  }

  function generateMessages(sightings: Sighting[]): TickerMessage[] {
    if (sightings.length === 0) return getDefaultMessages()

    const messages: TickerMessage[] = []
    const shuffled = [...GENERATORS].sort(() => Math.random() - 0.5)

    for (const gen of shuffled) {
      const msg = gen(sightings)
      if (msg) messages.push(msg)
      if (messages.length >= 8) break
    }

    return messages.length > 0 ? messages : getDefaultMessages()
  }

  return { getDefaultMessages, generateMessages }
}
