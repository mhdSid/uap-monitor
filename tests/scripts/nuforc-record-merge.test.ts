import { describe, it, expect } from 'vitest'
// @ts-expect-error — pipeline scripts are plain ESM, no type declarations
import { mergeRecordPair, RECORD_FIELDS } from '../../scripts/nuforc-record-merge.mjs'

// ─── Fixtures ───────────────────────────────────────────────────────
//
// Field values here are taken from real divergent pairs found in
// __sources/nuforc.json, where two scrape generations disagree.

/** Older live-site scrape: precise timestamps, unsanitized whitespace. */
function genA (overrides: Record<string, unknown> = {}) {
  return {
    Sighting: 179769,
    Occurred: '2022-11-16 16:00:00 Local',
    Location: 'Phoenix, AZ, USA',
    Shape: 'Triangle',
    Duration: '5 minutes',
    'No of observers': 2,
    Reported: '2023-12-20 09:05:20 Pacific',
    Posted: '2023-12-22 00:00:00',
    Characteristics: undefined,
    Summary: 'Objects rose and vanished.  Lasted 20 minutes.',
    Text: 'Three lights in a triangle moving silently.',
    ...overrides
  }
}

/** HuggingFace cache generation: truncated seconds, sanitized, summary-prefixed. */
function genB (overrides: Record<string, unknown> = {}) {
  return {
    Sighting: 179769,
    Occurred: '2022-11-16 16:00 Local - Approximate Local',
    Location: 'Phoenix, AZ, USA',
    Shape: 'Triangle',
    Duration: '5 minutes',
    'No of observers': 2,
    Reported: '2023-12-20 09:05:00 Pacific',
    Posted: '2023-12-22 00:00:00',
    Characteristics: [],
    Summary: 'Objects rose and vanished. Lasted 20 minutes.',
    Text: 'Triangle over Phoenix\nThree lights in a triangle moving silently.',
    ...overrides
  }
}

// ─── Information preservation ───────────────────────────────────────

describe('mergeRecordPair — information preservation', () => {
  it('keeps real seconds instead of the truncated :00 copy', () => {
    expect(mergeRecordPair(genA(), genB()).Reported).toBe('2023-12-20 09:05:20 Pacific')
  })

  it('keeps real seconds regardless of argument order', () => {
    expect(mergeRecordPair(genB(), genA()).Reported).toBe('2023-12-20 09:05:20 Pacific')
  })

  it('keeps the Occurred qualifier rather than the normalized form', () => {
    expect(mergeRecordPair(genA(), genB()).Occurred).toBe('2022-11-16 16:00 Local - Approximate Local')
  })

  it('prefers the sanitized summary even though it is shorter', () => {
    expect(mergeRecordPair(genA(), genB()).Summary).toBe('Objects rose and vanished. Lasted 20 minutes.')
  })

  it('prefers the sanitized summary regardless of argument order', () => {
    expect(mergeRecordPair(genB(), genA()).Summary).toBe('Objects rose and vanished. Lasted 20 minutes.')
  })

  it('keeps the longer Text when one copy strictly extends the other', () => {
    expect(mergeRecordPair(genA(), genB()).Text)
      .toBe('Triangle over Phoenix\nThree lights in a triangle moving silently.')
  })
})

// ─── Emptiness never wins ───────────────────────────────────────────

