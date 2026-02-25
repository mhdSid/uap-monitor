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

export enum SightingCharacteristic {
  LIGHTS_ON_OBJECT = 'Lights on object',
  AURA_OR_HAZE = 'Aura or haze around object',
  AIRCRAFT_NEARBY = 'Aircraft nearby',
  ANIMALS_REACTED = 'Animals reacted',
  LEFT_A_TRAIL = 'Left a trail',
  EMITTED_OTHER_OBJECTS = 'Emitted other objects',
  CHANGED_COLOR = 'Changed Color',
  EMITTED_BEAMS = 'Emitted beams',
  ELECTRICAL_OR_MAGNETIC = 'Electrical or magnetic effects',
  POSSIBLE_ABDUCTION = 'Possible abduction',
  MISSING_TIME = 'Missing Time',
  MARKS_ON_BODY = 'Marks found on body afterwards',
  LANDED = 'Landed',
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
