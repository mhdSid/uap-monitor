export enum Continent {
  AMERICAS = 'AMERICAS',
  EUROPE = 'EUROPE',
  EURASIA = 'EURASIA',
  ASIA_MIDDLE_EAST = 'ASIA_MIDDLE_EAST',
  ASIA_PACIFIC = 'ASIA_PACIFIC',
  OCEANIA = 'OCEANIA',
  AFRICA = 'AFRICA'
}

export enum SightingStatus {
  VERIFIED = 'VERIFIED',
  PENDING = 'PENDING',
  ANALYZING = 'ANALYZING',
  DEBUNKED = 'DEBUNKED'
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
  UNKNOWN = 'Unknown'
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
  LANDED = 'Landed'
}

export enum DataSourceId {
  NUFORC = 'NUFORC',
  HATCH_UDB = 'HATCH_UDB',
  CHRONOLOGY = 'CHRONOLOGY',
  ENIGMA = 'ENIGMA',
  NASA_CNEOS = 'NASA_CNEOS',
  OPENSKY = 'OPENSKY',
  GDELT = 'GDELT',
  GEIPAN = 'GEIPAN',
  CJK_SCRAPER = 'CJK_SCRAPER',
  AARO = 'AARO',
  GNEWS = 'GNEWS',
  TWITTER = 'TWITTER',
  REDDIT = 'REDDIT',
  NUCLEAR = 'NUCLEAR',
  EXPERIENCER = 'EXPERIENCER'
}

export enum DataSourceStatus {
  ONLINE = 'ONLINE',
  SYNCING = 'SYNCING',
  OFFLINE = 'OFFLINE',
  DISABLED = 'DISABLED'
}

export enum TagVariant {
  ALERT = 'ALERT',
  USO = 'USO',
  LIVE = 'LIVE',
  NEW = 'NEW',
  DISABLED = 'DISABLED',
  TONE_VERY_POSITIVE = 'VERY POSITIVE',
  TONE_POSITIVE = 'POSITIVE',
  TONE_NEUTRAL = 'NEUTRAL',
  TONE_NEGATIVE = 'NEGATIVE',
  TONE_VERY_NEGATIVE = 'VERY NEGATIVE',
  SOURCE_NUFORC = 'NUFORC',
  SOURCE_HATCH = 'HATCH',
  SOURCE_CHRONOLOGY = 'CHRON',
  SOURCE_EXPERIENCER = 'HUMAN',
  SOURCE_NEWS = 'NEWS',
  SOURCE_GDELT = 'GDELT',
  SOURCE_GNEWS = 'GNEWS',
  SOURCE_TWITTER = 'TWITTER',
  SOURCE_REDDIT = 'REDDIT',
  COUNT = 'COUNT',
  STATUS_VERIFIED = 'VERIFIED',
  STATUS_PENDING = 'PENDING',
  STATUS_ANALYZING = 'ANALYZING',
  STATUS_DEBUNKED = 'DEBUNKED'
}

export enum AlertVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  NEUTRAL = 'neutral'
}

export enum ToastVariant {
  ERROR = 'error',
  SUCCESS = 'success',
  INFO = 'info'
}

export enum TagSize {
  XS = 'xs',
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  RESPONSIVE = 'responsive'
}

/** Shared size scale for form components (TextInput, Select). */
export enum ComponentSize {
  SM = 'sm',
  MD = 'md',
  LG = 'lg'
}

/** Extended size scale for Button (adds xs, xl, 2xl, 3xl). */
export enum ButtonSize {
  XS = 'xs',
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl',
  XXL = '2xl',
  XXXL = '3xl'
}

/** Visual treatment for Button. */
export enum ButtonVariant {
  SOLID = 'solid',
  FILLED = 'filled',
  OUTLINE = 'outline',
  SOFT = 'soft',
  GHOST = 'ghost'
}

/** Semantic color for Button. */
export enum ButtonColor {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  NEUTRAL = 'neutral',
  ERROR = 'error'
}
