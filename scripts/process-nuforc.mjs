#!/usr/bin/env node

/**
 * process-nuforc.mjs
 *
 * Transforms the raw HuggingFace NUFORC JSON dump into
 * lightweight per-year chunks ready for the browser.
 *
 * Design principles:
 *   - Never silently discard source data
 *   - Characteristics are passed through as-is from NUFORC (no whitelist)
 *   - Unknown countries/shapes are logged for audit, not dropped
 *   - All string constants are named, never anonymous
 *
 * Usage:
 *   node scripts/process-nuforc.mjs [path-to-nuforc.json]
 *
 * Output:
 *   public/data/nuforc-YYYY.json      — one file per year
 *   public/data/nuforc-manifest.json   — index of all chunks with counts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public/data')
const DEFAULT_INPUT = resolve(PROJECT_ROOT, 'nuforc.json')

// ─── Named constants ────────────────────────────────────────────────

const Continent = {
  AMERICAS: 'AMERICAS',
  EUROPE: 'EUROPE',
  EURASIA: 'EURASIA',
  ASIA_MIDDLE_EAST: 'ASIA_MIDDLE_EAST',
  ASIA_PACIFIC: 'ASIA_PACIFIC',
  OCEANIA: 'OCEANIA',
  AFRICA: 'AFRICA',
}

const Status = {
  PENDING: 'PENDING',
}

const Source = {
  NUFORC: 'NUFORC',
}

const Shape = {
  UNKNOWN: 'Unknown',
  CHANGING: 'Changing',
  CHEVRON: 'Chevron',
  CIGAR: 'Cigar',
  CIRCLE: 'Circle',
  CONE: 'Cone',
  CROSS: 'Cross',
  CUBE: 'Cube',
  CYLINDER: 'Cylinder',
  DIAMOND: 'Diamond',
  DISK: 'Disk',
  EGG: 'Egg',
  FIREBALL: 'Fireball',
  FLASH: 'Flash',
  FORMATION: 'Formation',
  LIGHT: 'Light',
  ORB: 'Orb',
  OTHER: 'Other',
  OVAL: 'Oval',
  RECTANGLE: 'Rectangle',
  SPHERE: 'Sphere',
  STAR: 'Star',
  TEARDROP: 'Teardrop',
  TRIANGLE: 'Triangle',
}

const VALID_YEAR_MIN = 1950
const VALID_YEAR_MAX = 2030
const SUMMARY_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 1200
const CREDIBILITY_BASELINE = 30
const CREDIBILITY_MAX = 100

// ─── Shape normalization ────────────────────────────────────────────

const VALID_SHAPES = new Set(Object.values(Shape))

const SHAPE_ALIASES = {
  'Circular': Shape.CIRCLE,
  'Round': Shape.CIRCLE,
  'Disc': Shape.DISK,
  'Saucer': Shape.DISK,
  'Triangular': Shape.TRIANGLE,
  'Cigar-shaped': Shape.CIGAR,
  'Cylindrical': Shape.CYLINDER,
  'Rectangular': Shape.RECTANGLE,
  'Egg-shaped': Shape.EGG,
  'Hexagon': Shape.DIAMOND,
  'Bullet/Missile': Shape.CYLINDER,
  'Pellet': Shape.SPHERE,
  'Crescent': Shape.OTHER,
  'Blimp': Shape.CIGAR,
  'Dome': Shape.CIRCLE,
  'Flare': Shape.FIREBALL,
  'N/A': Shape.UNKNOWN,
  '': Shape.UNKNOWN,
}

// ─── Comprehensive country → continent mapping ──────────────────────
// Covers all UN member states, common aliases, and territories.
// If a country is not here, it is logged as unmapped — never silently
// assigned to a wrong continent.

const COUNTRY_CONTINENT = {
  // ── Americas ──
  'USA': Continent.AMERICAS,
  'US': Continent.AMERICAS,
  'United States': Continent.AMERICAS,
  'Canada': Continent.AMERICAS,
  'Mexico': Continent.AMERICAS,
  'Brazil': Continent.AMERICAS,
  'Argentina': Continent.AMERICAS,
  'Colombia': Continent.AMERICAS,
  'Chile': Continent.AMERICAS,
  'Peru': Continent.AMERICAS,
  'Venezuela': Continent.AMERICAS,
  'Ecuador': Continent.AMERICAS,
  'Bolivia': Continent.AMERICAS,
  'Paraguay': Continent.AMERICAS,
  'Uruguay': Continent.AMERICAS,
  'Guyana': Continent.AMERICAS,
  'Suriname': Continent.AMERICAS,
  'Guatemala': Continent.AMERICAS,
  'Honduras': Continent.AMERICAS,
  'El Salvador': Continent.AMERICAS,
  'Nicaragua': Continent.AMERICAS,
  'Costa Rica': Continent.AMERICAS,
  'Panama': Continent.AMERICAS,
  'Cuba': Continent.AMERICAS,
  'Jamaica': Continent.AMERICAS,
  'Haiti': Continent.AMERICAS,
  'Dominican Republic': Continent.AMERICAS,
  'Trinidad and Tobago': Continent.AMERICAS,
  'Bahamas': Continent.AMERICAS,
  'Barbados': Continent.AMERICAS,
  'Belize': Continent.AMERICAS,
  'Puerto Rico': Continent.AMERICAS,
  'Bermuda': Continent.AMERICAS,
  'Cayman Islands': Continent.AMERICAS,
  'US Virgin Islands': Continent.AMERICAS,
  'Aruba': Continent.AMERICAS,
  'Guadeloupe': Continent.AMERICAS,
  'Martinique': Continent.AMERICAS,
  'French Guiana': Continent.AMERICAS,
  'Saint Lucia': Continent.AMERICAS,
  'Grenada': Continent.AMERICAS,
  'Antigua and Barbuda': Continent.AMERICAS,
  'Dominica': Continent.AMERICAS,
  'Saint Kitts and Nevis': Continent.AMERICAS,
  'Saint Vincent and the Grenadines': Continent.AMERICAS,
  'Turks and Caicos Islands': Continent.AMERICAS,
  'Curacao': Continent.AMERICAS,

  // ── Europe ──
  'UK': Continent.EUROPE,
  'United Kingdom': Continent.EUROPE,
  'England': Continent.EUROPE,
  'Scotland': Continent.EUROPE,
  'Wales': Continent.EUROPE,
  'Northern Ireland': Continent.EUROPE,
  'Ireland': Continent.EUROPE,
  'France': Continent.EUROPE,
  'Germany': Continent.EUROPE,
  'Spain': Continent.EUROPE,
  'Italy': Continent.EUROPE,
  'Netherlands': Continent.EUROPE,
  'Belgium': Continent.EUROPE,
  'Sweden': Continent.EUROPE,
  'Norway': Continent.EUROPE,
  'Denmark': Continent.EUROPE,
  'Finland': Continent.EUROPE,
  'Poland': Continent.EUROPE,
  'Portugal': Continent.EUROPE,
  'Greece': Continent.EUROPE,
  'Turkey': Continent.EUROPE,
  'Russia': Continent.EURASIA,
  'Ukraine': Continent.EUROPE,
  'Romania': Continent.EUROPE,
  'Czech Republic': Continent.EUROPE,
  'Czechia': Continent.EUROPE,
  'Austria': Continent.EUROPE,
  'Switzerland': Continent.EUROPE,
  'Hungary': Continent.EUROPE,
  'Bulgaria': Continent.EUROPE,
  'Croatia': Continent.EUROPE,
  'Serbia': Continent.EUROPE,
  'Slovakia': Continent.EUROPE,
  'Slovenia': Continent.EUROPE,
  'Lithuania': Continent.EUROPE,
  'Latvia': Continent.EUROPE,
  'Estonia': Continent.EUROPE,
  'Luxembourg': Continent.EUROPE,
  'Malta': Continent.EUROPE,
  'Cyprus': Continent.EUROPE,
  'Iceland': Continent.EUROPE,
  'Albania': Continent.EUROPE,
  'North Macedonia': Continent.EUROPE,
  'Macedonia': Continent.EUROPE,
  'Montenegro': Continent.EUROPE,
  'Bosnia and Herzegovina': Continent.EUROPE,
  'Bosnia': Continent.EUROPE,
  'Moldova': Continent.EUROPE,
  'Belarus': Continent.EUROPE,
  'Georgia': Continent.EUROPE,  // Note: also a US state — resolved by parser context
  'Armenia': Continent.EUROPE,
  'Azerbaijan': Continent.EUROPE,
  'Kosovo': Continent.EUROPE,
  'Andorra': Continent.EUROPE,
  'Monaco': Continent.EUROPE,
  'Liechtenstein': Continent.EUROPE,
  'San Marino': Continent.EUROPE,
  'Vatican': Continent.EUROPE,
  'Gibraltar': Continent.EUROPE,
  'Faroe Islands': Continent.EUROPE,
  'Isle of Man': Continent.EUROPE,
  'Jersey': Continent.EUROPE,
  'Guernsey': Continent.EUROPE,

  // ── Asia — Middle East, Central & South Asia ──
  'India': Continent.ASIA_MIDDLE_EAST,
  'Pakistan': Continent.ASIA_MIDDLE_EAST,
  'Bangladesh': Continent.ASIA_MIDDLE_EAST,
  'Sri Lanka': Continent.ASIA_MIDDLE_EAST,
  'Nepal': Continent.ASIA_MIDDLE_EAST,
  'Bhutan': Continent.ASIA_MIDDLE_EAST,
  'Maldives': Continent.ASIA_MIDDLE_EAST,
  'Afghanistan': Continent.ASIA_MIDDLE_EAST,
  'Kazakhstan': Continent.ASIA_MIDDLE_EAST,
  'Uzbekistan': Continent.ASIA_MIDDLE_EAST,
  'Turkmenistan': Continent.ASIA_MIDDLE_EAST,
  'Kyrgyzstan': Continent.ASIA_MIDDLE_EAST,
  'Tajikistan': Continent.ASIA_MIDDLE_EAST,
  'Iran': Continent.ASIA_MIDDLE_EAST,
  'Iraq': Continent.ASIA_MIDDLE_EAST,
  'Israel': Continent.ASIA_MIDDLE_EAST,
  'Palestine': Continent.ASIA_MIDDLE_EAST,
  'Lebanon': Continent.ASIA_MIDDLE_EAST,
  'Jordan': Continent.ASIA_MIDDLE_EAST,
  'Syria': Continent.ASIA_MIDDLE_EAST,
  'Saudi Arabia': Continent.ASIA_MIDDLE_EAST,
  'UAE': Continent.ASIA_MIDDLE_EAST,
  'United Arab Emirates': Continent.ASIA_MIDDLE_EAST,
  'Qatar': Continent.ASIA_MIDDLE_EAST,
  'Kuwait': Continent.ASIA_MIDDLE_EAST,
  'Bahrain': Continent.ASIA_MIDDLE_EAST,
  'Oman': Continent.ASIA_MIDDLE_EAST,
  'Yemen': Continent.ASIA_MIDDLE_EAST,

  // ── Asia — Pacific (East & Southeast Asia) ──
  'Japan': Continent.ASIA_PACIFIC,
  'China': Continent.ASIA_PACIFIC,
  'South Korea': Continent.ASIA_PACIFIC,
  'North Korea': Continent.ASIA_PACIFIC,
  'Taiwan': Continent.ASIA_PACIFIC,
  'Hong Kong': Continent.ASIA_PACIFIC,
  'Macau': Continent.ASIA_PACIFIC,
  'Mongolia': Continent.ASIA_PACIFIC,
  'Philippines': Continent.ASIA_PACIFIC,
  'Thailand': Continent.ASIA_PACIFIC,
  'Indonesia': Continent.ASIA_PACIFIC,
  'Malaysia': Continent.ASIA_PACIFIC,
  'Singapore': Continent.ASIA_PACIFIC,
  'Vietnam': Continent.ASIA_PACIFIC,
  'Myanmar': Continent.ASIA_PACIFIC,
  'Cambodia': Continent.ASIA_PACIFIC,
  'Laos': Continent.ASIA_PACIFIC,
  'Brunei': Continent.ASIA_PACIFIC,
  'Timor-Leste': Continent.ASIA_PACIFIC,

  // ── Oceania ──
  'Australia': Continent.OCEANIA,
  'New Zealand': Continent.OCEANIA,
  'Fiji': Continent.OCEANIA,
  'Papua New Guinea': Continent.OCEANIA,
  'Samoa': Continent.OCEANIA,
  'Tonga': Continent.OCEANIA,
  'Vanuatu': Continent.OCEANIA,
  'Solomon Islands': Continent.OCEANIA,
  'Micronesia': Continent.OCEANIA,
  'Kiribati': Continent.OCEANIA,
  'Marshall Islands': Continent.OCEANIA,
  'Palau': Continent.OCEANIA,
  'Tuvalu': Continent.OCEANIA,
  'Nauru': Continent.OCEANIA,
  'Guam': Continent.OCEANIA,
  'New Caledonia': Continent.OCEANIA,
  'French Polynesia': Continent.OCEANIA,
  'American Samoa': Continent.OCEANIA,

  // ── Africa ──
  'South Africa': Continent.AFRICA,
  'Nigeria': Continent.AFRICA,
  'Kenya': Continent.AFRICA,
  'Egypt': Continent.AFRICA,
  'Ethiopia': Continent.AFRICA,
  'Ghana': Continent.AFRICA,
  'Tanzania': Continent.AFRICA,
  'Uganda': Continent.AFRICA,
  'Algeria': Continent.AFRICA,
  'Morocco': Continent.AFRICA,
  'Tunisia': Continent.AFRICA,
  'Libya': Continent.AFRICA,
  'Sudan': Continent.AFRICA,
  'South Sudan': Continent.AFRICA,
  'Democratic Republic of the Congo': Continent.AFRICA,
  'Congo': Continent.AFRICA,
  'Cameroon': Continent.AFRICA,
  'Ivory Coast': Continent.AFRICA,
  'Senegal': Continent.AFRICA,
  'Mali': Continent.AFRICA,
  'Burkina Faso': Continent.AFRICA,
  'Niger': Continent.AFRICA,
  'Chad': Continent.AFRICA,
  'Somalia': Continent.AFRICA,
  'Zimbabwe': Continent.AFRICA,
  'Zambia': Continent.AFRICA,
  'Mozambique': Continent.AFRICA,
  'Madagascar': Continent.AFRICA,
  'Angola': Continent.AFRICA,
  'Botswana': Continent.AFRICA,
  'Namibia': Continent.AFRICA,
  'Rwanda': Continent.AFRICA,
  'Malawi': Continent.AFRICA,
  'Mauritius': Continent.AFRICA,
  'Togo': Continent.AFRICA,
  'Sierra Leone': Continent.AFRICA,
  'Liberia': Continent.AFRICA,
  'Central African Republic': Continent.AFRICA,
  'Eritrea': Continent.AFRICA,
  'Djibouti': Continent.AFRICA,
  'Gabon': Continent.AFRICA,
  'Equatorial Guinea': Continent.AFRICA,
  'Eswatini': Continent.AFRICA,
  'Lesotho': Continent.AFRICA,
  'Guinea': Continent.AFRICA,
  'Guinea-Bissau': Continent.AFRICA,
  'Benin': Continent.AFRICA,
  'Burundi': Continent.AFRICA,
  'Comoros': Continent.AFRICA,
  'Cape Verde': Continent.AFRICA,
  'Cabo Verde': Continent.AFRICA,
  'Seychelles': Continent.AFRICA,
  'Sao Tome and Principe': Continent.AFRICA,
  'Gambia': Continent.AFRICA,
  'Mauritania': Continent.AFRICA,
  'Reunion': Continent.AFRICA,
}

// ─── Country → default coordinates (capital / geographic centroid) ───
// Used as fallback when individual sighting has no coordinates.
// Comprehensive set matching src/data/countries.ts for consistency.

const COUNTRY_COORDS = {
  // Americas
  'USA': { lat: 38.895, lng: -77.036 }, 'US': { lat: 38.895, lng: -77.036 },
  'United States': { lat: 38.895, lng: -77.036 },
  'Canada': { lat: 45.421, lng: -75.697 }, 'Mexico': { lat: 19.433, lng: -99.133 },
  'Brazil': { lat: -15.798, lng: -47.892 }, 'Argentina': { lat: -34.604, lng: -58.382 },
  'Colombia': { lat: 4.711, lng: -74.072 }, 'Chile': { lat: -33.449, lng: -70.669 },
  'Peru': { lat: -12.046, lng: -77.043 }, 'Venezuela': { lat: 10.481, lng: -66.904 },
  'Ecuador': { lat: -0.181, lng: -78.468 }, 'Bolivia': { lat: -16.490, lng: -68.119 },
  'Paraguay': { lat: -25.264, lng: -57.576 }, 'Uruguay': { lat: -34.901, lng: -56.165 },
  'Guyana': { lat: 6.801, lng: -58.155 }, 'Suriname': { lat: 5.852, lng: -55.204 },
  'Guatemala': { lat: 14.635, lng: -90.507 }, 'Honduras': { lat: 14.072, lng: -87.192 },
  'El Salvador': { lat: 13.693, lng: -89.218 }, 'Nicaragua': { lat: 12.115, lng: -86.236 },
  'Costa Rica': { lat: 9.928, lng: -84.091 }, 'Panama': { lat: 8.982, lng: -79.520 },
  'Cuba': { lat: 23.114, lng: -82.367 }, 'Jamaica': { lat: 18.110, lng: -77.298 },
  'Haiti': { lat: 18.594, lng: -72.307 }, 'Dominican Republic': { lat: 18.486, lng: -69.931 },
  'Trinidad and Tobago': { lat: 10.692, lng: -61.223 }, 'Bahamas': { lat: 25.034, lng: -77.396 },
  'Barbados': { lat: 13.113, lng: -59.599 }, 'Belize': { lat: 17.190, lng: -88.498 },
  'Puerto Rico': { lat: 18.466, lng: -66.106 }, 'Bermuda': { lat: 32.308, lng: -64.751 },
  // Europe
  'UK': { lat: 51.507, lng: -0.128 }, 'United Kingdom': { lat: 51.507, lng: -0.128 },
  'England': { lat: 51.507, lng: -0.128 }, 'Scotland': { lat: 55.953, lng: -3.188 },
  'Wales': { lat: 51.482, lng: -3.179 }, 'Northern Ireland': { lat: 54.597, lng: -5.930 },
  'Ireland': { lat: 53.350, lng: -6.260 }, 'France': { lat: 48.857, lng: 2.352 },
  'Germany': { lat: 52.520, lng: 13.405 }, 'Spain': { lat: 40.417, lng: -3.704 },
  'Italy': { lat: 41.903, lng: 12.496 }, 'Netherlands': { lat: 52.368, lng: 4.904 },
  'Belgium': { lat: 50.850, lng: 4.352 }, 'Sweden': { lat: 59.329, lng: 18.069 },
  'Norway': { lat: 59.914, lng: 10.752 }, 'Denmark': { lat: 55.676, lng: 12.568 },
  'Finland': { lat: 60.170, lng: 24.938 }, 'Poland': { lat: 52.230, lng: 21.012 },
  'Portugal': { lat: 38.722, lng: -9.139 }, 'Greece': { lat: 37.984, lng: 23.728 },
  'Turkey': { lat: 39.933, lng: 32.860 }, 'Ukraine': { lat: 50.450, lng: 30.523 },
  'Romania': { lat: 44.427, lng: 26.103 }, 'Czech Republic': { lat: 50.076, lng: 14.438 },
  'Czechia': { lat: 50.076, lng: 14.438 }, 'Austria': { lat: 48.208, lng: 16.374 },
  'Switzerland': { lat: 46.948, lng: 7.447 }, 'Hungary': { lat: 47.498, lng: 19.040 },
  'Bulgaria': { lat: 42.698, lng: 23.322 }, 'Croatia': { lat: 45.815, lng: 15.982 },
  'Serbia': { lat: 44.787, lng: 20.449 }, 'Slovakia': { lat: 48.149, lng: 17.108 },
  'Slovenia': { lat: 46.057, lng: 14.506 }, 'Lithuania': { lat: 54.687, lng: 25.280 },
  'Latvia': { lat: 56.950, lng: 24.105 }, 'Estonia': { lat: 59.437, lng: 24.754 },
  'Luxembourg': { lat: 49.612, lng: 6.132 }, 'Malta': { lat: 35.899, lng: 14.515 },
  'Cyprus': { lat: 35.186, lng: 33.382 }, 'Iceland': { lat: 64.147, lng: -21.943 },
  'Albania': { lat: 41.328, lng: 19.819 }, 'North Macedonia': { lat: 41.997, lng: 21.428 },
  'Montenegro': { lat: 42.430, lng: 19.259 },
  'Bosnia and Herzegovina': { lat: 43.856, lng: 18.413 },
  'Moldova': { lat: 47.011, lng: 28.864 }, 'Belarus': { lat: 53.901, lng: 27.559 },
  'Georgia': { lat: 41.715, lng: 44.827 }, 'Armenia': { lat: 40.179, lng: 44.499 },
  'Azerbaijan': { lat: 40.409, lng: 49.867 },
  // Eurasia
  'Russia': { lat: 55.756, lng: 37.617 }, 'USSR': { lat: 55.756, lng: 37.617 },
  'Soviet Union': { lat: 55.756, lng: 37.617 },
  // Middle East & South/Central Asia
  'India': { lat: 28.614, lng: 77.209 }, 'Pakistan': { lat: 33.684, lng: 73.048 },
  'Bangladesh': { lat: 23.810, lng: 90.413 }, 'Sri Lanka': { lat: 6.927, lng: 79.861 },
  'Nepal': { lat: 27.717, lng: 85.324 }, 'Afghanistan': { lat: 34.555, lng: 69.208 },
  'Kazakhstan': { lat: 51.169, lng: 71.449 }, 'Uzbekistan': { lat: 41.300, lng: 69.240 },
  'Iran': { lat: 35.689, lng: 51.389 }, 'Iraq': { lat: 33.315, lng: 44.366 },
  'Israel': { lat: 31.768, lng: 35.214 }, 'Palestine': { lat: 31.952, lng: 35.233 },
  'Lebanon': { lat: 33.894, lng: 35.502 }, 'Jordan': { lat: 31.945, lng: 35.928 },
  'Syria': { lat: 33.514, lng: 36.277 }, 'Saudi Arabia': { lat: 24.714, lng: 46.675 },
  'UAE': { lat: 24.454, lng: 54.377 }, 'United Arab Emirates': { lat: 24.454, lng: 54.377 },
  'Qatar': { lat: 25.285, lng: 51.531 }, 'Kuwait': { lat: 29.376, lng: 47.977 },
  'Oman': { lat: 23.588, lng: 58.383 }, 'Yemen': { lat: 15.369, lng: 44.191 },
  // Asia Pacific
  'Japan': { lat: 35.676, lng: 139.650 }, 'China': { lat: 39.904, lng: 116.407 },
  'South Korea': { lat: 37.567, lng: 126.978 }, 'Taiwan': { lat: 25.033, lng: 121.565 },
  'Hong Kong': { lat: 22.319, lng: 114.169 }, 'Philippines': { lat: 14.600, lng: 120.984 },
  'Vietnam': { lat: 21.029, lng: 105.854 }, 'Thailand': { lat: 13.756, lng: 100.502 },
  'Myanmar': { lat: 19.763, lng: 96.079 }, 'Cambodia': { lat: 11.556, lng: 104.928 },
  'Laos': { lat: 17.976, lng: 102.633 }, 'Malaysia': { lat: 3.139, lng: 101.687 },
  'Singapore': { lat: 1.352, lng: 103.820 }, 'Indonesia': { lat: -6.209, lng: 106.846 },
  // Oceania
  'Australia': { lat: -35.281, lng: 149.130 }, 'New Zealand': { lat: -41.287, lng: 174.776 },
  'Fiji': { lat: -18.142, lng: 178.442 }, 'Guam': { lat: 13.444, lng: 144.794 },
  'Hawaii': { lat: 21.307, lng: -157.858 },
  // Africa
  'South Africa': { lat: -25.748, lng: 28.229 }, 'Nigeria': { lat: 9.077, lng: 7.399 },
  'Egypt': { lat: 30.044, lng: 31.236 }, 'Kenya': { lat: -1.292, lng: 36.822 },
  'Morocco': { lat: 33.972, lng: -6.850 }, 'Algeria': { lat: 36.754, lng: 3.059 },
  'Tunisia': { lat: 36.807, lng: 10.182 }, 'Ghana': { lat: 5.604, lng: -0.187 },
  'Ethiopia': { lat: 9.019, lng: 38.753 }, 'Tanzania': { lat: -6.792, lng: 39.208 },
}

// US state abbreviations → full name
const US_STATES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
}

// Canadian province abbreviations
const CA_PROVINCES = {
  'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba',
  'NB': 'New Brunswick', 'NL': 'Newfoundland', 'NS': 'Nova Scotia',
  'NT': 'Northwest Territories', 'NU': 'Nunavut', 'ON': 'Ontario',
  'PE': 'Prince Edward Island', 'QC': 'Quebec', 'SK': 'Saskatchewan',
  'YT': 'Yukon',
}

// ─── Audit trackers ─────────────────────────────────────────────────

const unmappedCountries = new Map()   // country → count
const unmappedShapes = new Map()      // shape → count
const seenCharacteristics = new Map() // characteristic → count

// ─── Parsing helpers ────────────────────────────────────────────────

function parseNuforcDate(raw) {
  if (!raw) return null
  const match = raw.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/)
  if (!match) return null
  return match[1].replace(' ', 'T')
}

function parseLocation(raw) {
  const fallback = {
    city: '', state: '', country: Shape.UNKNOWN,
    region: '', continent: Continent.AMERICAS,
  }

  if (!raw) return fallback

  const parts = raw.split(',').map(s => s.trim())

  let city = parts[0] || ''
  let state = ''
  let country = Shape.UNKNOWN

  if (parts.length >= 3) {
    state = parts[1] || ''
    country = parts[2] || Shape.UNKNOWN
  } else if (parts.length === 2) {
    const second = parts[1] || ''
    if (US_STATES[second]) {
      state = second
      country = 'USA'
    } else if (CA_PROVINCES[second]) {
      state = second
      country = 'Canada'
    } else {
      country = second
    }
  }

  // Normalize country aliases
  if (country === 'United States' || country === 'US') country = 'USA'

  // Build region string
  let region = city
  if (state && US_STATES[state]) {
    region = `${city}, ${state}`
    country = 'USA'
  } else if (state && CA_PROVINCES[state]) {
    region = `${city}, ${state}`
    country = 'Canada'
  } else if (state) {
    region = `${city}, ${state}`
  }

  // Resolve continent — log unmapped countries instead of silently defaulting
  let continent = COUNTRY_CONTINENT[country]
  if (!continent) {
    unmappedCountries.set(country, (unmappedCountries.get(country) || 0) + 1)
    continent = Continent.AMERICAS // fallback for predominantly US dataset
  }

  return { city, state, country, region, continent }
}

function normalizeShape(raw) {
  if (!raw) return Shape.UNKNOWN
  const trimmed = raw.trim()
  if (VALID_SHAPES.has(trimmed)) return trimmed
  if (SHAPE_ALIASES[trimmed]) return SHAPE_ALIASES[trimmed]

  // Case-insensitive fallback
  for (const shape of VALID_SHAPES) {
    if (shape.toLowerCase() === trimmed.toLowerCase()) return shape
  }

  // Log unmapped shapes for audit
  unmappedShapes.set(trimmed, (unmappedShapes.get(trimmed) || 0) + 1)
  return Shape.UNKNOWN
}

/**
 * Pass through ALL characteristics from the source.
 * We do NOT whitelist — NUFORC defines the vocabulary, not us.
 * Unknown characteristics are tracked for awareness but never dropped.
 */
