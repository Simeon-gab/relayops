'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { FileUpload } from '@/components/admin/file-upload'
import { createInboundMessage } from '@/app/actions/messages'

export interface DealerOption {
  id: string
  business_name: string
  city: string
}

const CHANNELS = [
  { value: 'whatsapp', label: 'Pasted from WhatsApp' },
  { value: 'sms', label: 'Pasted from SMS' },
  { value: 'dealer_portal', label: 'From dealer portal' },
] as const

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect (AI will identify)' },
  { value: 'en', label: 'English' },
  { value: 'ha', label: 'Hausa' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
] as const

type FieldErrors = Record<string, string>

// ─── Dealer combobox ─────────────────────────────────────────────────────────

interface ComboboxProps {
  dealers: DealerOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

function DealerCombobox({ dealers, value, onChange, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const options = dealers.map((d) => ({ id: d.id, label: `${d.business_name} — ${d.city}` }))
  const selected = options.find((o) => o.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">{selected?.label ?? 'Select dealer…'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search dealers…" />
          <CommandList>
            <CommandEmpty>No dealer found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === o.id ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface Props {
  dealers: DealerOption[]
  defaultDealerId?: string
}

export function InboundMessageForm({ dealers, defaultDealerId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [dealerId, setDealerId] = useState(defaultDealerId ?? '')
  const [channel, setChannel] = useState<string>('whatsapp')
  const [language, setLanguage] = useState<string>('auto')
  const [originalText, setOriginalText] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})

  function validate(): FieldErrors {
    const e: FieldErrors = {}
    if (!dealerId) e.dealer_id = 'Please select a dealer.'
    if (!originalText.trim() || originalText.trim().length < 5) {
      e.original_text = 'Message must be at least 5 characters.'
    }
    if (!channel) e.channel = 'Please select a channel.'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})

    startTransition(async () => {
      const result = await createInboundMessage({
        dealer_id: dealerId,
        original_text: originalText.trim(),
        channel: channel as 'dealer_portal' | 'whatsapp' | 'sms',
        language: language === 'auto' ? null : language,
        receipt_file: receiptFile,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      if (receiptFile) {
        toast.success('Message and receipt saved', {
          description: 'Receipt will be processed by AI in the next phase.',
        })
      } else {
        toast.success('Message saved')
      }

      router.push(`/messages/${result.messageId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {/* Dealer */}
      <div className="space-y-1.5">
        <Label htmlFor="dealer">Dealer <span className="text-red-500">*</span></Label>
        <DealerCombobox
          dealers={dealers}
          value={dealerId}
          onChange={setDealerId}
          disabled={isPending}
        />
        {errors.dealer_id && <p className="text-xs text-red-600">{errors.dealer_id}</p>}
      </div>

      {/* Channel */}
      <div className="space-y-1.5">
        <Label htmlFor="channel">Channel <span className="text-red-500">*</span></Label>
        <Select value={channel} onValueChange={setChannel} disabled={isPending}>
          <SelectTrigger id="channel">
            <SelectValue placeholder="Select channel…" />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.channel && <p className="text-xs text-red-600">{errors.channel}</p>}
      </div>

      {/* Language */}
      <div className="space-y-1.5">
        <Label htmlFor="language">Language</Label>
        <Select value={language} onValueChange={setLanguage} disabled={isPending}>
          <SelectTrigger id="language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">Leave on auto-detect unless you know the language.</p>
      </div>

      {/* Message text */}
      <div className="space-y-1.5">
        <Label htmlFor="original_text">
          Message text <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="original_text"
          value={originalText}
          onChange={(e) => {
            setOriginalText(e.target.value)
            if (errors.original_text) setErrors((p) => ({ ...p, original_text: '' }))
          }}
          placeholder="Paste the dealer's message here…"
          rows={8}
          className="font-mono text-sm"
          disabled={isPending}
        />
        {errors.original_text && <p className="text-xs text-red-600">{errors.original_text}</p>}
      </div>

      {/* Receipt attachment */}
      <div className="space-y-1.5">
        <Label>Receipt attachment <span className="text-slate-400 font-normal">(optional)</span></Label>
        <FileUpload
          value={receiptFile}
          onChange={setReceiptFile}
          disabled={isPending}
        />
        <p className="text-xs text-slate-500">
          Attach a payment receipt if the dealer sent one with this message.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save message'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
