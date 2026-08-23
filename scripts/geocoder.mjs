/**
 * Geocoder — offline city-level coordinate resolution
 *
 * Single source of truth: `all-the-cities` (135K cities worldwide).
 * Builds in-memory indices on first call. No COUNTRY_COORDS or STATE_COORDS.
 *
 * Lookup priority:
 *   1. city + state + country  (exact)
 *   2. city + country          (highest population match)
 *   3. city only               (highest population globally)
 *   4. state fallback          (largest city in that US/CA state)
 *   5. country fallback        (largest city in that country)
 *   6. null
 */

import allCities from 'all-the-cities'

// ─── Country name → ISO 2-letter code ───────────────────────────────

const COUNTRY_TO_ISO = {
  'USA': 'US', 'US': 'US', 'United States': 'US',
  'Canada': 'CA',
  'UK': 'GB', 'United Kingdom': 'GB', 'Great Britain': 'GB', 'England': 'GB',
  'Scotland': 'GB', 'Wales': 'GB', 'Northern Ireland': 'GB',
  'Russia': 'RU', 'USSR': 'RU', 'Soviet Union': 'RU',
  'Germany': 'DE', 'West Germany': 'DE', 'East Germany': 'DE',
  'France': 'FR', 'Corsica': 'FR',
  'Italy': 'IT', 'Sicily': 'IT', 'Sardinia': 'IT',
  'Spain': 'ES', 'Canary Islands': 'ES',
  'Portugal': 'PT', 'Azores': 'PT',
  'Netherlands': 'NL', 'Holland': 'NL',
  'Belgium': 'BE', 'Switzerland': 'CH', 'Austria': 'AT',
  'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI', 'Iceland': 'IS',
  'Ireland': 'IE', 'Poland': 'PL',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Czechoslovakia': 'CZ',
  'Slovakia': 'SK', 'Hungary': 'HU', 'Romania': 'RO', 'Bulgaria': 'BG',
  'Greece': 'GR', 'Crete': 'GR', 'Turkey': 'TR',
  'Ukraine': 'UA', 'Belarus': 'BY',
  'Lithuania': 'LT', 'Latvia': 'LV', 'Estonia': 'EE',
  'Georgia': 'GE', 'Armenia': 'AM', 'Azerbaijan': 'AZ',
  'Croatia': 'HR', 'Serbia': 'RS', 'Yugoslavia': 'RS',
  'Bosnia': 'BA', 'Bosnia and Herzegovina': 'BA',
  'Slovenia': 'SI', 'North Macedonia': 'MK', 'Macedonia': 'MK',
  'Albania': 'AL', 'Montenegro': 'ME', 'Moldova': 'MD',
  'China': 'CN', 'Japan': 'JP',
  'South Korea': 'KR', 'Korea': 'KR', 'North Korea': 'KP',
  'India': 'IN', 'Pakistan': 'PK', 'Bangladesh': 'BD',
  'Sri Lanka': 'LK', 'Ceylon': 'LK', 'Nepal': 'NP',
  'Thailand': 'TH', 'Vietnam': 'VN', 'Philippines': 'PH',
  'Indonesia': 'ID', 'Malaysia': 'MY', 'Singapore': 'SG',
  'Taiwan': 'TW', 'Myanmar': 'MM', 'Burma': 'MM',
  'Cambodia': 'KH', 'Laos': 'LA', 'Mongolia': 'MN',
  'Iran': 'IR', 'Persia': 'IR', 'Iraq': 'IQ',
  'Saudi Arabia': 'SA', 'Israel': 'IL', 'Palestine': 'PS',
  'Lebanon': 'LB', 'Syria': 'SY', 'Jordan': 'JO',
  'Kuwait': 'KW', 'UAE': 'AE', 'United Arab Emirates': 'AE',
  'Qatar': 'QA', 'Bahrain': 'BH', 'Oman': 'OM', 'Yemen': 'YE',
  'Afghanistan': 'AF',
  'Egypt': 'EG', 'Libya': 'LY', 'Tunisia': 'TN', 'Algeria': 'DZ', 'Morocco': 'MA',
  'South Africa': 'ZA', 'Nigeria': 'NG', 'Kenya': 'KE', 'Tanzania': 'TZ',
  'Ethiopia': 'ET', 'Abyssinia': 'ET', 'Ghana': 'GH', 'Senegal': 'SN',
  'Sudan': 'SD', 'Zimbabwe': 'ZW', 'Rhodesia': 'ZW',
  'Uganda': 'UG', 'Mozambique': 'MZ', 'Zambia': 'ZM', 'Angola': 'AO',
  'Cameroon': 'CM', 'Congo': 'CG', 'Democratic Republic of the Congo': 'CD',
  'Madagascar': 'MG', 'Namibia': 'NA', 'Botswana': 'BW', 'Mali': 'ML',
  'Ivory Coast': 'CI',
  'Australia': 'AU', 'New Zealand': 'NZ', 'Papua New Guinea': 'PG', 'Fiji': 'FJ',
  'Mexico': 'MX', 'Brazil': 'BR', 'Argentina': 'AR', 'Colombia': 'CO',
  'Chile': 'CL', 'Peru': 'PE', 'Venezuela': 'VE', 'Ecuador': 'EC',
  'Bolivia': 'BO', 'Paraguay': 'PY', 'Uruguay': 'UY',
  'Cuba': 'CU', 'Jamaica': 'JM', 'Haiti': 'HT', 'Dominican Republic': 'DO',
  'Puerto Rico': 'PR', 'Guatemala': 'GT', 'Honduras': 'HN',
  'El Salvador': 'SV', 'Nicaragua': 'NI', 'Costa Rica': 'CR', 'Panama': 'PA',
  'Trinidad and Tobago': 'TT', 'Bahamas': 'BS', 'Bermuda': 'BM', 'Guam': 'GU',
  'Luxembourg': 'LU', 'Malta': 'MT', 'Cyprus': 'CY',
  'Kazakhstan': 'KZ', 'Uzbekistan': 'UZ', 'Turkmenistan': 'TM',
  'Kyrgyzstan': 'KG', 'Tajikistan': 'TJ',
  // Hatch compound country names
  'Great Britain and Ireland': 'GB',
  'Scandanavian and Finland': 'SE',
  'Scandinavia and Finland': 'SE',
  'Belgium, Netherlandsand Luxembourg': 'BE',
  'Belgium, Netherlands and Luxembourg': 'BE',
  'Republic of South Africa': 'ZA',
  'Zimbabwe & Zambia': 'ZW',
  'Korea(both sides)': 'KR',
  'Korea (both sides)': 'KR',
  'Former Yugoslavia': 'RS',
  'Greece and Island nations': 'GR',
  'Estonia, Latvia& Lithuania': 'EE',
  'Estonia, Latvia & Lithuania': 'EE',
  // Common variants
  'Türkiye': 'TR', 'Turkiye': 'TR',
  'The Bahamas': 'BS',
  'Northern Mariana Islands': 'MP',
  'International Waters': '__SEA',
  'Pacific Ocean': '__SEA',
  'Atlantic Ocean': '__SEA',
  'Indian Ocean': '__SEA',
  'Pacific Ocean and non - Asian islands': '__SEA',
  'Atlantic Ocean + islands': '__SEA',
  'Indian Ocean + islands': '__SEA',
  'Caribbean area': 'CU',
  'Unspecified': '__UNK'
}