describe('mergeRecordPair — emptiness never overwrites data', () => {
  it('does not let an empty characteristics array clear a populated one', () => {
    const merged = mergeRecordPair(
      genA({ Characteristics: ['Lights on object', 'Changed Color'] }),
      genB({ Characteristics: [] })
    )
    expect(merged.Characteristics).toEqual(['Lights on object', 'Changed Color'])
  })

  it('unions characteristics from both copies without dropping members', () => {
    const merged = mergeRecordPair(
      genA({ Characteristics: ['Lights on object'] }),
      genB({ Characteristics: ['Changed Color', 'Lights on object'] })
    )
    expect(merged.Characteristics).toEqual(['Lights on object', 'Changed Color'])
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['whitespace', '   ']
  ])('does not let %s Text overwrite real Text', (_label, empty) => {
    expect(mergeRecordPair(genA(), genB({ Text: empty })).Text)
      .toBe('Three lights in a triangle moving silently.')
    expect(mergeRecordPair(genA({ Text: empty }), genB()).Text)
      .toBe('Triangle over Phoenix\nThree lights in a triangle moving silently.')
  })

  it('does not let a zero observer count overwrite a real one', () => {
    expect(mergeRecordPair(genA({ 'No of observers': 0 }), genB())['No of observers']).toBe(2)
    expect(mergeRecordPair(genA(), genB({ 'No of observers': 0 }))['No of observers']).toBe(2)
  })
})

// ─── Conflicts are surfaced, not hidden ─────────────────────────────

describe('mergeRecordPair — genuine conflicts', () => {
  it('records a conflict when two copies disagree on shape', () => {
    const conflicts = new Map<string, number>()
    const merged = mergeRecordPair(genA({ Shape: 'Disk' }), genB({ Shape: 'Triangle' }), conflicts)
    expect(merged.Shape).toBe('Triangle')       // newer wins
    expect(conflicts.get('Shape')).toBe(1)      // but it is reported
  })

  it('does not record a conflict when the copies agree', () => {
    const conflicts = new Map<string, number>()
    mergeRecordPair(genA(), genB(), conflicts)
    expect(conflicts.get('Shape')).toBeUndefined()
    expect(conflicts.get('Duration')).toBeUndefined()
    expect(conflicts.get('Location')).toBeUndefined()
  })

  it('does not treat a whitespace-only summary difference as a conflict', () => {
    const conflicts = new Map<string, number>()
    mergeRecordPair(genA(), genB(), conflicts)
    expect(conflicts.get('Summary')).toBeUndefined()
  })
})

// ─── Structural guarantees ──────────────────────────────────────────

describe('mergeRecordPair — structural guarantees', () => {
  it('never synthesizes a value: every field comes from one of the inputs', () => {
    const a = genA()
    const b = genB()
    const merged = mergeRecordPair(a, b)

    for (const field of RECORD_FIELDS) {
      if (merged[field] === undefined) continue
      const candidates = [JSON.stringify(a[field as keyof typeof a]), JSON.stringify(b[field as keyof typeof b])]
      // Characteristics is a union, so it is allowed to differ from both.
      if (field === 'Characteristics') continue
      expect(candidates).toContain(JSON.stringify(merged[field]))
    }
  })

  it('never drops a field that either input had', () => {
    const merged = mergeRecordPair(genA(), genB())
    for (const field of RECORD_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(merged, field)).toBe(true)
    }
  })

  it('carries through non-schema provenance fields', () => {
    const merged = mergeRecordPair(
      genA({ _source_url: 'https://nuforc.org/sighting/179769' }),
      genB()
    )
    expect(merged._source_url).toBe('https://nuforc.org/sighting/179769')
  })

  it('is idempotent — merging a record with itself changes nothing', () => {
    const a = genA({ Characteristics: ['Lights on object'] })
    expect(mergeRecordPair(a, a)).toEqual(expect.objectContaining({
      Reported: a.Reported,
      Occurred: a.Occurred,
      Summary: a.Summary,
      Text: a.Text,
      Characteristics: ['Lights on object']
    }))
  })

  it('produces the same result no matter the order of a 3-copy fold', () => {
    const a = genA()
    const b = genB()
    const c = genB({ Reported: '2023-12-20 09:05:20 Pacific', Characteristics: ['Landed'] })

    const left = mergeRecordPair(mergeRecordPair(a, b), c)
    const right = mergeRecordPair(a, mergeRecordPair(b, c))

    expect(left.Reported).toBe(right.Reported)
    expect(left.Occurred).toBe(right.Occurred)
    expect(left.Characteristics).toEqual(right.Characteristics)
  })
})
