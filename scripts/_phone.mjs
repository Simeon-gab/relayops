/**
 * Nigerian phone number normalisation, shared by the dealer scripts.
 *
 * Termii will only deliver to numbers in international format without a plus
 * (2348031110002). Numbers reach us in every other shape — local 0-prefixed,
 * +234, spaced, and occasionally simply wrong. A number that fails to normalise
 * must surface loudly: an SMS to a malformed number is accepted by nobody and
 * reported by nothing, so the dealer just never hears from us.
 *
 * Real examples already in the dealers table:
 *   "09023894721"   → 2349023894721   (local, 11 digits — fine)
 *   "081334249522"  → null            (12 digits, one too many — a typo)
 */

/** Nigerian mobile prefixes, minus the leading 0. */
const VALID_PREFIX = /^(70|71|80|81|90|91|21|1)/

/**
 * @returns {{ ok: true, number: string } | { ok: false, reason: string }}
 */
export function normalizeNigerianPhone(raw) {
  if (!raw || !String(raw).trim()) return { ok: false, reason: 'empty' }

  let digits = String(raw).trim().replace(/^\+/, '').replace(/\D/g, '')

  // Already international: 234 + 10 national digits.
  if (digits.startsWith('234')) {
    const national = digits.slice(3)
    if (national.length !== 10) {
      return { ok: false, reason: `${digits.length} digits — expected 13 for a +234 number` }
    }
    if (!VALID_PREFIX.test(national)) {
      return { ok: false, reason: `unknown network prefix "${national.slice(0, 3)}"` }
    }
    return { ok: true, number: digits }
  }

  // Local format: 0 + 10 national digits.
  if (digits.startsWith('0')) {
    const national = digits.slice(1)
    if (national.length !== 10) {
      return { ok: false, reason: `${digits.length} digits — expected 11 for a 0-prefixed number` }
    }
    if (!VALID_PREFIX.test(national)) {
      return { ok: false, reason: `unknown network prefix "${national.slice(0, 3)}"` }
    }
    return { ok: true, number: `234${national}` }
  }

  // Bare national number, no prefix at all.
  if (digits.length === 10 && VALID_PREFIX.test(digits)) {
    return { ok: true, number: `234${digits}` }
  }

  return { ok: false, reason: `cannot read "${raw}" as a Nigerian number` }
}

/** Display form: +234 803 111 0002 */
export function formatNigerianPhone(international) {
  const m = /^234(\d{3})(\d{3})(\d{4})$/.exec(international)
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : international
}
