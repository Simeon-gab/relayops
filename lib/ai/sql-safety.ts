// DO is intentionally absent: it's a statement-level command (PL/pgSQL block)
// and cannot execute if (a) the query starts with SELECT and (b) multiple
// statements are rejected. Keeping it would cause false positives on table
// aliases like `JOIN dealer_orders do ON do.dealer_id = d.id`.
const BANNED_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'GRANT', 'REVOKE', 'COPY', 'CALL', 'EXECUTE',
]

const BANNED_SCHEMAS = ['INFORMATION_SCHEMA.', 'PG_CATALOG.', 'PG_TOAST.', 'AUTH.']

/** Remove single-quoted string literals so their content never trips keyword checks. */
function stripStringLiterals(sql: string): string {
  // '...' with '' as escaped apostrophe inside
  return sql.replace(/'(?:[^']|'')*'/g, "''")
}

export function validateGeneratedSQL(sql: string): { valid: boolean; reason?: string } {
  const trimmed = sql.trim()
  const upper = trimmed.toUpperCase()

  if (!upper.startsWith('SELECT')) {
    return { valid: false, reason: 'Only SELECT queries are allowed.' }
  }

  // Reject multiple statements: anything after a semicolon is a second statement.
  if (/;\s*\S/.test(trimmed)) {
    return { valid: false, reason: 'Multiple statements are not allowed.' }
  }

  // Check banned DML/DDL keywords against the stripped SQL so that state names,
  // product descriptions, or other literal values don't cause false positives.
  const strippedUpper = stripStringLiterals(upper)

  for (const keyword of BANNED_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`).test(strippedUpper)) {
      return { valid: false, reason: `Query contains disallowed keyword: ${keyword}.` }
    }
  }

  if (/\bSET\s+ROLE\b/i.test(trimmed) || /\bRESET\s+ROLE\b/i.test(trimmed)) {
    return { valid: false, reason: 'Query contains disallowed statement.' }
  }

  for (const schema of BANNED_SCHEMAS) {
    if (strippedUpper.includes(schema)) {
      return { valid: false, reason: 'Query references a restricted schema.' }
    }
  }

  if (/\bUSERS\b/.test(strippedUpper)) {
    return { valid: false, reason: 'Query references the restricted users table.' }
  }

  return { valid: true }
}
