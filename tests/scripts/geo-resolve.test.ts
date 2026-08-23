import { describe, it, expect } from 'vitest'
// @ts-expect-error — pipeline scripts are plain ESM, no type declarations
import { resolveCountry, splitLocation, normalizeToken, Region } from '../../scripts/geo-resolve.mjs'

// ─── The bug this module exists to prevent ──────────────────────────

describe('resolveCountry — never assumes a region', () => {
  it.each([
    ['Netherlands The', Region.EUROPE],
    ['Croatia (Hrvatska)', Region.EUROPE],
    ['Myanmar (Burma)', Region.ASIA_PACIFIC],
    ['Korea South', Region.ASIA_PACIFIC],
    ['Greenland', Region.EUROPE],
    ['Nederland', Region.EUROPE],
    ['Regatul Unit', Region.EUROPE],
    ['Kyrgyzistan', Region.ASIA_MIDDLE_EAST]
  ])('does not file %s under the Americas', (token, expected) => {
    const result = resolveCountry(token)
    expect(result).not.toBeNull()
    expect(result.region).toBe(expected)
    expect(result.region).not.toBe(Region.AMERICAS)
  })

  it('returns null rather than guessing when a token is unresolvable', () => {
    for (const junk of ['Yup', '2 miles f', 'northerly flight', 'suburbs']) {
      expect(resolveCountry(junk)).toBeNull()
    }
  })

  it('marks genuinely absent locations as absent, not as a region', () => {
    for (const token of ['', 'Unknown', 'Unspecified', 'none']) {
      const result = resolveCountry(token)
      expect(result.region).toBeNull()
      expect(result.via).toBe('absent')
    }
  })
})

// ─── ISO2 / US-state collision guard ────────────────────────────────

describe('resolveCountry — subdivision codes never become countries', () => {
  it.each([
    ['IL', 'Israel'],
    ['IN', 'India'],
    ['MO', 'Macau'],
    ['DE', 'Germany'],
    ['LA', 'Laos'],
    ['PA', 'Panama'],
    ['NE', 'Niger'],
    ['SC', 'Seychelles']
  ])('resolves US state code %s to the United States, not %s', (code) => {
    const result = resolveCountry(code)
    expect(result.iso2).toBe('US')
    expect(result.region).toBe(Region.AMERICAS)
  })

  it.each(['ON', 'BC', 'NS', 'AB', 'QC', 'NT'])('resolves Canadian province %s to Canada', (code) => {
    const result = resolveCountry(code)
    expect(result.iso2).toBe('CA')
  })
})

// ─── First-class non-terrestrial regions ────────────────────────────

describe('resolveCountry — MARITIME and SPACE', () => {
  it.each(['In orbit', 'International Space Station', 'Moon', 'In orbit in space'])(
    'classifies %s as SPACE with no country', (token) => {
      const result = resolveCountry(token)
      expect(result.region).toBe(Region.SPACE)
      expect(result.iso2).toBeNull()
    })

  it.each([
    'Philippine Sea',
    'Mediterranean sea.',
    'Above the pacific ocean',
    'Indian Ocean 500 miles from nearest land'
  ])('classifies %s as MARITIME with no country', (token) => {
    const result = resolveCountry(token)
    expect(result.region).toBe(Region.MARITIME)
    expect(result.iso2).toBeNull()
  })
})

// ─── Tier ordering ──────────────────────────────────────────────────

describe('resolveCountry — tier ordering and provenance', () => {
  it('prefers the explicit table over the population-ranked city index', () => {
    // "Tenerife" matches a Colombian town before the Spanish island by
    // population, so the explicit subdivision entry must win.
    const result = resolveCountry('Tenerife')
    expect(result.iso2).toBe('ES')
    expect(result.via).not.toBe('city')
  })

  it('records which tier produced each result', () => {
    expect(resolveCountry('Nederland').via).toBe('alias')
    expect(resolveCountry('Queensland').via).toBe('subdivision')
    expect(resolveCountry('In orbit').via).toBe('space')
  })

  it('reads a country out of a parenthetical', () => {
    const result = resolveCountry('Kaunitz (Germany)')
    expect(result.iso2).toBe('DE')
    expect(result.via).toBe('parenthetical')
  })

  it('takes the first resolvable country from a multi-country token', () => {
    const result = resolveCountry('Germany/France')
    expect(result.iso2).toBe('DE')
    expect(result.via).toBe('multi')
    expect(result.alternatives).toBe(2)
  })

  it('finds a country beside free text', () => {
    expect(resolveCountry('New Zealand -Taranaki').iso2).toBe('NZ')
    expect(resolveCountry('Israel - near Petach Tikva').iso2).toBe('IL')
  })

  it('can be run with the weakest tier disabled', () => {
    expect(resolveCountry('Grenoble', { allowCity: false })).toBeNull()
    expect(resolveCountry('Grenoble').iso2).toBe('FR')
  })
})

// ─── Location splitting ─────────────────────────────────────────────

describe('splitLocation', () => {
  it('does not split on a comma inside parentheses', () => {
    expect(splitLocation('Yucatan (Light House, north), MX'))
      .toEqual(['Yucatan (Light House, north)', 'MX'])
  })

  it('splits normal three-part locations unchanged', () => {
    expect(splitLocation('Phoenix, AZ, USA')).toEqual(['Phoenix', 'AZ', 'USA'])
  })

  it('drops empty segments from doubled commas', () => {
    expect(splitLocation('Springfield, , IL')).toEqual(['Springfield', 'IL'])
  })

  it('tolerates an unclosed parenthesis without losing the rest', () => {
    expect(splitLocation('Somewhere (near PA border, PA, USA').length).toBeGreaterThan(0)
  })
})

// ─── Normalization ──────────────────────────────────────────────────

describe('normalizeToken', () => {
  it.each([
    ['Croatia (Hrvatska)', 'croatia hrvatska'],
    ['Šiauliai', 'siauliai'],
    ['Łódź', 'lodz'],
    ['ITALY', 'italy'],
    ['South-Africa', 'south africa'],
    ['Straße', 'strasse']
  ])('normalizes %s', (input, expected) => {
    expect(normalizeToken(input)).toBe(expected)
  })

  it('handles null and undefined without throwing', () => {
    expect(normalizeToken(null)).toBe('')
    expect(normalizeToken(undefined)).toBe('')
  })
})
