'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Plus, Sparkles, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { confirmLoading, parseLoadingMessage } from '@/app/actions/loading'
import { formatQty } from '@/lib/utils/format'
import type { LoadingDraft, LoadingLine, LoadingLoad, LoadingOptions } from '@/types/loading'

const EXAMPLE = 'Today loading to Kara/mina 10 beat 80 cristal 2 cartoon of spear part 4 tyre with alloy wheel'

const emptyLine = (): LoadingLine => ({ product_id: null, quantity: 1, color: null, source_text: '' })

export function LoadingMessageForm({ options }: { options: LoadingOptions }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState<LoadingDraft | null>(null)
  const [error, setError] = useState('')
  const [isParsing, startParse] = useTransition()
  const [isSaving, startSave] = useTransition()

  const products = useMemo(() => new Map(options.products.map((p) => [p.id, p])), [options.products])
  const warehouses = options.destinations.filter((d) => d.kind === 'warehouse')
  const dealers = options.destinations.filter((d) => d.kind === 'dealer')

  // What the whole message takes out of Lagos, product by product.
  const totals = useMemo(() => {
    const m = new Map<string, number>()
    for (const load of draft?.loads ?? []) {
      for (const l of load.lines) if (l.product_id) m.set(l.product_id, (m.get(l.product_id) ?? 0) + (l.quantity || 0))
    }
    return [...m.entries()].map(([id, qty]) => ({ product: products.get(id)!, qty }))
  }, [draft, products])

  const shortages = totals.filter((t) => t.qty > t.product.lagos_stock)
  const incomplete =
    !draft?.loads.length ||
    draft.loads.some((l) => !l.destination_key || !l.lines.length || l.lines.some((x) => !x.product_id || x.quantity < 1))

  function parse() {
    setError('')
    startParse(async () => {
      const res = await parseLoadingMessage(message)
      if (!res.success) { setError(res.error); return }
      setDraft(res.draft)
    })
  }

  function updateLoad(i: number, patch: Partial<LoadingLoad>) {
    setDraft((d) => d && { ...d, loads: d.loads.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  }

  function updateLine(i: number, k: number, patch: Partial<LoadingLine>) {
    setDraft((d) => d && {
      ...d,
      loads: d.loads.map((l, j) =>
        j === i ? { ...l, lines: l.lines.map((x, n) => (n === k ? { ...x, ...patch } : x)) } : l
      ),
    })
  }

  function confirm() {
    if (!draft) return
    setError('')
    startSave(async () => {
      const res = await confirmLoading({
        raw_message: message,
        load_date: draft.load_date,
        parsed_by: draft.parsed_by,
        loads: draft.loads.map((l) => ({
          destination_key: l.destination_key!,
          lines: l.lines.map((x) => ({ product_id: x.product_id!, quantity: x.quantity, color: x.color })),
        })),
      })
      if (!res.success) { setError(res.error); return }
      toast.success(`${res.shipmentIds.length} load${res.shipmentIds.length === 1 ? '' : 's'} dispatched`)
      router.push('/shipments')
    })
  }

  // ── Step 1: paste ─────────────────────────────────────────────────────────
  if (!draft) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="loading-message">WhatsApp message</Label>
          <Textarea
            id="loading-message"
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={EXAMPLE}
            disabled={isParsing}
          />
          <p className="text-xs text-slate-400">
            Paste it exactly as sent — spelling like &ldquo;cristal&rdquo; or &ldquo;cartoon&rdquo; is fine. Several destinations in one message work too.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={parse} disabled={isParsing || !message.trim()}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          {isParsing ? 'Arranging…' : 'Arrange'}
        </Button>
      </div>
    )
  }

  // ── Step 2: review ────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Original message</p>
          <p className="whitespace-pre-wrap">{message}</p>
        </div>

        {draft.parsed_by === 'rules' && (
          <p className="text-sm text-amber-700">
            AI was unavailable, so this was arranged by simple rules. Check each line carefully.
          </p>
        )}
        {draft.issues.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4" /> Check these
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {draft.issues.map((i, n) => <li key={n}>{i}</li>)}
            </ul>
          </div>
        )}

        {draft.loads.map((load, i) => {
          const dest = options.destinations.find((d) => d.key === load.destination_key)
          return (
            <div key={i} className="rounded-xl border bg-white">
              <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
                <div className="min-w-56 flex-1 space-y-1">
                  <Label className="text-xs text-slate-500">
                    Load {i + 1}
                    {load.destination_text && <> · message says &ldquo;{load.destination_text}&rdquo;</>}
                  </Label>
                  <Select
                    value={load.destination_key ?? undefined}
                    onValueChange={(v) => updateLoad(i, { destination_key: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Warehouses</SelectLabel>
                        {warehouses.map((d) => (
                          <SelectItem key={d.key} value={d.key}>
                            {d.name}{d.partner ? ' (partner)' : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Dealers</SelectLabel>
                        {dealers.map((d) => (
                          <SelectItem key={d.key} value={d.key}>
                            {d.name}{d.city ? ` — ${d.city}` : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {draft.loads.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft({ ...draft, loads: draft.loads.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove load
                  </Button>
                )}
              </div>
              {dest?.partner && (
                <p className="border-b bg-slate-50 px-4 py-2 text-xs text-slate-500">
                  Partner warehouse — this leaves our stock and is recorded as delivered to the owner.
                </p>
              )}

              <div className="divide-y">
                {load.lines.map((line, k) => {
                  const p = line.product_id ? products.get(line.product_id) : null
                  return (
                    <div key={k} className="grid grid-cols-[1fr_90px] gap-2 px-4 py-3 sm:grid-cols-[1fr_90px_130px_auto] sm:items-center">
                      <div className="min-w-0">
                        <Select
                          value={line.product_id ?? undefined}
                          onValueChange={(v) => updateLine(i, k, { product_id: v })}
                        >
                          <SelectTrigger className={`w-full ${!line.product_id ? 'border-amber-400' : ''}`}>
                            <SelectValue placeholder="Choose product" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Motorcycles</SelectLabel>
                              {options.products.filter((x) => x.category !== 'spare_part').map((x) => (
                                <SelectItem key={x.id} value={x.id}>{x.display_name}</SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Spare parts</SelectLabel>
                              {options.products.filter((x) => x.category === 'spare_part').map((x) => (
                                <SelectItem key={x.id} value={x.id}>{x.display_name} ({x.unit_label}s)</SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {line.source_text && (
                          <p className="mt-1 truncate text-xs text-slate-400">from &ldquo;{line.source_text}&rdquo;</p>
                        )}
                      </div>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity || ''}
                        onChange={(e) => updateLine(i, k, { quantity: parseInt(e.target.value, 10) || 0 })}
                        className="tabular-nums"
                        aria-label={p ? `Quantity in ${p.unit_label}s` : 'Quantity'}
                      />
                      <Input
                        value={line.color ?? ''}
                        onChange={(e) => updateLine(i, k, { color: e.target.value || null })}
                        placeholder="Colour"
                        className="col-span-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove line"
                        onClick={() => updateLoad(i, { lines: load.lines.filter((_, n) => n !== k) })}
                      >
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <div className="px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => updateLoad(i, { lines: [...load.lines, emptyLine()] })}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                </Button>
              </div>
            </div>
          )
        })}

        <Button
          variant="outline"
          onClick={() =>
            setDraft({ ...draft, loads: [...draft.loads, { destination_key: null, destination_text: '', lines: [emptyLine()] }] })
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add another destination
        </Button>
      </div>

      {/* ── Summary ── */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border bg-white p-4">
          <Label htmlFor="load-date" className="text-xs text-slate-500">Loading date</Label>
          <Input
            id="load-date"
            type="date"
            value={draft.load_date}
            onChange={(e) => setDraft({ ...draft, load_date: e.target.value })}
            className="mt-1"
          />

          <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
            Leaving {options.origin_warehouse_name}
          </p>
          {totals.length === 0 ? (
            <p className="text-sm text-slate-400">No items yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {totals.map(({ product, qty }) => {
                const over = qty > product.lagos_stock
                return (
                  <li key={product.id} className="flex justify-between gap-3">
                    <span>{product.display_name}</span>
                    <span className={`tabular-nums ${over ? 'font-semibold text-red-600' : 'font-medium'}`}>
                      {formatQty(qty, product.unit_label)}
                      <span className="ml-1 text-xs font-normal text-slate-400">/ {product.lagos_stock}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {shortages.length > 0 && (
            <p className="mt-3 text-xs text-red-600">
              Lagos doesn&apos;t have enough of the items in red. Fix the quantities, or record the stock arriving first.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button onClick={confirm} disabled={isSaving || incomplete || shortages.length > 0}>
            <Truck className="mr-1.5 h-4 w-4" />
            {isSaving ? 'Recording…' : `Confirm & dispatch ${draft.loads.length} load${draft.loads.length === 1 ? '' : 's'}`}
          </Button>
          <Button variant="ghost" onClick={() => { setDraft(null); setError('') }} disabled={isSaving}>
            Back to message
          </Button>
        </div>
      </aside>
    </div>
  )
}
