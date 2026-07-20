import Anthropic from '@anthropic-ai/sdk'

/**
 * AI provider adapter.
 *
 * Every AI feature in RelayOps calls callClaudeText / callClaudeWithVision.
 * Those names are kept for backwards-compatibility, but under the hood the
 * request is routed to whichever provider AI_PROVIDER selects:
 *
 *   AI_PROVIDER=anthropic   (default) — Claude, best quality, paid
 *   AI_PROVIDER=gemini      — Google Gemini, generous free tier, has vision
 *   AI_PROVIDER=groq        — Groq, fast free tier, open models
 *
 * Switching providers is a single env var change — no feature code changes.
 * Model per provider can be overridden with ANTHROPIC_MODEL / GEMINI_MODEL /
 * GROQ_MODEL.
 */

export type AIProvider = 'anthropic' | 'gemini' | 'groq'

export const AI_PROVIDER: AIProvider =
  (process.env.AI_PROVIDER as AIProvider) || 'anthropic'

const MODELS: Record<AIProvider, string> = {
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  gemini: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
}

/** The model label of the active provider — useful for audit/ai_model columns. */
export const AI_MODEL: string = MODELS[AI_PROVIDER]

type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const ALLOWED_MIME_TYPES: ImageMimeType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
function toAllowedMimeType(mimeType: string): ImageMimeType {
  if (ALLOWED_MIME_TYPES.includes(mimeType as ImageMimeType)) return mimeType as ImageMimeType
  return 'image/jpeg'
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — same signatures the rest of the app already calls.
// ─────────────────────────────────────────────────────────────────────────────

export async function callClaudeText(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (AI_PROVIDER) {
    case 'gemini':
      return geminiText(systemPrompt, userPrompt)
    case 'groq':
      return groqText(systemPrompt, userPrompt)
    default:
      return anthropicText(systemPrompt, userPrompt)
  }
}

export async function callClaudeWithVision(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (AI_PROVIDER) {
    case 'gemini':
      return geminiVision(imageBase64, mimeType, systemPrompt, userPrompt)
    case 'groq':
      return groqVision(imageBase64, mimeType, systemPrompt, userPrompt)
    default:
      return anthropicVision(imageBase64, mimeType, systemPrompt, userPrompt)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic (Claude) — original implementation, unchanged behaviour.
// ─────────────────────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set (AI_PROVIDER=anthropic).')
  }
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

async function anthropicText(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await anthropic().messages.create({
    model: MODELS.anthropic,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const { usage } = response
  console.log(
    `[AI anthropic text] model=${MODELS.anthropic} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`
  )
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Claude returned non-text content block')
  return block.text
}

async function anthropicVision(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await anthropic().messages.create({
    model: MODELS.anthropic,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: toAllowedMimeType(mimeType), data: imageBase64 },
          },
          { type: 'text', text: userPrompt },
        ],
      },
    ],
  })
  const { usage } = response
  console.log(
    `[AI anthropic vision] model=${MODELS.anthropic} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`
  )
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Claude returned non-text content block')
  return block.text
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini — REST API, no SDK dependency.
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set (AI_PROVIDER=gemini).')
  return key
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

async function geminiGenerate(systemPrompt: string, userParts: GeminiPart[]): Promise<string> {
  const res = await fetch(
    `${GEMINI_BASE}/${MODELS.gemini}:generateContent?key=${geminiKey()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const candidate = data?.candidates?.[0]
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim()

  if (!text) {
    const reason = candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? 'empty response'
    throw new Error(`Gemini returned no text (${reason}).`)
  }

  const usage = data?.usageMetadata
  console.log(
    `[AI gemini] model=${MODELS.gemini} input_tokens=${usage?.promptTokenCount ?? '?'} output_tokens=${usage?.candidatesTokenCount ?? '?'}`
  )
  return text
}

async function geminiText(systemPrompt: string, userPrompt: string): Promise<string> {
  return geminiGenerate(systemPrompt, [{ text: userPrompt }])
}

async function geminiVision(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return geminiGenerate(systemPrompt, [
    { inline_data: { mime_type: toAllowedMimeType(mimeType), data: imageBase64 } },
    { text: userPrompt },
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Groq — OpenAI-compatible chat completions.
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function groqKey(): string {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is not set (AI_PROVIDER=groq).')
  return key
}

async function groqChat(model: string, messages: unknown[]): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${groqKey()}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.2 }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const text: string = (data?.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error('Groq returned no text.')

  const usage = data?.usage
  console.log(
    `[AI groq] model=${model} input_tokens=${usage?.prompt_tokens ?? '?'} output_tokens=${usage?.completion_tokens ?? '?'}`
  )
  return text
}

async function groqText(systemPrompt: string, userPrompt: string): Promise<string> {
  return groqChat(MODELS.groq, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])
}

async function groqVision(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Groq serves vision through dedicated vision models; the default text model
  // cannot see images. Override with GROQ_VISION_MODEL if the default rotates.
  const visionModel = process.env.GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview'
  const dataUrl = `data:${toAllowedMimeType(mimeType)};base64,${imageBase64}`
  return groqChat(visionModel, [
    {
      role: 'user',
      content: [
        { type: 'text', text: `${systemPrompt}\n\n${userPrompt}` },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ])
}
