#!/usr/bin/env node

/**
 * nuforc-record-merge.mjs
 *
 * Field-level merge rules for two copies of the same NUFORC sighting.
 *
 * __sources/nuforc.json accumulated records from two scrape generations that
 * are ASYMMETRICALLY rich — neither one dominates the other:
 *
 *   Reported        A: "2023-12-20 09:05:20 Pacific"  B: "…09:05:00 Pacific"
 *                   → A wins: real seconds, B truncated them
 *   Occurred        A: "2022-11-16 16:00:00 Local"    B: "…16:00 Local - Approximate Local"
 *                   → B wins: keeps the "Approximate" qualifier. Both parse to
 *                     the same value downstream, so this is free information.
 *   Characteristics A: undefined                      B: []
 *                   → union; a populated list is never overwritten by empty
 *   Summary         A: "…vanished.  Lasted 20 min"    B: "…vanished. Lasted 20 min"
 *                   → B wins: sanitized (sanitize.mjs collapses runs of spaces)
 *
 * A blind keep-new therefore DESTROYS data (it drops A's timestamp precision on
 * ~8,100 records). Every rule here is information-preserving: the merged value
 * is always one of the input values, never a synthesized one, and never a less
 * complete one.
 *
 * Genuine scalar disagreements (two different non-empty shapes, durations,
 * observer counts, locations) cannot be resolved by richness. Those take the
 * newer value and are reported through the `conflicts` collector so they can be
 * audited rather than silently resolved.
 */

/** Fields carried by the huggingface schema, in canonical order. */
export const RECORD_FIELDS = [
  'Sighting', 'Occurred', 'Location', 'Shape', 'Duration',
  'No of observers', 'Reported', 'Posted', 'Characteristics', 'Summary', 'Text'
]

/** A value that carries no information and must always lose a merge. */
function isEmpty (v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** Seconds component of "YYYY-MM-DD HH:MM:SS …", or null when absent. */
function secondsOf (value) {
  const m = typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:(\d{2})/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Timestamps: prefer the copy that kept real seconds.
 * One generation truncated every timestamp to :00, so a non-zero seconds value
 * is strictly more precise than a zero one at the same minute.
 */
function pickTimestamp (a, b) {
  const sa = secondsOf(a)
  const sb = secondsOf(b)
  if (sa !== null && sb !== null) {
    if (sa !== 0 && sb === 0) return { value: a }
    if (sb !== 0 && sa === 0) return { value: b }
  }
  if (sa !== null && sb === null) return { value: a }
  if (sb !== null && sa === null) return { value: b }
  if (a === b) return { value: b }
  return { value: b, conflict: true }
}

/**
 * Longer-is-richer. Used where extra characters mean extra information, e.g.
 * Occurred keeping its "- Approximate Local" qualifier.
 */
function pickLongest (a, b) {
  const la = String(a).length
  const lb = String(b).length
  if (la === lb) return { value: b, conflict: a !== b }
  return { value: la > lb ? a : b }
}

const collapse = s => String(s).replace(/\s+/g, ' ').trim()

/**
 * Free text (Summary / Text).
 *
 * Longer is NOT automatically better here: one generation predates
 * sanitize.mjs, so its only difference is uncollapsed runs of whitespace —
 * which makes the WORSE copy the longer one. So compare on collapsed
 * whitespace first:
 *   - same text modulo whitespace → keep the already-clean copy
 *   - genuinely different text     → keep the longer (more complete) copy
 */
function pickText (a, b) {
  const ca = collapse(a)
  const cb = collapse(b)

  if (ca === cb) {
    const aClean = String(a) === ca
    const bClean = String(b) === cb
    if (aClean !== bClean) return { value: aClean ? a : b }
    return { value: String(a).length <= String(b).length ? a : b }
  }

  // One is a strict extension of the other (e.g. Text gained its headline line).
  if (cb.includes(ca)) return { value: b }
  if (ca.includes(cb)) return { value: a }

  return pickLongest(a, b)
}

/**
 * Observer counts. The schema coerces a missing count to 0 ($int:num_observers),
 * so 0 means "not recorded" rather than "nobody saw it" — it must never
 * overwrite a real count. Two different real counts are a genuine conflict.
 */
function pickCount (a, b) {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return { value: b, conflict: true }
  if (na === 0) return { value: b }
  if (nb === 0) return { value: a }
  if (na === nb) return { value: a }
  return { value: b, conflict: true }
}

/** Arrays: union, first-seen order preserved. Never lose a member. */
function unionArrays (a, b) {
  const out = []
  const seen = new Set()
  for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    const key = typeof item === 'string' ? item : JSON.stringify(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

const FIELD_RULES = {
  Occurred: pickLongest,   // keeps "- Approximate Local" qualifiers
  Reported: pickTimestamp,
  Posted: pickTimestamp,
  Summary: pickText,
  Text: pickText,
  'No of observers': pickCount,
  Characteristics: (a, b) => ({ value: unionArrays(a, b) })
}

/**
 * Merge two copies of the same sighting into one maximally complete record.
 *
 * @param {object} a         - earlier copy (file order)
 * @param {object} b         - later copy
 * @param {Map=}   conflicts - optional collector: field → count of real disagreements
 * @returns {object} merged record
 */
export function mergeRecordPair (a, b, conflicts) {
  const out = {}

  for (const field of RECORD_FIELDS) {
    const va = a[field]
    const vb = b[field]

    // Emptiness dominates every other rule: information never loses to absence.
    if (isEmpty(va) && isEmpty(vb)) {
      if (va !== undefined || vb !== undefined) out[field] = isEmpty(va) && va !== undefined ? va : vb
      continue
    }
    if (isEmpty(va)) { out[field] = vb; continue }
    if (isEmpty(vb)) { out[field] = va; continue }

    if (JSON.stringify(va) === JSON.stringify(vb)) { out[field] = va; continue }

    const rule = FIELD_RULES[field]
    if (rule) {
      const { value, conflict } = rule(va, vb)
      out[field] = value
      if (conflict && conflicts) conflicts.set(field, (conflicts.get(field) || 0) + 1)
      continue
    }

    // Shape / Duration / No of observers / Location: both populated and
    // genuinely different. Newer wins, but it gets recorded for audit.
    out[field] = vb
    if (conflicts) conflicts.set(field, (conflicts.get(field) || 0) + 1)
  }

  // Carry any non-schema fields (e.g. provenance) without dropping them.
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key in out) continue
    out[key] = isEmpty(b[key]) ? a[key] : b[key]
  }

  return out
}