function parseCharacteristics(raw) {
  if (!Array.isArray(raw)) return []

  return raw.filter(c => {
    if (typeof c !== 'string' || !c.trim()) return false
    const trimmed = c.trim()
    seenCharacteristics.set(trimmed, (seenCharacteristics.get(trimmed) || 0) + 1)
    return true
  }).map(c => c.trim())
}

/**
 * Naive credibility score (0–100).
 * Factors: observer count, characteristic detail, duration specificity, summary length.
 * Placeholder until a proper scoring model is built.
 */
function computeCredibility(record) {
  let score = CREDIBILITY_BASELINE

  const observers = record['No of observers'] || 0
  if (observers >= 4) score += 25
  else if (observers >= 2) score += 15
  else if (observers === 1) score += 5

  const chars = Array.isArray(record.Characteristics) ? record.Characteristics.length : 0
  score += Math.min(chars * 5, 20)

  const duration = record.Duration || ''
  if (/\d/.test(duration)) score += 10

  const summary = record.Summary || ''
  if (summary.length > SUMMARY_MAX_LENGTH) score += 10
  else if (summary.length > 50) score += 5

  return Math.min(score, CREDIBILITY_MAX)
}

function truncate(text, maxLen) {
  if (!text) return ''
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  const inputPath = process.argv[2] || DEFAULT_INPUT

  if (!existsSync(inputPath)) {
    console.error(`\n  ✗ File not found: ${inputPath}`)
    console.error(`\n  Download it first:`)
    console.error(`  curl -L -o nuforc.json https://huggingface.co/datasets/kcimc/NUFORC/resolve/main/nuforc.json\n`)
    process.exit(1)
  }

  console.log(`\n  Reading ${inputPath}...`)
  const raw = readFileSync(inputPath, 'utf-8')

  console.log('  Parsing JSON...')
  const records = JSON.parse(raw)
  console.log(`  Found ${records.length.toLocaleString()} records`)

  const byYear = new Map()
  let skipped = 0
  let processed = 0
  const shapeCounts = new Map()
  const countryCounts = new Map()

  for (const record of records) {
    const occurredAt = parseNuforcDate(record.Occurred)
    if (!occurredAt) {
      skipped++
      continue
    }

    const year = occurredAt.slice(0, 4)
    const yearNum = parseInt(year, 10)
    if (yearNum < VALID_YEAR_MIN || yearNum > VALID_YEAR_MAX) {
      skipped++
      continue
    }

    const reportedAt = parseNuforcDate(record.Reported) || occurredAt
    const postedAt = parseNuforcDate(record.Posted) || reportedAt

    const loc = parseLocation(record.Location)
    const shape = normalizeShape(record.Shape)
    const characteristics = parseCharacteristics(record.Characteristics)
    const credibility = computeCredibility(record)

    shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1)
    countryCounts.set(loc.country, (countryCounts.get(loc.country) || 0) + 1)

    const sighting = {
      id: String(record.Sighting || processed),
      source: Source.NUFORC,
      occurredAt,
      reportedAt,
      postedAt,
      location: record.Location || '',
      shape,
      duration: record.Duration || '',
      observers: record['No of observers'] || 0,
      summary: truncate(record.Summary, SUMMARY_MAX_LENGTH),
      description: truncate(record.Text, DESCRIPTION_MAX_LENGTH),
      characteristics,
      coordinates: COUNTRY_COORDS[loc.country] || null,
      region: loc.region,
      country: loc.country,
      continent: loc.continent,
      status: Status.PENDING,
      credibility,
    }

    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year).push(sighting)
    processed++
  }

  // ─ Write chunks ─
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRecords: processed,
    skippedRecords: skipped,
    years: {},
  }

  const sortedYears = [...byYear.keys()].sort()

  for (const year of sortedYears) {
    const sightings = byYear.get(year)
    sightings.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

    const filename = `nuforc-${year}.json`
    const filepath = resolve(OUTPUT_DIR, filename)
    writeFileSync(filepath, JSON.stringify(sightings))

    const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(sightings)) / 1024)
    manifest.years[year] = { count: sightings.length, file: filename, sizeKB }
  }

  const manifestPath = resolve(OUTPUT_DIR, 'nuforc-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // ─ Summary ─
  console.log(`\n  ✓ Processed ${processed.toLocaleString()} sightings (${skipped} skipped)`)
  console.log(`  ✓ ${sortedYears.length} year chunks written to public/data/`)
  console.log(`\n  Year range: ${sortedYears[0]} — ${sortedYears[sortedYears.length - 1]}`)

  // Top shapes
  const topShapes = [...shapeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`\n  Top shapes:`)
  for (const [shape, count] of topShapes) {
    console.log(`    ${shape.padEnd(14)} ${count.toLocaleString()}`)
  }

  // Top countries
  const topCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`\n  Top countries:`)
  for (const [country, count] of topCountries) {
    console.log(`    ${country.padEnd(16)} ${count.toLocaleString()}`)
  }

  // ─ Audit: unmapped data ─
  if (unmappedCountries.size > 0) {
    const sorted = [...unmappedCountries.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\n  ⚠ Unmapped countries (${unmappedCountries.size} unique, defaulted to ${Continent.AMERICAS}):`)
    for (const [country, count] of sorted.slice(0, 20)) {
      console.log(`    ${country.padEnd(24)} ${count.toLocaleString()}`)
    }
    if (sorted.length > 20) {
      console.log(`    ... and ${sorted.length - 20} more`)
    }
  }

  if (unmappedShapes.size > 0) {
    const sorted = [...unmappedShapes.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\n  ⚠ Unmapped shapes (${unmappedShapes.size} unique, defaulted to ${Shape.UNKNOWN}):`)
    for (const [shape, count] of sorted) {
      console.log(`    "${shape}" → ${count.toLocaleString()}`)
    }
  }

  // All characteristics seen in source data
  const charsSorted = [...seenCharacteristics.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\n  Characteristics found in source (${charsSorted.length} unique):`)
  for (const [char, count] of charsSorted) {
    console.log(`    ${char.padEnd(40)} ${count.toLocaleString()}`)
  }

  // Size report
  const totalMB = Object.values(manifest.years).reduce((a, y) => a + y.sizeKB, 0) / 1024
  console.log(`\n  Total output: ${totalMB.toFixed(1)} MB (from ${(Buffer.byteLength(raw) / 1024 / 1024).toFixed(0)} MB input)`)
  console.log(`  Manifest: ${manifestPath}\n`)
}

main()
