'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatNairaCurrency } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
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
import { createPayment } from '@/app/actions/payments'
import type { OutstandingShipment } from '@/types/payments'

export interface DealerOption {
  id: string
  business_name: string
  city: string
  state: string
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
] as const

type FieldErrors = Record<string, string>

// ─── Dealer combobox ─────────────────────────────────────────────────────────

interface ComboboxProps {
  options: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
  placeholder: string
  searchPlaceholder: string
  disabled?: boolean
}

function DealerCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No dealers found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === option.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
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
  outstandingShipmentsByDealer: Record<string, OutstandingShipment[]>
}

function shortId(id: string): string {
  return id.slice(-8)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function PaymentForm({ dealers, defaultDealerId, outstandingShipmentsByDealer }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const today = new Date().toISOString().split('T')[0]
  const [dealerId, setDealerId] = useState(defaultDealerId ?? '')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [paymentReference, setPaymentReference] = useState('')
  const [shipmentId, setShipmentId] = useState('none')
  const [notes, setNotes] = useState('')

  const dealerOptions = dealers.map((d) => ({
    id: d.id,
    label: `${d.business_name} — ${d.city}, ${d.state}`,
  }))

  const outstandingShipments = dealerId ? (outstandingShipmentsByDealer[dealerId] ?? []) : []

  function clearError(key: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function handleDealerChange(id: string) {
    setDealerId(id)
    setShipmentId('none')
    clearError('dealer')
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!dealerId) errors.dealer = 'Please select a dealer.'
    if (!amount || Number(amount) <= 0) errors.amount = 'Amount must be greater than zero.'
    if (!paymentDate) errors.paymentDate = 'Payment date is required.'
    if (!paymentMethod) errors.paymentMethod = 'Payment method is required.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return

    startTransition(async () => {
      const result = await createPayment({
        dealer_id: dealerId,
        amount_naira: Number(amount),
        payment_date: paymentDate,
        payment_method: paymentMethod as 'bank_transfer' | 'cash' | 'pos',
        payment_reference: paymentReference.trim() || undefined,
        shipment_id: shipmentId !== 'none' ? shipmentId : undefined,
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        toast.success('Payment recorded')
        router.push(`/payments/${result.paymentId}`)
      } else {
        setServerError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {serverError && (
        <Alert variant="destructive" className="text-sm">{serverError}</Alert>
      )}

      <section className="rounded-xl border bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Payment details
        </h2>

        <div className="space-y-5">
          {/* Dealer */}
          <div className="space-y-1.5">
            <Label>Dealer *</Label>
            <DealerCombobox
              options={dealerOptions}
              value={dealerId}
              onChange={handleDealerChange}
              placeholder="Select dealer…"
              searchPlaceholder="Search by name or city…"
              disabled={isPending}
            />
            {fieldErrors.dealer && (
              <p className="text-xs text-red-600">{fieldErrors.dealer}</p>
            )}
          </div>

          {/* Amount + date */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₦) *</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step="1"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); clearError('amount') }}
                placeholder="e.g. 500000"
                className="tabular-nums"
                disabled={isPending}
              />
              {fieldErrors.amount && (
                <p className="text-xs text-red-600">{fieldErrors.amount}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment_date">Payment date *</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => { setPaymentDate(e.target.value); clearError('paymentDate') }}
                disabled={isPending}
              />
              {fieldErrors.paymentDate && (
                <p className="text-xs text-red-600">{fieldErrors.paymentDate}</p>
              )}
            </div>
          </div>

          {/* Method + reference */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment_method">Payment method *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => { setPaymentMethod(v); clearError('paymentMethod') }}
                disabled={isPending}
              >
                <SelectTrigger id="payment_method">
                  <SelectValue placeholder="Select method…" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.paymentMethod && (
                <p className="text-xs text-red-600">{fieldErrors.paymentMethod}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment_reference">Reference / Transaction ID</Label>
              <Input
                id="payment_reference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. TXN123456"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Linked shipment */}
          <div className="space-y-1.5">
            <Label htmlFor="shipment">Linked shipment</Label>
            <Select
              value={shipmentId}
              onValueChange={setShipmentId}
              disabled={isPending || !dealerId}
            >
              <SelectTrigger id="shipment">
                <SelectValue placeholder={dealerId ? 'No specific shipment' : 'Select a dealer first'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific shipment</SelectItem>
                {outstandingShipments.map((s) => {
                  const outstanding = s.total_amount_naira - s.amount_paid_naira
                  const label = [
                    `…${shortId(s.id)}`,
                    s.dispatched_at ? `Dispatched ${formatDate(s.dispatched_at)}` : null,
                    `Outstanding ${formatNairaCurrency(outstanding)}`,
                  ].filter(Boolean).join(' · ')
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {dealerId && outstandingShipments.length === 0 && (
              <p className="text-xs text-slate-400">No outstanding shipments for this dealer.</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this payment…"
              rows={2}
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Recording…' : 'Record payment'}
        </Button>
      </div>
    </form>
  )
}
