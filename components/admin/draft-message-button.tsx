'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, Copy, Check, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { draftDispatchMessage, saveOutboundMessage } from '@/app/actions/messages'
import type { DraftDispatchInput } from '@/app/actions/messages'

interface DraftMessageButtonProps {
  label?: string
  draftInput: DraftDispatchInput
  dealerId: string
  channel?: 'whatsapp' | 'sms' | 'dealer_portal'
  contextType?: string
  contextId?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm'
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
}

export function DraftMessageButton({
  label = 'Draft message',
  draftInput,
  dealerId,
  channel = 'whatsapp',
  contextType,
  contextId,
  variant = 'outline',
  size = 'sm',
}: DraftMessageButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [customInstruction, setCustomInstruction] = useState('')

  const [draft, setDraft] = useState<{
    messageInLanguage: string
    englishTranslation: string
    language: string
    notes: string
  } | null>(null)

  const [editedNative, setEditedNative] = useState('')
  const [editedEnglish, setEditedEnglish] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'sms' | 'dealer_portal'>(channel)

  const isCustom = draftInput.messageType === 'custom'

  function handleOpen() {
    setOpen(true)
    // For non-custom types, auto-generate immediately
    if (!isCustom && !draft) {
      void doGenerate(draftInput.customInstruction ?? null)
    }
  }

  async function doGenerate(instruction: string | null) {
    setDrafting(true)
    try {
      const input: DraftDispatchInput = { ...draftInput, customInstruction: instruction }
      const result = await draftDispatchMessage(input)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setDraft(result)
      setEditedNative(result.messageInLanguage)
      setEditedEnglish(result.englishTranslation)
    } finally {
      setDrafting(false)
    }
  }

  async function handleRegenerate() {
    setDraft(null)
    await doGenerate(isCustom ? customInstruction : draftInput.customInstruction ?? null)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(editedNative)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await saveOutboundMessage({
        dealer_id: dealerId,
        messageInLanguage: editedNative,
        englishTranslation: editedEnglish,
        language: draft?.language ?? draftInput.preferredLanguage,
        channel: selectedChannel,
        context_type: contextType ?? null,
        context_id: contextId ?? null,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Message saved to outbound log')
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (!saving) {
      setOpen(false)
      setDraft(null)
      setEditedNative('')
      setEditedEnglish('')
      setCustomInstruction('')
    }
  }

  const langLabel = LANG_LABELS[draft?.language ?? draftInput.preferredLanguage] ?? draftInput.preferredLanguage.toUpperCase()
  const isEnglish = (draft?.language ?? draftInput.preferredLanguage) === 'en'

  return (
    <>
      <Button variant={variant} size={size} onClick={handleOpen}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">Draft outbound message</h2>
                {draft && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {langLabel}
                  </span>
                )}
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600" disabled={saving}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {/* Custom instruction step */}
              {isCustom && !draft && !drafting && (
                <div className="space-y-4">
                  <div>
                    <p className="mb-3 text-sm text-slate-600">
                      Composing a message to{' '}
                      <span className="font-medium text-slate-900">{draftInput.dealerName}</span>
                      {' '}({draftInput.dealerCity}) in{' '}
                      <span className="font-medium">{LANG_LABELS[draftInput.preferredLanguage] ?? draftInput.preferredLanguage}</span>.
                    </p>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      What should this message say? (your instruction to Claude)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="e.g. Inform dealer that their container was delayed at customs and is expected to arrive next week"
                      className="w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      value={customInstruction}
                      onChange={(e) => setCustomInstruction(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Generating spinner */}
              {drafting && (
                <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Drafting message…</span>
                </div>
              )}

              {/* Draft result */}
              {draft && !drafting && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Message ({langLabel})
                    </label>
                    <textarea
                      rows={5}
                      className="w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      value={editedNative}
                      onChange={(e) => setEditedNative(e.target.value)}
                    />
                  </div>

                  {!isEnglish && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">
                        English translation (reference)
                      </label>
                      <textarea
                        rows={4}
                        className="w-full rounded-lg border bg-blue-50 px-3 py-2.5 text-sm leading-relaxed text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={editedEnglish}
                        onChange={(e) => setEditedEnglish(e.target.value)}
                      />
                    </div>
                  )}

                  {draft.notes && (
                    <p className="text-xs italic text-slate-400">AI note: {draft.notes}</p>
                  )}

                  {/* Channel selector */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Send via</label>
                    <div className="flex gap-2">
                      {(['whatsapp', 'sms', 'dealer_portal'] as const).map((ch) => (
                        <button
                          key={ch}
                          onClick={() => setSelectedChannel(ch)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            selectedChannel === ch
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {ch === 'dealer_portal' ? 'Portal' : ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
              {/* Custom: Generate button before draft exists */}
              {isCustom && !draft && !drafting ? (
                <>
                  <div />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={() => void doGenerate(customInstruction)}
                      disabled={!customInstruction.trim()}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Generate
                    </Button>
                  </div>
                </>
              ) : draft && !drafting ? (
                <>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={saving}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Regenerate
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopy} disabled={saving}>
                      {copied ? (
                        <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving || !editedNative.trim()}>
                      {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      Save to log
                    </Button>
                  </div>
                </>
              ) : (
                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
