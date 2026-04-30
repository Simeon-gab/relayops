import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const ALLOWED_MIME_TYPES: ImageMimeType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function toAllowedMimeType(mimeType: string): ImageMimeType {
  if (ALLOWED_MIME_TYPES.includes(mimeType as ImageMimeType)) return mimeType as ImageMimeType
  return 'image/jpeg'
}

export async function callClaudeText(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const { usage } = response
  console.log(
    `[Claude text] model=claude-sonnet-4-6 input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`
  )

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Claude returned non-text content block')
  return block.text
}

export async function callClaudeWithVision(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: toAllowedMimeType(mimeType),
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
  })

  const { usage } = response
  console.log(
    `[Claude vision] model=claude-sonnet-4-6 input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`
  )

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Claude returned non-text content block')
  return block.text
}
