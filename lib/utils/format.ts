/** Compact format for totals/summaries: ₦2.6M, ₦420K, ₦320 */
export function formatNaira(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000
    const str = parseFloat(m.toFixed(1)).toString()
    return `₦${str}M`
  }
  if (amount >= 1_000) {
    return `₦${Math.round(amount / 1_000)}K`
  }
  return `₦${Math.round(amount)}`
}

/** Full comma-separated format for individual prices: ₦420,000 */
export function formatNairaCurrency(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`
}

/**
 * Short relative time for activity lists: "just now", "3h ago", "12 Jun".
 *
 * Falls back to a date past a fortnight — "23d ago" is arithmetic nobody wants
 * to do, and by then the exact day matters more than the distance.
 */
export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days <= 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}
