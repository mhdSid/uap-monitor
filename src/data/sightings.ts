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
  Continent.AFRICA,
  Continent.MARITIME,
  Continent.SPACE
]

/**
 * Group items by region, in a stable display order, including empty regions.
 *
 * Items whose `continent` is null carry no location at all and are omitted
 * from every group — they are never folded into a region they do not belong to.
 */
export function groupByContinent<T extends { continent: Continent | null }> (items: T[]): ContinentGroup<T>[] {
  const grouped = new Map<Continent, T[]>()

  for (const item of items) {
    if (item.continent === null) continue
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
