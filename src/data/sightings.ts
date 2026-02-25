import { Continent } from '@/enums'
import type { ContinentGroup } from '@/types'

const CONTINENT_LABELS: Record<Continent, string> = {
  [Continent.ASIA]: 'ASIA-PACIFIC',
  [Continent.EUROPE]: 'EUROPE',
  [Continent.AMERICAS]: 'AMERICAS',
  [Continent.OCEANIA]: 'OCEANIA',
  [Continent.AFRICA]: 'AFRICA',
}

export function groupByContinent<T extends { continent: Continent }>(items: T[]): ContinentGroup<T>[] {
  const grouped = new Map<Continent, T[]>()

  for (const item of items) {
    const list = grouped.get(item.continent) ?? []
    list.push(item)
    grouped.set(item.continent, list)
  }

  return Array.from(grouped.entries()).map(([continent, groupItems]) => ({
    continent,
    label: CONTINENT_LABELS[continent],
    items: groupItems,
    count: groupItems.length,
  }))
}
