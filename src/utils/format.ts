/**
 * Format an ISO date string to YYYY-MM-DD.
 */
export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Yield to the main thread so the UI stays responsive.
 */
export function yieldThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
