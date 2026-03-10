/**
 * Pure formatting utilities — no state, no timers, no side-effects.
 */

/**
 * Format an ISO date string for display.
 *
 * Handles:
 *   - Modern dates  → "2024-03-15"
 *   - Ancient dates  → "70 AD"  (year < 1000)
 *   - Medieval dates → "989 AD" (year 100–999)
 *   - Invalid/empty  → "—"
 *
 * Ancient dates from the Hatch pipeline are stored as "0070-05-21T00:00:00".
 */
export function formatDate (iso: string): string {
  if (!iso) return '—'

  // Extract year directly from ISO prefix "YYYY-..."
  const year = parseInt(iso.slice(0, 4), 10)
  if (isNaN(year)) return iso

  // Ancient/medieval dates (pre-1000): show "YEAR AD"
  if (year > 0 && year < 1000) {
    return `${year} AD`
  }

  // Modern dates: standard YYYY-MM-DD
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Sanitize a location string for display.
 *
 * Handles:
 *   - Empty/null → "—"
 *   - Duplicate parts (location already contains region) → deduplicated
 *   - Consecutive commas/separators → collapsed
 *   - Leading/trailing separators → trimmed
 *   - Multiple spaces → single space
 */
export function formatLocation (...parts: (string | undefined | null)[]): string {
  // Step 1: Remove empty parts and trim
  const trimmed = parts.map(p => (p || '').trim()).filter(Boolean)

  // Step 2: Remove exact duplicates (keep first)
  const unique = [...new Set(trimmed)]

  // Step 3: Remove parts that are substrings of a longer part
  const filtered = unique.filter((part, i) =>
    !unique.some((other, j) =>
      i !== j && other.length > part.length && other.toLowerCase().includes(part.toLowerCase())
    )
  )

  const joined = filtered.join(', ')
  const cleaned = joined
    .replace(/,\s*,/g, ',')         // collapse ", ,"
    .replace(/·\s*·/g, '·')         // collapse "· ·"
    .replace(/\s{2,}/g, ' ')        // collapse multiple spaces
    .replace(/^[,·\s]+/, '')        // strip leading separators
    .replace(/[,·\s]+$/, '')        // strip trailing separators
    .trim()
  return cleaned || '—'
}

/**
 * "Mar 15" for current year, "Mar '24" for other modern years,
 * "70 AD" for ancient.
 */
export function formatDateCompact (iso: string): string {
  if (!iso) return '—'

  const year = parseInt(iso.slice(0, 4), 10)
  if (isNaN(year)) return iso
  if (year > 0 && year < 1000) return `${year} AD`

  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const currentYear = new Date().getFullYear()

  if (d.getFullYear() === currentYear) {
    return `${mon} ${d.getDate()}`
  }
  return `${mon} '${String(d.getFullYear()).slice(-2)}`
}
