/**
 * Token-based AND search — every token must appear in at least one field.
 *
 * Usage:
 *   tokenMatch('triangle ireland', s.summary, s.shape, s.country)
 *
 * Splits query into lowercase tokens, checks each token against all fields.
 * All tokens must match (AND logic). Each token can match any field.
 */
export function tokenMatch(query: string, ...fields: (string | undefined | null)[]): boolean {
  if (!query) return true

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  // Pre-lowercase all fields once
  const lowerFields = fields.map(f => (f || '').toLowerCase())

  return tokens.every(token =>
    lowerFields.some(field => field.includes(token))
  )
}
