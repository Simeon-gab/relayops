'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
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
import { toast } from 'sonner'
import { createContainer } from '@/app/actions/containers'
import type { ProductSummary } from '@/types/products'

interface LineItem {
  product_id: string
  quantity: number
}

type FieldErrors = Record<string, string>

interface Props {
  products: ProductSummary[]
}

export function ContainerForm({ products }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState('')
  const [showPreArrival, setShowPreArrival] = useState(false)

  const [fields, setFields] = useState({
    container_number: '',
    arrived_at: new Date().toISOString().split('T')[0],
    notes: '',
    bill_of_lading: '',
    shipping_line: '',
    expected_arrival_date: '',
    origin_port: '',
  })

  const [items, setItems] = useState<LineItem[]>([{ product_id: '', quantity: 1 }])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function setField(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: '', quantity: 1 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function setItemProduct(index: number, product_id: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, product_id } : item))
    )
    setFieldErrors((prev) => ({ ...prev, [`item_${index}_product`]: '' }))
  }

  function setItemQuantity(index: number, raw: string) {
    const quantity = Math.max(1, parseInt(raw, 10) || 1)
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity } : item))
    )
  }

  function validate(): boolean {
    const errors: FieldErrors = {}

    if (!fields.container_number.trim()) {
      errors.container_number = 'Container number is required.'
    }
    if (!fields.arrived_at) {
      errors.arrived_at = 'Arrival date is required.'
    }
    if (items.length === 0) {
      errors.items = 'At least one item is required.'
    }
    items.forEach((item, i) => {
      if (!item.product_id) {
        errors[`item_${i}_product`] = 'Select a product.'
      }
    })

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    startTransition(async () => {
      const result = await createContainer({
        container_number: fields.container_number,
        arrived_at: fields.arrived_at,
        notes: fields.notes,
        bill_of_lading: fields.bill_of_lading,
        shipping_line: fields.shipping_line,
        expected_arrival_date: fields.expected_arrival_date,
        origin_port: fields.origin_port,
        items,
      })

      if (result.success) {
        toast.success('Container recorded', {
          description: `Container ${fields.container_number} added`,
        })
        router.push(`/containers/${result.containerId}`)
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

      {/* Core fields */}
      <section className="rounded-xl border bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Container details
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="container_number">Container number *</Label>
            <Input
              id="container_number"
              value={fields.container_number}
              onChange={(e) => setField('container_number', e.target.value)}
              placeholder="e.g. TGHU8234567"
              className="font-mono"
              disabled={isPending}
            />
            {fieldErrors.container_number && (
              <p className="text-xs text-red-600">{fieldErrors.container_number}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arrived_at">Arrival date *</Label>
            <Input
              id="arrived_at"
              type="date"
              value={fields.arrived_at}
              onChange={(e) => setField('arrived_at', e.target.value)}
              disabled={isPending}
            />
            {fieldErrors.arrived_at && (
              <p className="text-xs text-red-600">{fieldErrors.arrived_at}</p>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={fields.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Any additional notes about this container..."
            rows={3}
            disabled={isPending}
          />
        </div>
      </section>

      {/* Pre-arrival details (collapsible) */}
      <section className="rounded-xl border bg-white">
        <button
          type="button"
          onClick={() => setShowPreArrival((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
          disabled={isPending}
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Shipping details
            <span className="ml-2 font-normal normal-case text-slate-400">
              (optional)
            </span>
          </span>
          {showPreArrival ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showPreArrival && (
          <div className="border-t px-6 pb-6 pt-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bill_of_lading">Bill of lading</Label>
                <Input
                  id="bill_of_lading"
                  value={fields.bill_of_lading}
                  onChange={(e) => setField('bill_of_lading', e.target.value)}
                  placeholder="B/L number"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shipping_line">Shipping line</Label>
                <Input
                  id="shipping_line"
                  value={fields.shipping_line}
                  onChange={(e) => setField('shipping_line', e.target.value)}
                  placeholder="e.g. COSCO, Maersk"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="origin_port">Origin port</Label>
                <Input
                  id="origin_port"
                  value={fields.origin_port}
                  onChange={(e) => setField('origin_port', e.target.value)}
                  placeholder="e.g. Guangzhou, Tianjin"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expected_arrival_date">Expected arrival date</Label>
                <Input
                  id="expected_arrival_date"
                  type="date"
                  value={fields.expected_arrival_date}
                  onChange={(e) => setField('expected_arrival_date', e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Items */}
      <section className="rounded-xl border bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Contents *
          </h2>
          <span className="text-sm text-slate-500">
            {totalUnits} unit{totalUnits !== 1 ? 's' : ''} total
          </span>
        </div>

        {fieldErrors.items && (
          <p className="mb-3 text-xs text-red-600">{fieldErrors.items}</p>
        )}

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-2 sm:gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <Select
                  value={item.product_id}
                  onValueChange={(v) => setItemProduct(index, v)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-xs text-slate-500 mr-2">
                          {p.sku_code}
                        </span>
                        {p.display_name}
                        {p.color ? ` — ${p.color}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors[`item_${index}_product`] && (
                  <p className="text-xs text-red-600">
                    {fieldErrors[`item_${index}_product`]}
                  </p>
                )}
              </div>

              <div className="w-16 shrink-0 sm:w-24">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => setItemQuantity(index, e.target.value)}
                  disabled={isPending}
                  className="text-center tabular-nums"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                disabled={isPending || items.length === 1}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-red-600"
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
          Add product
        </Button>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/containers')}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Recording…' : 'Record container'}
        </Button>
      </div>
    </form>
  )
}
