import { Continent } from '@/enums'
import { CONTINENT_LABELS } from '@/data/strings'
import type { ContinentGroup } from '@/types'

/** Fixed display order — highest-volume regions first. */
const CONTINENT_ORDER: Continent[] = [
  Continent.AMERICAS,
  Continent.EUROPE,
  Continent.EURASIA,
  Continent.ASIA_MIDDLE_EAST,
  Continent.ASIA_PACIFIC,
  Continent.OCEANIA,
  Continent.AFRICA
]

/**
 * Group items by continent.
 * Always returns all 5 continents in a stable order,
 * even if some have zero items.
 */
export function groupByContinent<T extends { continent: Continent }>(items: T[]): ContinentGroup<T>[] {
  const grouped = new Map<Continent, T[]>()

  for (const item of items) {
    const list = grouped.get(item.continent) ?? []
    list.push(item)
    grouped.set(item.continent, list)
  }

  return CONTINENT_ORDER.map((continent) => {
    const groupItems = grouped.get(continent) ?? []
    return {
      continent,
      label: CONTINENT_LABELS[continent],
      items: groupItems,
      count: groupItems.length
    }
  })
}
