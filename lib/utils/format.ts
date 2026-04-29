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