// US state full name → abbreviation
const US_STATE_TO_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
}

const US_ABBR_SET = new Set(Object.values(US_STATE_TO_ABBR))
const CA_PROVINCES = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'])

// City name aliases (modern names, ancient names, transliterations)
const CITY_ALIASES = {
  'new york': 'new york city',
  'washington': 'washington, d.c.',
  'st. louis': 'saint louis',
  'st. paul': 'saint paul',
  'st. petersburg': 'saint petersburg',
  'ft. worth': 'fort worth',
  'ft. lauderdale': 'fort lauderdale',
  // Ancient / alternate names
  'byblos': 'jbeil',           // Byblos → Jbeil (modern Arabic), Lebanon
  'tyre': 'sour',              // Tyre → Sour, Lebanon
  'sidon': 'saida',            // Sidon → Saida, Lebanon
  'baalbek': 'baalbeck',       // variant spelling
  'tripolis': 'tripoli',       // ancient Greek → modern
  'smyrna': 'izmir',           // Turkey
  'constantinople': 'istanbul', // Turkey
  'peking': 'beijing',         // China
  'bombay': 'mumbai',          // India
  'madras': 'chennai',         // India
  'calcutta': 'kolkata',       // India
  'rangoon': 'yangon',         // Myanmar
  'saigon': 'ho chi minh city', // Vietnam
  'batavia': 'jakarta',        // Indonesia
  'leopoldville': 'kinshasa',  // DRC
  'salisbury': 'harare',       // Zimbabwe (only as alias, won't affect UK Salisbury since it checks country)
  'leningrad': 'saint petersburg', // Russia
  'stalingrad': 'volgograd',   // Russia
  'petrograd': 'saint petersburg', // Russia
  'danzig': 'gdansk',          // Poland
  'breslau': 'wroclaw',        // Poland
  'konigsberg': 'kaliningrad', // Russia
  'formosa': 'taipei'          // Taiwan
}

