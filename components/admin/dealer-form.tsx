'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createDealer } from '@/app/actions/dealers'
import { NIGERIAN_STATES } from '@/lib/constants/nigerian-states'
import type { DealerForEdit } from '@/types/dealers'
import type { WarehouseSummary } from '@/types/warehouses'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ha', label: 'Hausa' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
] as const

interface Props {
  dealer?: DealerForEdit
  warehouses: WarehouseSummary[]
}

type FieldErrors = Partial<Record<string, string>>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="col-span-2 border-b pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  )
}

export function DealerForm({ dealer, warehouses }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = Boolean(dealer)

  // Field state
  const [fields, setFields] = useState({
    business_name: dealer?.business_name ?? '',
    contact_name: dealer?.contact_name ?? '',
    phone: dealer?.phone ?? '',
    phone_secondary: dealer?.phone_secondary ?? '',
    email: dealer?.email ?? '',
    city: dealer?.city ?? '',
    notes: dealer?.notes ?? '',
    credit_limit_naira: dealer?.credit_limit_naira?.toString() ?? '',
  })

  const [state, setState] = useState(dealer?.state ?? '')
  const [preferred_language, setPreferredLanguage] = useState(dealer?.preferred_language ?? '')
  const [served_by_warehouse_id, setWarehouseId] = useState(dealer?.served_by_warehouse_id ?? '')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
      if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!fields.business_name.trim()) errors.business_name = 'Business name is required'
    if (!fields.contact_name.trim()) errors.contact_name = 'Contact name is required'
    if (!fields.phone.trim()) errors.phone = 'Primary phone is required'
    if (!fields.city.trim()) errors.city = 'City is required'
    if (!state) errors.state = 'State is required'
    if (!preferred_language) errors.preferred_language = 'Language is required'
    if (!served_by_warehouse_id) errors.served_by_warehouse_id = 'Serving warehouse is required'
    return errors
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const credit = fields.credit_limit_naira.trim()
      ? Number(fields.credit_limit_naira)
      : null

    startTransition(async () => {
      const result = await createDealer({
        business_name: fields.business_name,
        contact_name: fields.contact_name,
        phone: fields.phone,
        phone_secondary: fields.phone_secondary,
        email: fields.email,
        city: fields.city,
        state,
        preferred_language,
        served_by_warehouse_id,
        credit_limit_naira: credit,
        notes: fields.notes,
      })

      if (result.success) {
        toast.success('Dealer added', {
          description: `${fields.business_name} has been added`,
        })
        router.push(`/dealers/${result.dealerId}`)
      } else {
        setServerError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">

        {/* ── Business ───────────────────────────── */}
        <SectionHeading>Business</SectionHeading>

        <div>
          <Label htmlFor="business_name">Business name *</Label>
          <Input
            id="business_name"
            value={fields.business_name}
            onChange={set('business_name')}
            className="mt-1.5 w-full"
            placeholder="Adekunle Motors"
            aria-invalid={Boolean(fieldErrors.business_name)}
          />
          <FieldError message={fieldErrors.business_name} />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={fields.notes}
            onChange={set('notes')}
            className="mt-1.5 w-full resize-none"
            rows={3}
            placeholder="Internal notes about this dealer…"
          />
        </div>

        {/* ── Contact ────────────────────────────── */}
        <SectionHeading>Contact</SectionHeading>

        <div>
          <Label htmlFor="contact_name">Contact name *</Label>
          <Input
            id="contact_name"
            value={fields.contact_name}
            onChange={set('contact_name')}
            className="mt-1.5 w-full"
            placeholder="Kunle Adeyemi"
            aria-invalid={Boolean(fieldErrors.contact_name)}
          />
          <FieldError message={fieldErrors.contact_name} />
        </div>

        <div>
          <Label htmlFor="phone">Primary phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={fields.phone}
            onChange={set('phone')}
            className="mt-1.5 w-full"
            placeholder="+2348012345678"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          <FieldError message={fieldErrors.phone} />
        </div>

        <div>
          <Label htmlFor="phone_secondary">Secondary phone</Label>
          <Input
            id="phone_secondary"
            type="tel"
            value={fields.phone_secondary}
            onChange={set('phone_secondary')}
            className="mt-1.5 w-full"
            placeholder="+2348098765432"
          />
        </div>

        {/* ── Location ───────────────────────────── */}
        <SectionHeading>Location</SectionHeading>

        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={fields.city}
            onChange={set('city')}
            className="mt-1.5 w-full"
            placeholder="Onitsha"
            aria-invalid={Boolean(fieldErrors.city)}
          />
          <FieldError message={fieldErrors.city} />
        </div>

        <div>
          <Label htmlFor="state">State *</Label>
          <Select value={state} onValueChange={(v) => { setState(v); setFieldErrors((p) => ({ ...p, state: undefined })) }}>
            <SelectTrigger id="state" className="mt-1.5 w-full" aria-invalid={Boolean(fieldErrors.state)}>
              <SelectValue placeholder="Select state…" />
            </SelectTrigger>
            <SelectContent>
              {NIGERIAN_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors.state} />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={fields.email}
            onChange={set('email')}
            className="mt-1.5 w-full"
            placeholder="dealer@example.com"
          />
        </div>

        {/* ── Operations ─────────────────────────── */}
        <SectionHeading>Operations</SectionHeading>

        <div>
          <Label htmlFor="preferred_language">Preferred language *</Label>
          <Select value={preferred_language} onValueChange={(v) => { setPreferredLanguage(v); setFieldErrors((p) => ({ ...p, preferred_language: undefined })) }}>
            <SelectTrigger id="preferred_language" className="mt-1.5 w-full" aria-invalid={Boolean(fieldErrors.preferred_language)}>
              <SelectValue placeholder="Select language…" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors.preferred_language} />
        </div>

        <div>
          <Label htmlFor="warehouse">Serving warehouse *</Label>
          <Select value={served_by_warehouse_id} onValueChange={(v) => { setWarehouseId(v); setFieldErrors((p) => ({ ...p, served_by_warehouse_id: undefined })) }}>
            <SelectTrigger id="warehouse" className="mt-1.5 w-full" aria-invalid={Boolean(fieldErrors.served_by_warehouse_id)}>
              <SelectValue placeholder="Select warehouse…" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors.served_by_warehouse_id} />
        </div>

        <div>
          <Label htmlFor="credit_limit_naira">Credit limit (₦)</Label>
          <Input
            id="credit_limit_naira"
            type="number"
            min={0}
            step={1000}
            value={fields.credit_limit_naira}
            onChange={set('credit_limit_naira')}
            className="mt-1.5 w-full"
            placeholder="0"
          />
          <p className="mt-1 text-xs text-slate-400">Leave blank for no credit limit</p>
        </div>

      </div>

      {/* Server error */}
      {serverError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex items-center gap-3 border-t pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create dealer'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dealers">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
