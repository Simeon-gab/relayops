'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
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
import { toast } from 'sonner'
import { createDealerOrder } from '@/app/actions/dealer-orders'

export interface DealerOption {
  id: string
  business_name: string
  city: string
  state: string
}

export interface ProductOption {
  id: string
  sku_code: string
  display_name: string
  sell_price_naira: number | null
}

interface LineItem {
  product_id: string
  quantity: number
  unit_price_naira: string
}

type FieldErrors = Record<string, string>

interface Props {
  dealers: DealerOption[]
  products: ProductOption[]
  defaultDealerId?: string
}

// ─── Generic searchable combobox ─────────────────────────────────────────────

interface ComboboxOption {
  id: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  disabled?: boolean
  className?: string
}

function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
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
          className={cn('w-full justify-between font-normal', className)}
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
            <CommandEmpty>{emptyText}</CommandEmpty>
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

export function DealerOrderForm({ dealers, products, defaultDealerId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const today = new Date().toISOString().split('T')[0]
  const [dealerId, setDealerId] = useState(defaultDealerId ?? '')
  const [requestedAt, setRequestedAt] = useState(today)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { product_id: '', quantity: 1, unit_price_naira: '' },
  ])

  const dealerOptions: ComboboxOption[] = dealers.map((d) => ({
    id: d.id,
    label: `${d.business_name} — ${d.city}, ${d.state}`,
  }))

  const productOptions: ComboboxOption[] = products.map((p) => ({
    id: p.id,
    label: `${p.sku_code} — ${p.display_name}`,
  }))

  function clearError(key: string) {
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { product_id: '', quantity: 1, unit_price_naira: '' },
    ])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function setItemProduct(index: number, product_id: string) {
    const product = products.find((p) => p.id === product_id)
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              product_id,
              unit_price_naira: item.unit_price_naira === ''
                ? (product?.sell_price_naira != null
                    ? String(product.sell_price_naira)
                    : '')
                : item.unit_price_naira,
            }
          : item
      )
    )
    clearError(`item_${index}_product`)
  }

  function setItemQuantity(index: number, raw: string) {
    const quantity = Math.max(1, parseInt(raw, 10) || 1)
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity } : item))
    )
  }

  function setItemPrice(index: number, raw: string) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, unit_price_naira: raw } : item
      )
    )
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!dealerId) errors.dealer = 'Please select a dealer.'
    if (!requestedAt) errors.requested_at = 'Request date is required.'
    if (items.length === 0) errors.items = 'At least one item is required.'
    items.forEach((item, i) => {
      if (!item.product_id) errors[`item_${i}_product`] = 'Select a product.'
    })
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return

    startTransition(async () => {
      const result = await createDealerOrder({
        dealer_id: dealerId,
        requested_at: requestedAt,
        notes,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price_naira: item.unit_price_naira
            ? parseFloat(item.unit_price_naira) || undefined
            : undefined,
        })),
      })

      if (result.success) {
        const dealer = dealers.find((d) => d.id === dealerId)
        toast.success('Order recorded', {
          description: dealer ? `Order for ${dealer.business_name} created` : 'Order created',
        })
        router.push(`/dealers/${result.dealerId}`)
      } else {
        setServerError(result.error)
      }
    })
  }

  const totalUnits = items.reduce((sum, i) => sum + (i.quantity || 0), 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {serverError && (
        <Alert variant="destructive" className="text-sm">
          {serverError}
        </Alert>
      )}

      {/* Order details */}
      <section className="rounded-xl border bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Order details
        </h2>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Dealer *</Label>
            <Combobox
              options={dealerOptions}
              value={dealerId}
              onChange={(id) => { setDealerId(id); clearError('dealer') }}
              placeholder="Select dealer…"
              searchPlaceholder="Search by name or city…"
              emptyText="No dealers found."
              disabled={isPending}
            />
            {fieldErrors.dealer && (
              <p className="text-xs text-red-600">{fieldErrors.dealer}</p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="requested_at">Request date *</Label>
              <Input
                id="requested_at"
                type="date"
                value={requestedAt}
                onChange={(e) => { setRequestedAt(e.target.value); clearError('requested_at') }}
                disabled={isPending}
              />
              {fieldErrors.requested_at && (
                <p className="text-xs text-red-600">{fieldErrors.requested_at}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this order (e.g. urgent, spoken by phone)…"
              rows={2}
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="rounded-xl border bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Items *
          </h2>
          <span className="text-sm text-slate-500">
            {totalUnits} unit{totalUnits !== 1 ? 's' : ''} total
          </span>
        </div>

        {fieldErrors.items && (
          <p className="mb-3 text-xs text-red-600">{fieldErrors.items}</p>
        )}

        {/* Column headers */}
        <div className="mb-2 hidden grid-cols-[1fr_80px_120px_36px] gap-3 sm:grid">
          <p className="text-xs font-medium text-slate-500">Product</p>
          <p className="text-xs font-medium text-slate-500">Qty</p>
          <p className="text-xs font-medium text-slate-500">Unit price (₦)</p>
          <span />
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_80px_120px_36px] items-start gap-3"
            >
              <div className="space-y-1">
                <Combobox
                  options={productOptions}
                  value={item.product_id}
                  onChange={(id) => setItemProduct(index, id)}
                  placeholder="Select product…"
                  searchPlaceholder="Search by SKU or name…"
                  emptyText="No products found."
                  disabled={isPending}
                />
                {fieldErrors[`item_${index}_product`] && (
                  <p className="text-xs text-red-600">
                    {fieldErrors[`item_${index}_product`]}
                  </p>
                )}
              </div>

              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => setItemQuantity(index, e.target.value)}
                disabled={isPending}
                className="text-center tabular-nums"
              />

              <Input
                type="number"
                min={0}
                step="0.01"
                value={item.unit_price_naira}
                onChange={(e) => setItemPrice(index, e.target.value)}
                disabled={isPending}
                placeholder="Default"
                className="tabular-nums"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                disabled={isPending || items.length === 1}
                className="mt-0.5 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={isPending}
          className="mt-4"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add SKU
        </Button>
      </section>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Recording…' : 'Record order'}
        </Button>
      </div>
    </form>
  )
}