// ─── Indices (built once) ───────────────────────────────────────────

let indexBuilt = false

const byCityStateCountry = new Map() // "city|state|iso" → { lat, lng, pop }
const byCityCountry = new Map()      // "city|iso" → [{ lat, lng, pop }] sorted by pop
const byCityOnly = new Map()         // "city" → [{ lat, lng, pop, country }] sorted by pop
const byState = new Map()            // "state|iso" → { lat, lng } (largest city)
const byCountry = new Map()          // "iso" → { lat, lng } (largest city)

function buildIndex () {
  if (indexBuilt) return
  indexBuilt = true

  for (const c of allCities) {
    const name = c.name.toLowerCase()
    const iso = c.country
    const admin = (c.adminCode || '').toLowerCase()
    const coords = { lat: c.loc.coordinates[1], lng: c.loc.coordinates[0] }
    const pop = c.population || 0

    // Level 1: city + admin + country
    const key3 = `${name}|${admin}|${iso}`
    if (!byCityStateCountry.has(key3) || pop > byCityStateCountry.get(key3).pop) {
      byCityStateCountry.set(key3, { ...coords, pop })
    }

    // Level 2: city + country
    const key2 = `${name}|${iso}`
    if (!byCityCountry.has(key2)) byCityCountry.set(key2, [])
    byCityCountry.get(key2).push({ ...coords, pop })

    // Level 3: city only
    if (!byCityOnly.has(name)) byCityOnly.set(name, [])
    byCityOnly.get(name).push({ ...coords, pop, country: iso })

    // State fallback: largest city per state+country
    if (admin) {
      const stateKey = `${admin}|${iso}`
      if (!byState.has(stateKey) || pop > byState.get(stateKey).pop) {
        byState.set(stateKey, { ...coords, pop })
      }
    }

    // Country fallback: largest city per country
    if (!byCountry.has(iso) || pop > byCountry.get(iso).pop) {
      byCountry.set(iso, { ...coords, pop })
    }
  }

  // Sort level 2 and 3 by population descending
  for (const [, arr] of byCityCountry) arr.sort((a, b) => b.pop - a.pop)
  for (const [, arr] of byCityOnly) arr.sort((a, b) => b.pop - a.pop)

  console.log(`[geocoder] Index: ${byCityStateCountry.size} city+state+country, ${byCityCountry.size} city+country, ${byCityOnly.size} city-only, ${byState.size} states, ${byCountry.size} countries`)
}

// ─── Coordinate resolver ────────────────────────────────────────────

/**
 * @param {string} city
 * @param {string} state - abbreviation or full name
 * @param {string} country - our format ("USA", "Russia", etc.)
 * @returns {{ lat: number, lng: number } | null}
 */
