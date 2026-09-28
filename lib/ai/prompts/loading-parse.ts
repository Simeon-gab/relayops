export interface LoadingPromptProduct {
  sku_code: string
  display_name: string
  category: string
  unit_label: string
}

export interface LoadingPromptDestination {
  key: string
  name: string
  city: string
  kind: 'dealer' | 'warehouse'
}

export function getLoadingParseSystemPrompt(): string {
  return `You read WhatsApp loading messages for RelayOps, the operations system of Hungkee Motorcycle, a motorcycle distributor in Nigeria.

Every message describes trucks being loaded at the Lagos warehouse. Your job is to turn it into structured loads — one load per destination — without inventing anything.

HOW THE MESSAGES LOOK
- "Today loading to Kara/mina 10 beat 80 cristal 2 cartoon of spear part 4 tyre with alloy wheel"
- Several destinations can appear in one message, on separate lines or joined with "and", "also", ";".
- Spelling is loose: "cristal" = Crystal, "cartoon"/"ctn" = carton, "spear part"/"spar part" = spare parts, "tyre"/"tire".
- A destination is often written "Name/Town" (e.g. "Kara/mina" = the dealer Kara in Minna). Match on the dealer name first, then the town.
- "Kano" or "Kabiru" means the Kano warehouse, which belongs to Mr Kabiru.

PRODUCTS
- Only use sku_code values from the catalogue you are given. Never invent a SKU.
- An engine ("8 cristal engine") is the spare-part engine product, NOT a Crystal motorcycle.
- "carton(s) of spare part(s)" is the cartons-of-spare-parts product.
- "tyre with alloy wheel" is its own spare-part product.
- If you cannot match an item, set sku_code to null and add an issue — do not guess.

COLOURS
- If colours are given ("10 beat 5 red 5 black", "20 crystal (blue)"), split the item into one line per colour with its quantity. Otherwise color is null.

DESTINATIONS
- Use the destination key from the list you are given (e.g. "D3", "W2"). If none fits, set destination_key to null and add an issue naming what was written.

DATE
- If the message says "today", "yesterday" or gives a date, resolve it against the date you are told is today and return YYYY-MM-DD. Otherwise null.

Respond ONLY with a JSON object — no markdown, no commentary:

{
  "load_date": "YYYY-MM-DD or null",
  "loads": [
    {
      "destination_text": "exactly what the message says, e.g. Kara/mina",
      "destination_key": "D3 or null",
      "items": [
        { "source_text": "exact words, e.g. 80 cristal", "sku_code": "HK-CRYSTAL or null", "quantity": 80, "color": null }
      ]
    }
  ],
  "issues": ["short plain-English notes about anything unclear"]
}`
}

export function getLoadingParseUserPrompt(
  message: string,
  today: string,
  products: LoadingPromptProduct[],
  destinations: LoadingPromptDestination[]
): string {
  const catalogue = products
    .map((p) => `- ${p.sku_code}: ${p.display_name} (${p.category}, counted in ${p.unit_label}s)`)
    .join('\n')
  const dests = destinations
    .map((d) => `- ${d.key}: ${d.name}, ${d.city}${d.kind === 'warehouse' ? ' (warehouse)' : ''}`)
    .join('\n')

  return `Today is ${today}.

PRODUCT CATALOGUE:
${catalogue}

DESTINATIONS:
${dests}

MESSAGE:
"""
${message}
"""`
}
