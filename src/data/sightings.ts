import { Continent, DataSourceId, SightingShape, SightingStatus } from '@/enums'
import type { Sighting, RegionStats, NewsItem, ContinentGroup } from '@/types'

export function getSightings(): Sighting[] {
  return [
    { id: 's1', coordinates: { lat: 35.6, lng: 139.7 }, region: 'Tokyo', country: 'Japan', continent: Continent.ASIA, shape: SightingShape.ORB, status: SightingStatus.VERIFIED, credibility: 87, reportedAt: '2m ago', summary: 'Multiple witnesses reported a bright orb hovering silently over Shinjuku for approximately 4 minutes before accelerating vertically.', source: DataSourceId.NUFORC },
    { id: 's2', coordinates: { lat: 37.5, lng: 127.0 }, region: 'Seoul', country: 'South Korea', continent: Continent.ASIA, shape: SightingShape.TRIANGLE, status: SightingStatus.PENDING, credibility: 72, reportedAt: '14m ago', summary: 'Black triangular object with lights at each vertex observed near DMZ. Silent operation noted by 3 independent witnesses.', source: DataSourceId.NUFORC },
    { id: 's3', coordinates: { lat: 31.2, lng: 121.5 }, region: 'Shanghai', country: 'China', continent: Continent.ASIA, shape: SightingShape.DISK, status: SightingStatus.VERIFIED, credibility: 91, reportedAt: '31m ago', summary: 'Metallic disc observed above Pudong at high altitude. Commercial pilots reported radar anomaly in same airspace.', source: DataSourceId.NUFORC },
    { id: 's4', coordinates: { lat: 55.7, lng: 37.6 }, region: 'Moscow', country: 'Russia', continent: Continent.EUROPE, shape: SightingShape.CYLINDER, status: SightingStatus.ANALYZING, credibility: 64, reportedAt: '47m ago', summary: 'White elongated object tracked on personal radar app moving at estimated 3400 km/h with no sonic boom reported.', source: DataSourceId.NUFORC },
    { id: 's5', coordinates: { lat: 34.7, lng: 135.5 }, region: 'Osaka', country: 'Japan', continent: Continent.ASIA, shape: SightingShape.CIGAR, status: SightingStatus.PENDING, credibility: 55, reportedAt: '1h ago', summary: 'Elongated dark object seen during sunset. Single witness, phone video submitted.', source: DataSourceId.NUFORC },
    { id: 's6', coordinates: { lat: 43.1, lng: 131.9 }, region: 'Vladivostok', country: 'Russia', continent: Continent.ASIA, shape: SightingShape.LIGHT, status: SightingStatus.VERIFIED, credibility: 78, reportedAt: '2h ago', summary: 'Luminous sphere observed over harbor by dock workers. Object pulsed green and white for 8 minutes.', source: DataSourceId.NUFORC },
    { id: 's7', coordinates: { lat: 39.9, lng: 116.4 }, region: 'Beijing', country: 'China', continent: Continent.ASIA, shape: SightingShape.CHANGING, status: SightingStatus.VERIFIED, credibility: 83, reportedAt: '3h ago', summary: 'Translucent jellyfish-shaped object with trailing tendrils photographed by university astronomy club members.', source: DataSourceId.NUFORC },
    { id: 's8', coordinates: { lat: 35.2, lng: 129.1 }, region: 'Busan', country: 'South Korea', continent: Continent.ASIA, shape: SightingShape.SPHERE, status: SightingStatus.ANALYZING, credibility: 69, reportedAt: '4h ago', summary: 'Reflective sphere tracked by fishermen off coast. Object appeared to enter water without splash.', source: DataSourceId.NUFORC },
    { id: 's9', coordinates: { lat: 59.9, lng: 30.3 }, region: 'St Petersburg', country: 'Russia', continent: Continent.EUROPE, shape: SightingShape.FIREBALL, status: SightingStatus.PENDING, credibility: 58, reportedAt: '5h ago', summary: 'Orange light formation above Neva River. Dismissed as possible military flares by local authorities.', source: DataSourceId.NUFORC },
    { id: 's10', coordinates: { lat: 34.0, lng: -118.2 }, region: 'Los Angeles', country: 'United States', continent: Continent.AMERICAS, shape: SightingShape.OVAL, status: SightingStatus.VERIFIED, credibility: 88, reportedAt: '6h ago', summary: 'Navy personnel reported oval shaped object during routine patrol off coast. FLIR footage submitted to AARO.', source: DataSourceId.NUFORC },
  ]
}

export function getRegionStats(): RegionStats[] {
  return [
    { region: 'Japan', continent: Continent.ASIA, sightings: 34, highCredibility: 3, trend: '+12%' },
    { region: 'China', continent: Continent.ASIA, sightings: 28, highCredibility: 1, trend: '+8%' },
    { region: 'South Korea', continent: Continent.ASIA, sightings: 19, highCredibility: 2, trend: '+23%' },
    { region: 'Russia', continent: Continent.EUROPE, sightings: 15, highCredibility: 1, trend: '-4%' },
    { region: 'United States', continent: Continent.AMERICAS, sightings: 42, highCredibility: 5, trend: '+3%' },
    { region: 'France', continent: Continent.EUROPE, sightings: 8, highCredibility: 1, trend: '+1%' },
    { region: 'Australia', continent: Continent.OCEANIA, sightings: 6, highCredibility: 0, trend: '-2%' },
  ]
}

export function getNewsItems(): NewsItem[] {
  return [
    { id: 'n1', source: 'NHK WORLD', text: 'Japan parliamentary UAP group requests SDF data release', time: 'now', tag: null, continent: Continent.ASIA },
    { id: 'n2', source: 'XINHUA', text: 'PLA confirms AI-based aerial anomaly tracking system operational', time: '12m ago', tag: null, continent: Continent.ASIA },
    { id: 'n3', source: 'YONHAP', text: 'Fishermen report submerged luminous object off Pohang coast', time: '28m ago', tag: null, continent: Continent.ASIA },
    { id: 'n4', source: 'TASS', text: 'Unexplained radar signatures detected over Kamchatka Peninsula', time: '1h ago', tag: null, continent: Continent.EUROPE },
    { id: 'n5', source: 'KYODO', text: 'Fukushima UFO Lab reports spike in Mount Senganmori sightings', time: '2h ago', tag: null, continent: Continent.ASIA },
  ]
}

export function groupByContinent<T extends { continent: Continent }>(items: T[]): ContinentGroup<T>[] {
  const labels: Record<Continent, string> = {
    [Continent.ASIA]: 'ASIA-PACIFIC',
    [Continent.EUROPE]: 'EUROPE',
    [Continent.AMERICAS]: 'AMERICAS',
    [Continent.OCEANIA]: 'OCEANIA',
    [Continent.AFRICA]: 'AFRICA',
  }

  const grouped = new Map<Continent, T[]>()
  for (const item of items) {
    const list = grouped.get(item.continent) ?? []
    list.push(item)
    grouped.set(item.continent, list)
  }

  return Array.from(grouped.entries()).map(([continent, items]) => ({
    continent,
    label: labels[continent],
    items,
    count: items.length,
  }))
}