/**
 * ISO2 country of the most populous city bearing this name, or null.
 *
 * Last-resort tier for geo-resolve.mjs. Many NUFORC "country" tokens are in
 * fact city names that landed in the wrong comma-delimited slot ("Milan",
 * "Grenoble", "Barnsley", "Siauliai"). Resolving them against the existing
 * 135K-city index beats hand-maintaining a city list, and population ordering
 * makes the pick deterministic. `minPopulation` guards the weaker
 * segment-scan caller against matching an obscure hamlet on a common word.
 */
export function lookupCountryByCity (name, minPopulation = 0) {
  buildIndex()
  const matches = byCityOnly.get(String(name || '').toLowerCase().trim())
  if (!matches || !matches.length) return null
  const best = matches[0]
  return best.pop >= minPopulation ? best.country : null
}

export function resolveCoordinates (city, state, country) {
  buildIndex()

  let iso = COUNTRY_TO_ISO[country] || country
  let stateNorm = (state || '').trim()

  // Handle D.C. parsed as country
  if (country === 'D.C.' || country === 'DC' || country === 'D.C') {
    iso = 'US'
    stateNorm = 'DC'
  }

  // State full name → abbreviation
  if (US_STATE_TO_ABBR[stateNorm]) stateNorm = US_STATE_TO_ABBR[stateNorm]

  let cityLower = (city || '').toLowerCase().trim()
  if (CITY_ALIASES[cityLower]) cityLower = CITY_ALIASES[cityLower]

  if (cityLower) {
    // Level 1: city + state + country
    if (stateNorm) {
      const match = byCityStateCountry.get(`${cityLower}|${stateNorm.toLowerCase()}|${iso}`)
      if (match) return { lat: match.lat, lng: match.lng }
    }

    // Level 2: city + country
    const matches2 = byCityCountry.get(`${cityLower}|${iso}`)
    if (matches2?.length) return { lat: matches2[0].lat, lng: matches2[0].lng }

    // Level 3: city only (highest population)
    const matches3 = byCityOnly.get(cityLower)
    if (matches3?.length) return { lat: matches3[0].lat, lng: matches3[0].lng }
  }

  // Level 4: state fallback (largest city in state)
  if (stateNorm) {
    const stateMatch = byState.get(`${stateNorm.toLowerCase()}|${iso}`)
    if (stateMatch) return { lat: stateMatch.lat, lng: stateMatch.lng }
  }

  // Level 5: country fallback (largest city in country)
  const countryMatch = byCountry.get(iso)
  if (countryMatch) return { lat: countryMatch.lat, lng: countryMatch.lng }

  return null
}

// ─── Location normalizer ────────────────────────────────────────────

/**
 * @param {string} raw
 * @returns {{ city: string, state: string, country: string }}
 */
