export enum Continent {
  ASIA = 'ASIA',
  EUROPE = 'EUROPE',
  AMERICAS = 'AMERICAS',
  OCEANIA = 'OCEANIA',
  AFRICA = 'AFRICA',
}

export enum SightingStatus {
  VERIFIED = 'VERIFIED',
  PENDING = 'PENDING',
  ANALYZING = 'ANALYZING',
  DEBUNKED = 'DEBUNKED',
}

export enum SightingShape {
  UNSPECIFIED = 'Unspecified',
  CHANGING = 'Changing',
  CHEVRON = 'Chevron',
  CIGAR = 'Cigar',
  CIRCLE = 'Circle',
  CONE = 'Cone',
  CROSS = 'Cross',
  CUBE = 'Cube',
  CYLINDER = 'Cylinder',
  DIAMOND = 'Diamond',
  DISK = 'Disk',
  EGG = 'Egg',
  FIREBALL = 'Fireball',
  FLASH = 'Flash',
  FORMATION = 'Formation',
  LIGHT = 'Light',
  ORB = 'Orb',
  OTHER = 'Other',
  OVAL = 'Oval',
  RECTANGLE = 'Rectangle',
  SPHERE = 'Sphere',
  STAR = 'Star',
  TEARDROP = 'Teardrop',
  TRIANGLE = 'Triangle',
  UNKNOWN = 'Unknown',
}

export enum DataSourceId {
  NUFORC = 'NUFORC',
  ENIGMA = 'ENIGMA',
  NASA_CNEOS = 'NASA_CNEOS',
  OPENSKY = 'OPENSKY',
  GDELT = 'GDELT',
  GEIPAN = 'GEIPAN',
  CJK_SCRAPER = 'CJK_SCRAPER',
  AARO = 'AARO',
}

export enum DataSourceStatus {
  ONLINE = 'ONLINE',
  SYNCING = 'SYNCING',
  OFFLINE = 'OFFLINE',
  DISABLED = 'DISABLED',
}

export enum TagVariant {
  ALERT = 'ALERT',
  USO = 'USO',
  LIVE = 'LIVE',
  NEW = 'NEW',
  DISABLED = 'DISABLED',
}
