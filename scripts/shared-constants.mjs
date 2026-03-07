/**
 * shared-constants.mjs
 *
 * Constants shared between process-nuforc.mjs and process-hatch.mjs.
 * Single source of truth for enums, country mappings, and utility functions.
 *
 * Design rules:
 *   - Only exports values that are IDENTICAL or safely mergeable across both pipelines
 *   - Script-specific logic (parsing, scoring, attribute maps) stays in each script
 *   - Country/coord maps are the UNION of both scripts' needs (modern + historical)
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

// ─── Enums ──────────────────────────────────────────────────────────

export const Continent = {
  AMERICAS: 'AMERICAS',
  EUROPE: 'EUROPE',
  EURASIA: 'EURASIA',
  ASIA_MIDDLE_EAST: 'ASIA_MIDDLE_EAST',
  ASIA_PACIFIC: 'ASIA_PACIFIC',
  OCEANIA: 'OCEANIA',
  AFRICA: 'AFRICA'
}

export const Status = {
  PENDING: 'PENDING'
}

export const Shape = {
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
  TRIANGLE: 'Triangle'
}

export const VALID_SHAPES = new Set(Object.values(Shape))

// ─── Comprehensive country → continent mapping ──────────────────────
// Union of NUFORC (modern countries, territories) and Hatch (historical names).
// If a country is not here, it is logged as unmapped — never silently
// assigned to a wrong continent.

export const COUNTRY_CONTINENT = {
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
  'Türkiye': Continent.EUROPE,
  'Turkiye': Continent.EUROPE,
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
  'Georgia': Continent.EUROPE,
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
  // Historical European names (Hatch)
  'West Germany': Continent.EUROPE,
  'East Germany': Continent.EUROPE,
  'Yugoslavia': Continent.EUROPE,
  'Czechoslovakia': Continent.EUROPE,
  'Prussia': Continent.EUROPE,
  'Sicily': Continent.EUROPE,
  'Corsica': Continent.EUROPE,
  'Sardinia': Continent.EUROPE,
  'Crete': Continent.EUROPE,
  'Bohemia': Continent.EUROPE,

  // ── Eurasia ──
  'Russia': Continent.EURASIA,
  'Russian Federation': Continent.EURASIA,
  'Soviet Union': Continent.EURASIA,
  'USSR': Continent.EURASIA,

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
  'Mongolia': Continent.ASIA_MIDDLE_EAST,
  // Historical names (Hatch)
  'Persia': Continent.ASIA_MIDDLE_EAST,
  'Mesopotamia': Continent.ASIA_MIDDLE_EAST,
  'Ottoman Empire': Continent.ASIA_MIDDLE_EAST,
  'Trans-Jordan': Continent.ASIA_MIDDLE_EAST,
  'Ceylon': Continent.ASIA_MIDDLE_EAST,

  // ── Asia — Pacific (East & Southeast Asia) ──
  'Japan': Continent.ASIA_PACIFIC,
  'China': Continent.ASIA_PACIFIC,
  'South Korea': Continent.ASIA_PACIFIC,
  'North Korea': Continent.ASIA_PACIFIC,
  'Taiwan': Continent.ASIA_PACIFIC,
  'Hong Kong': Continent.ASIA_PACIFIC,
  'Macau': Continent.ASIA_PACIFIC,
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
  // Historical names (Hatch)
  'Korea': Continent.ASIA_PACIFIC,
  'Burma': Continent.ASIA_PACIFIC,
  'Siam': Continent.ASIA_PACIFIC,
  'Formosa': Continent.ASIA_PACIFIC,
  'Indochina': Continent.ASIA_PACIFIC,
  'Manchuria': Continent.ASIA_PACIFIC,

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
  'Hawaii': Continent.OCEANIA,

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
  // Historical names (Hatch)
  'Rhodesia': Continent.AFRICA,
  'Zaire': Continent.AFRICA,
  'Tanganyika': Continent.AFRICA,
  'Abyssinia': Continent.AFRICA,
  'Belgian Congo': Continent.AFRICA,

  // ── Special / ambiguous ──
  'Unknown': Continent.AMERICAS,
  'Unspecified': Continent.AMERICAS,
  'International Waters': Continent.AMERICAS,
  'The Bahamas': Continent.AMERICAS,
  'Northern Mariana Islands': Continent.ASIA_PACIFIC,
  'Great Britain and Ireland': Continent.EUROPE,
  'Scandanavian and Finland': Continent.EUROPE,
  'Scandinavia and Finland': Continent.EUROPE,
  'Belgium, Netherlandsand Luxembourg': Continent.EUROPE,
  'Belgium, Netherlands and Luxembourg': Continent.EUROPE,
  'Republic of South Africa': Continent.AFRICA,
  'Zimbabwe & Zambia': Continent.AFRICA,
  'Former Yugoslavia': Continent.EUROPE,
  'Greece and Island nations': Continent.EUROPE,
  'Estonia, Latvia& Lithuania': Continent.EUROPE,
  'Estonia, Latvia & Lithuania': Continent.EUROPE,
  'Korea(both sides)': Continent.ASIA_PACIFIC,
  'Korea (both sides)': Continent.ASIA_PACIFIC,
  'Caribbean area': Continent.AMERICAS,
  'Pacific Ocean': Continent.OCEANIA,
  'Atlantic Ocean': Continent.AMERICAS,
  'Indian Ocean': Continent.ASIA_MIDDLE_EAST,
  'At Sea': Continent.AMERICAS,
  'Atlantic Ocean': Continent.AMERICAS,
  'North Atlantic': Continent.AMERICAS,
  'North Atlantic Ocean': Continent.AMERICAS,
  'South Atlantic': Continent.AMERICAS,
  'Gulf of Mexico': Continent.AMERICAS,
  'Caribbean Sea': Continent.AMERICAS,
  'Pacific Ocean': Continent.OCEANIA,
  'South Pacific': Continent.OCEANIA,
  'North Sea': Continent.EUROPE,
  'English Channel': Continent.EUROPE,
  'The Channel': Continent.EUROPE,
  'THE CHANNEL': Continent.EUROPE,
  'THE ENGLISH CHANNEL': Continent.EUROPE,
  'Baltic Sea': Continent.EUROPE,
  'Mediterranean': Continent.EUROPE,
  'Mediterranean Sea': Continent.EUROPE,
  'Adriatic Sea': Continent.EUROPE,
  'Sea of Japan': Continent.ASIA_PACIFIC,
  'Japan Sea': Continent.ASIA_PACIFIC,
  'East China Sea': Continent.ASIA_PACIFIC,
  'South China Sea': Continent.ASIA_PACIFIC,
  'Indian Ocean': Continent.ASIA_MIDDLE_EAST,
  'Persian Gulf': Continent.ASIA_MIDDLE_EAST,
  'Arabian Sea': Continent.ASIA_MIDDLE_EAST,
  'Antarctica': Continent.OCEANIA,
  // Continent-level references (no specific country)
  'Africa': Continent.AFRICA,
  'Asia': Continent.ASIA_PACIFIC,
  'Europe': Continent.EUROPE,
  'MEDITERRANEE': Continent.EUROPE,
  'SOUTHERN EUROPE': Continent.EUROPE,
  'South America': Continent.AMERICAS,
  'North America': Continent.AMERICAS,
  'Central America': Continent.AMERICAS
}

// ─── Country name aliases → canonical name in COUNTRY_CONTINENT ─────
// Covers abbreviations, historical names, alternate spellings, and
// common formatting variants found across chronology data.

export const COUNTRY_ALIASES = {
  // Abbreviations
  'CAN': 'Canada',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'Arg': 'Argentina',
  'Den': 'Denmark',
  'Swe': 'Sweden',
  'Nor': 'Norway',
  'Bel': 'Belgium',
  'Swi': 'Switzerland',
  'Ger': 'Germany',
  'Ita': 'Italy',
  'Spa': 'Spain',
  'Por': 'Portugal',
  'Jap': 'Japan',
  'PR': 'Puerto Rico',
  'CN': 'China',
  'S. AU': 'Australia',

  // Common misspellings in chronology data
  'Columbia': 'Colombia',
  'Uraguay': 'Uruguay',
  'Venezula': 'Venezuela',
  'Phillipine Islands': 'Philippines',
  'Philippine Islands': 'Philippines',
  'Phillipines': 'Philippines',
  'Rumania': 'Romania',
  'Jugoslavia': 'Yugoslavia',
  'Brasil': 'Brazil',
  'MX': 'Mexico',
  'Yugo': 'Yugoslavia',
  'Solomon Isl': 'Solomon Islands',
  'Fiji Islands': 'Fiji',
  'Annam': 'Vietnam',
  'Russian Siberia': 'Russia',

  // UK variants
  'Great Britain': 'UK',
  'GREAT BRITAIN': 'UK',
  'Britain': 'UK',
  'British Isles': 'UK',
  'British': 'UK',

  // Alternate country names
  'Holland': 'Netherlands',
  'Greenland': 'Denmark',
  'New Guinea': 'Papua New Guinea',
  'Canary Islands': 'Spain',
  'Azores': 'Portugal',
  'Madeira': 'Portugal',
  'Fr. Morocco': 'Morocco',
  'French Morocco': 'Morocco',
  'S. Africa': 'South Africa',
  'Rhodesia': 'Zimbabwe',
  'Palestine': 'Israel',
  'Tibet': 'China',
  'Borneo': 'Malaysia',
  'Sumatra': 'Indonesia',
  'Java': 'Indonesia',
  'W. Germany': 'Germany',
  'E. Germany': 'Germany',
  'Eire': 'Ireland',
  'Tangier': 'Morocco',
  'Tripolitania': 'Libya',
  'Malaya': 'Malaysia',
  'Swaziland': 'Eswatini',
  'Cape Colony': 'South Africa',
  'Union of South Africa': 'South Africa',
  'Southern Rhodesia': 'Zimbabwe',
  'Northern Rhodesia': 'Zambia',
  'Gold Coast': 'Ghana',
  'Nyasaland': 'Malawi',
  'Bechuanaland': 'Botswana',
  'W. Japan': 'Japan',
  'E. Japan': 'Japan',
  'N. Japan': 'Japan',
  'S. Japan': 'Japan',

  // Overmeire uppercase countries
  'FRANCE': 'France',
  'ITALY': 'Italy',
  'SPAIN': 'Spain',
  'GERMANY': 'Germany',
  'BELGIUM': 'Belgium',
  'BRAZIL': 'Brazil',
  'CANADA': 'Canada',
  'AUSTRALIA': 'Australia',
  'JAPAN': 'Japan',
  'CHINA': 'China',
  'RUSSIA': 'Russia',
  'INDIA': 'India',
  'MEXICO': 'Mexico',
  'ARGENTINA': 'Argentina',
  'SWEDEN': 'Sweden',
  'NORWAY': 'Norway',
  'DENMARK': 'Denmark',
  'PORTUGAL': 'Portugal',
  'GREECE': 'Greece',
  'TURKEY': 'Turkey',
  'TÜRKIYE': 'Turkey',
  'TURKIYE': 'Turkey',
  'EGYPT': 'Egypt',
  'IRAN': 'Iran',
  'IRAQ': 'Iraq',
  'MOROCCO': 'Morocco',
  'ALGERIA': 'Algeria',
  'NETHERLANDS': 'Netherlands',
  'SWITZERLAND': 'Switzerland',
  'AUSTRIA': 'Austria',
  'POLAND': 'Poland',
  'HUNGARY': 'Hungary',
  'ROMANIA': 'Romania',
  'CHILE': 'Chile',
  'PERU': 'Peru',
  'COLOMBIA': 'Colombia',
  'VENEZUELA': 'Venezuela',
  'FINLAND': 'Finland',
  'ICELAND': 'Iceland',
  'IRELAND': 'Ireland',
  'ENGLAND': 'England',
  'SCOTLAND': 'Scotland',
  'WALES': 'Wales',
  'USA': 'USA',
  'MARTINIQUE': 'Martinique',
  'SICILY': 'Sicily',
  'CORSICA': 'Corsica',
  'CZECHOSLOVAKIA': 'Czechoslovakia',

  // Known standalone locations → country
  'UK House of Commons': 'UK',
  'London': 'UK',
  'Moscow': 'Russia',
  'Paris': 'France',
  'Jerusalem': 'Israel',
  'Rome': 'Italy',
  'Rome Antique': 'Italy',
  'ROME ANTIQUE': 'Italy',
  'IN SPACE': 'Unknown',
  'In Space': 'Unknown',
  'in flight': 'Unknown',
  'In Flight': 'Unknown',
  'In Air': 'Unknown',
  'in air': 'Unknown',
  'in air space': 'Unknown',
  'various': 'Unknown',
  'Various': 'Unknown',
  'Washington State': 'USA',
  'New England': 'USA',
  'at sea': 'At Sea',
  'At sea': 'At Sea',
  'AT SEA': 'At Sea',
  'French Indo China': 'Vietnam',
  'French Indochina': 'Vietnam',
  'Baikonur Cosmodrome': 'Kazakhstan',
  'Far East': 'Unknown',

  // French country names (Overmeire data)
  'GRANDE BRETAGNE': 'UK',
  'Grande Bretagne': 'UK',
  'CHINE': 'China',
  'BYZANCE': 'Turkey',
  'Byzance': 'Turkey',

  // Known cities → country
  'Bucharest': 'Romania',
  'Constantinople': 'Turkey',
  'Arabia': 'Saudi Arabia',
  'Trans-Rhenan Germany': 'Germany',
  'Straits of Magellan': 'Chile',
  'Villefranche-du-Rouergue': 'France',
  "St. James's Park": 'UK',
  'Standlake Broad': 'UK',
  'GREAT BRITAIN AND IRELAND': 'UK',
  'SCANDANAVIAN AND FINLAND': 'Sweden',
  'SCANDINAVIA AND FINLAND': 'Sweden',
  'BELGIUM, NETHERLANDSAND LUXEMBOURG': 'Belgium',
  'REPUBLIC OF SOUTH AFRICA': 'South Africa',
  'ZIMBABWE & ZAMBIA': 'Zimbabwe',
  'FORMER YUGOSLAVIA': 'Serbia',
  'GREECE AND ISLAND NATIONS': 'Greece',
  'KOREA(BOTH SIDES)': 'South Korea',
  'KOREA (BOTH SIDES)': 'South Korea',
  'ESTONIA, LATVIA& LITHUANIA': 'Estonia',
  'CARIBBEAN AREA': 'Cuba',
  'THE BAHAMAS': 'Bahamas',
  'NORTHERN MARIANA ISLANDS': 'Northern Mariana Islands'
}

// ─── Region/province/territory → country ────────────────────────────
// Maps sub-national regions to their parent country. Used when the
// last part of a location string is a province name, not a country.

export const REGION_TO_COUNTRY = {
  // Canadian provinces & territories
  'Ontario': 'Canada',
  'Quebec': 'Canada',
  'British Columbia': 'Canada',
  'Alberta': 'Canada',
  'Manitoba': 'Canada',
  'Saskatchewan': 'Canada',
  'Nova Scotia': 'Canada',
  'New Brunswick': 'Canada',
  'Newfoundland': 'Canada',
  'Labrador': 'Canada',
  'Prince Edward Island': 'Canada',
  'Northwest Territories': 'Canada',
  'Yukon': 'Canada',
  'Yukon Territory': 'Canada',
  'Nunavut': 'Canada',

  // Australian states & territories
  'Tasmania': 'Australia',
  'New South Wales': 'Australia',
  'South Australia': 'Australia',
  'Western Australia': 'Australia',
  'Queensland': 'Australia',
  'Victoria': 'Australia',
  'Northern Territory': 'Australia',
  'Australian Capital Territory': 'Australia',

  // Japanese territories
  'Okinawa': 'Japan',
  'Hokkaido': 'Japan',
  'Iwo Jima': 'Japan',
  'Bonin Islands': 'Japan',
  'Western Japan': 'Japan',
  'South Japan': 'Japan',
  'West Japan': 'Japan',
  'Swiss Alps': 'Switzerland',
  'Wake Island': 'USA',

  // UK regions
  'London': 'UK',
  'Channel Islands': 'UK',
  'Lancashire': 'UK',
  'Yorkshire': 'UK',
  'North Wales': 'UK',
  'South Wales': 'UK',
  'Devonshire': 'UK',
  'Devon': 'UK',
  'Cornwall': 'UK',
  'Suffolk': 'UK',
  'Norfolk': 'UK',
  'Essex': 'UK',
  'Kent': 'UK',
  'Sussex': 'UK',
  'Warwickshire': 'UK',
  'Wiltshire': 'UK',
  'Dorset': 'UK',
  'Somerset': 'UK',
  'Hampshire': 'UK',
  'Staffordshire': 'UK',
  'Cheshire': 'UK',

  // Historical territories
  'East Prussia': 'Germany',
  'West Prussia': 'Germany',
  'Silesia': 'Germany',

  // US special
  'D.C.': 'USA',
  'D.C': 'USA',
  'DC': 'USA',
  // US state abbreviations with periods (Overmeire: "N.M.", "N.J.")
  'N.M': 'USA',
  'N.J': 'USA',
  'N.Y': 'USA',
  'N.C': 'USA',
  'N.D': 'USA',
  'S.C': 'USA',
  'S.D': 'USA',
  'W.V': 'USA',
  'R.I': 'USA'
}

// ─── Known US locations (cities, AFBs, institutions, landmarks) ─────
// Single-part location strings that should resolve to USA.

export const US_LOCATIONS = new Set([
  'Pentagon', 'White House', 'NASA', 'Area 51', 'Roswell',
  'Wright-Patterson AFB', 'Wright Field', 'Holloman AFB',
  'Kirtland AFB', 'Edwards AFB', 'Ent AFB',
  'Langley AFB', 'Nellis AFB', 'Eglin AFB',
  'Fort Meade', 'Fort Bragg', 'Camp Hood',
  'Los Alamos', 'Sandia', 'Vandenberg',
  'New York City', 'Chicago', 'Los Angeles', 'San Francisco',
  'Washington', 'Roswell Army Air Field',
  'Harvard University', 'University of Colorado', 'University of New Mexico',
  'Brookhaven National Laboratory', 'MIT',
  'Nevada Test Site', 'Area 51 in Nevada',
  'Wright-Patterson AFB in Ohio'
])

// ─── Utility functions ──────────────────────────────────────────────

export function truncate(text, maxLen) {
  if (!text) return ''
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
}

// ─── News fetch shared constants ────────────────────────────────────

/** Default search query shared across GDELT and GNews fetch scripts. */
export const DEFAULT_NEWS_QUERY = 'UAP OR UFO OR "unidentified aerial" OR "flying saucer" OR AARO OR "alien craft"'