export function normalizeLocationString (raw) {
  if (!raw || typeof raw !== 'string') return { city: '', state: '', country: '' }

  let s = raw.trim()

  // Strip directional/relational prefixes
  s = s.replace(/^(?:near|off|over|above|outside|south of|north of|east of|west of|northwest of|northeast of|southwest of|southeast of|coast of)\s+/i, '')
  s = s.replace(/^(?:the\s+)/i, '')

  // Handle "COUNTRY: Region (City)" format
  if (s.includes(':')) {
    const [beforeColon, afterColon] = s.split(':').map(p => p.trim())
    const countryFromColon = resolveCountryName(beforeColon)
    if (countryFromColon) {
      const inner = parseInner(afterColon || '')
      return { city: inner.city, state: inner.state, country: countryFromColon }
    }
  }

  // Handle "City (State/Country)" format
  const parenMatch = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) {
    const before = parenMatch[1].trim()
    const inside = parenMatch[2].trim()
    const stateAbbr = US_STATE_TO_ABBR[inside] || (US_ABBR_SET.has(inside) ? inside : null)
    if (stateAbbr) return { city: before, state: stateAbbr, country: 'USA' }
    const countryFromParen = resolveCountryName(inside)
    if (countryFromParen) return { city: before, state: '', country: countryFromParen }
    return { city: before, state: inside, country: '' }
  }

  // Handle "City, State, Country"
  const commaParts = s.split(',').map(p => p.trim())
  if (commaParts.length >= 3) {
    return { city: commaParts[0], state: commaParts[1], country: resolveCountryName(commaParts[2]) || commaParts[2] }
  }
  if (commaParts.length === 2) {
    const second = commaParts[1]
    if (second === 'D.C.' || second === 'DC' || second === 'D.C') return { city: commaParts[0], state: 'DC', country: 'USA' }
    const stateAbbr = US_STATE_TO_ABBR[second] || (US_ABBR_SET.has(second) ? second : null)
    if (stateAbbr) return { city: commaParts[0], state: stateAbbr, country: 'USA' }
    if (CA_PROVINCES.has(second)) return { city: commaParts[0], state: second, country: 'Canada' }
    return { city: commaParts[0], state: '', country: resolveCountryName(second) || second }
  }

  // Single value
  const asCountry = resolveCountryName(s)
  if (asCountry) return { city: '', state: '', country: asCountry }
  return { city: s, state: '', country: '' }
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolveCountryName (raw) {
  if (!raw) return ''
  const trimmed = raw.trim().replace(/\.$/, '').trim()
  if (COUNTRY_TO_ISO[trimmed]) return trimmed
  const lower = trimmed.toLowerCase()
  for (const [name] of Object.entries(COUNTRY_TO_ISO)) {
    if (name.toLowerCase() === lower) return name
  }
  return ''
}

function parseInner (s) {
  const parenMatch = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) return { city: parenMatch[1].trim(), state: parenMatch[2].trim() }
  const parts = s.split(',').map(p => p.trim())
  if (parts.length >= 2) return { city: parts[0], state: parts[1] }
  return { city: s.trim(), state: '' }
}

// ─── Stats ──────────────────────────────────────────────────────────

let stats = { total: 0, cityLevel: 0, stateLevel: 0, countryLevel: 0, unresolved: 0 }

export function resolveWithStats (city, state, country) {
  buildIndex()
  stats.total++

  let iso = COUNTRY_TO_ISO[country] || country
  let stateNorm = (state || '').trim()
  if (country === 'D.C.' || country === 'DC' || country === 'D.C') { iso = 'US'; stateNorm = 'DC' }
  if (US_STATE_TO_ABBR[stateNorm]) stateNorm = US_STATE_TO_ABBR[stateNorm]

  let cityLower = (city || '').toLowerCase().trim()
  if (CITY_ALIASES[cityLower]) cityLower = CITY_ALIASES[cityLower]

  const result = resolveCoordinates(city, state, country)
  if (!result) { stats.unresolved++; return null }

  // Classify resolution level
  if (cityLower) {
    const k3 = `${cityLower}|${(stateNorm || '').toLowerCase()}|${iso}`
    const k2 = `${cityLower}|${iso}`
    if (byCityStateCountry.has(k3) || byCityCountry.has(k2) || byCityOnly.has(cityLower)) {
      stats.cityLevel++
      return result
    }
  }
  if (stateNorm && byState.has(`${stateNorm.toLowerCase()}|${iso}`)) { stats.stateLevel++; return result }
  stats.countryLevel++
  return result
}

export function printStats (label = 'Geocoder') {
  const pct = (n) => stats.total ? `${((n / stats.total) * 100).toFixed(1)}%` : '0%'
  console.log(`\n[${label}] Resolution stats:`)
  console.log(`  Total:    ${stats.total}`)
  console.log(`  City:     ${stats.cityLevel} (${pct(stats.cityLevel)})`)
  console.log(`  State:    ${stats.stateLevel} (${pct(stats.stateLevel)})`)
  console.log(`  Country:  ${stats.countryLevel} (${pct(stats.countryLevel)})`)
  console.log(`  None:     ${stats.unresolved} (${pct(stats.unresolved)})`)
}

export function resetStats () {
  stats = { total: 0, cityLevel: 0, stateLevel: 0, countryLevel: 0, unresolved: 0 }
}
