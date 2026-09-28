import type {
  LoadingDestinationOption,
  LoadingLine,
  LoadingLoad,
  LoadingProductOption,
} from '@/types/loading'

/**
 * Rule-based reader for loading messages — the fallback when the AI provider
 * is down or out of quota, so pasting a message never dead-ends. It handles
 * the common shape ("loading to X 10 beat 2 carton of spare part") and leaves
 * anything it can't place unmatched for the human to fix in review.
 */

const SPELLING: [RegExp, string][] = [
  [/\bcartoons?\b|\bctns?\b/g, 'carton'],
  [/\bspear\b|\bspar\b/g, 'spare'],
  [/\bcristal\b|\bchristal\b|\bcrystals?\b/g, 'crystal'],
  [/\btires?\b|\btyres\b/g, 'tyre'],
  [/\bpcs\b|\bpieces\b/g, 'piece'],
]

function normalise(text: string): string {
  let t = text.toLowerCase()
  for (const [re, to] of SPELLING) t = t.replace(re, to)
  return t
}

const stem = (w: string) => w.replace(/s$/, '')
const tokens = (s: string) => normalise(s).split(/[^a-z0-9]+/).filter(Boolean).map(stem)

/** The product whose full name appears in the text; longest name wins, so "crystal engine" beats "crystal". */
export function matchProduct(text: string, products: LoadingProductOption[]): LoadingProductOption | null {
  const words = new Set(tokens(text))
  let best: LoadingProductOption | null = null
  let bestLen = 0
  for (const p of products) {
    const name = tokens(p.display_name)
    if (name.length && name.every((w) => words.has(w)) && name.length > bestLen) {
      best = p
      bestLen = name.length
    }
  }
  return best
}

/** "Kara/mina" → Kara. A dealer-name match beats a town match. */
export function matchDestination(
  text: string,
  destinations: LoadingDestinationOption[]
): LoadingDestinationOption | null {
  const parts = new Set(tokens(text))
  const byName = destinations.find((d) => tokens(d.name).every((w) => parts.has(w)))
  if (byName) return byName
  if (parts.has('kano') || parts.has('kabiru')) {
    const kano = destinations.find((d) => d.kind === 'warehouse' && d.partner)
    if (kano) return kano
  }
  return destinations.find((d) => d.city && parts.has(stem(d.city.toLowerCase()))) ?? null
}

const ITEM_RE = /(\d+)\s+([a-z][a-z\s/()-]*?)(?=\s*(?:\d|,|;|\+|\band\b|\n|$))/g
const LOAD_RE = /loading\s+(?:to|for)\s+([a-z][a-z\s/.-]*?)(?=\s*(?:\d|:|-|\n|$))/g

export function ruleParseLoading(
  message: string,
  products: LoadingProductOption[],
  destinations: LoadingDestinationOption[]
): { loads: LoadingLoad[]; issues: string[] } {
  const text = normalise(message)
  const issues: string[] = []

  // Each "loading to X" starts a segment that runs to the next one.
  const heads = [...text.matchAll(LOAD_RE)]
  const segments = heads.length
    ? heads.map((h, i) => ({
        dest: h[1].trim(),
        body: text.slice(h.index! + h[0].length, heads[i + 1]?.index ?? text.length),
      }))
    : [{ dest: '', body: text }]

  const loads: LoadingLoad[] = segments.map(({ dest, body }) => {
    const lines: LoadingLine[] = []
    for (const m of body.matchAll(ITEM_RE)) {
      const phrase = m[2].trim()
      const product = matchProduct(phrase, products)
      if (!product) issues.push(`Couldn't match "${m[0].trim()}" to a product.`)
      lines.push({
        product_id: product?.id ?? null,
        quantity: Number(m[1]),
        color: null,
        source_text: m[0].trim(),
      })
    }
    const destination = dest ? matchDestination(dest, destinations) : null
    if (!destination) {
      issues.push(dest ? `Couldn't match destination "${dest}".` : 'No destination found — pick one.')
    }
    return { destination_key: destination?.key ?? null, destination_text: dest, lines }
  })

  return { loads, issues }
}