/** Deterministic short ID from a URL string. */
export function urlToId(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 12)
}

/**
 * Load existing articles from a JSON file, merge with new articles,
 * deduplicate by URL, sort newest first, and trim to max.
 *
 * @param {string} filePath  - Path to existing JSON file
 * @param {object[]} newArticles - Freshly fetched articles
 * @param {string} arrayField - Name of the articles array in the JSON ('articles', 'fireballs', etc.)
 * @param {string} urlField - Field name to deduplicate on (default: 'url')
 * @param {string} dateField - Field name to sort by (default: 'publishedAt')
 * @param {number} max - Max articles to keep after merge
 * @returns {{ merged: object[], existing: number, added: number }}
 */
export function mergeArticles(filePath, newArticles, {
  arrayField = 'articles',
  urlField = 'url',
  dateField = 'publishedAt',
  max = Infinity
} = {}) {
  let existing = []

  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
      existing = raw[arrayField] || []
      console.log(`Existing file: ${existing.length} ${arrayField}`)
    } catch {
      console.log('Existing file unreadable, starting fresh')
    }
  } else {
    console.log('No existing file, starting fresh')
  }

  const seen = new Set()
  const merged = []

  // New articles take priority (fresher data)
  for (const a of newArticles) {
    const key = a[urlField] || a.id
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(a)
    }
  }

  // Then append existing that aren't dupes
  let kept = 0
  for (const a of existing) {
    const key = a[urlField] || a.id
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(a)
      kept++
    }
  }

  const sorted = merged
    .sort((a, b) => (b[dateField] || '').localeCompare(a[dateField] || ''))
    .slice(0, max)

  const added = merged.length - existing.length
  console.log(`Merge: ${existing.length} existing + ${newArticles.length} fetched -> ${merged.length} deduped -> ${sorted.length} after trim (${Math.max(0, added)} net new)`)

  return { merged: sorted, existing: existing.length, added: Math.max(0, added) }
}
