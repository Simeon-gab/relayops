'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Package, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createShipmentFromOrder } from '@/app/actions/shipments'
import type { DealerOrderDetail, DealerOrderItemDetail } from '@/types/dealer-orders'
import type { WarehouseSummary } from '@/types/warehouses'

interface Props {
  order: DealerOrderDetail
  warehouses: WarehouseSummary[]
  stockByWarehouse: Record<string, Record<string, number>>
}

type ItemRow = {
  dealer_order_item_id: string
  product_id: string
  sku_code: string
  display_name: string
  color: string | null
  remaining: number
  shipQty: number
  unit_price_naira: number | null
}

export function CreateShipmentFromOrder({ order, warehouses, stockByWarehouse }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<ItemRow[]>([])

  const unfulfillableItems = order.items.filter(
    (i) => i.quantity_requested - i.quantity_fulfilled > 0
  )

  const canOpen =
    (order.status === 'pending' || order.status === 'partially_fulfilled') &&
    unfulfillableItems.length > 0

  useEffect(() => {
    if (!open) return
    setRows(
      unfulfillableItems.map((i: DealerOrderItemDetail) => ({
        dealer_order_item_id: i.id,
        product_id: i.product_id,
        sku_code: i.sku_code,
        display_name: i.display_name,
        color: i.color,
        remaining: i.quantity_requested - i.quantity_fulfilled,
        shipQty: i.quantity_requested - i.quantity_fulfilled,
        unit_price_naira: i.unit_price_naira,
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function setQty(index: number, value: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, shipQty: Math.max(0, Math.min(value, r.remaining)) } : r
      )
    )
  }

  const stock = stockByWarehouse[warehouseId] ?? {}

  const hasInsufficientStock = rows.some(
    (r) => r.shipQty > 0 && (stock[r.product_id] ?? 0) < r.shipQty
  )
  const hasAnyQty = rows.some((r) => r.shipQty > 0)
  const canSubmit = hasAnyQty && !hasInsufficientStock && !isPending

  function handleSubmit() {
    const itemsToShip = rows.filter((r) => r.shipQty > 0)
    startTransition(async () => {
      const result = await createShipmentFromOrder({
        dealer_order_id: order.id,
        origin_warehouse_id: warehouseId,
        items: itemsToShip.map((r) => ({
          dealer_order_item_id: r.dealer_order_item_id,
          product_id: r.product_id,
          quantity: r.shipQty,
          unit_price_naira: r.unit_price_naira ?? undefined,
        })),
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        toast.success('Shipment created — status: pending')
        setOpen(false)
        router.push(`/shipments/${result.shipmentId}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  if (!canOpen) return null

  return (
    <>
      <Button size="sm" variant="default" onClick={() => setOpen(true)}>
        <Package className="mr-1.5 h-3.5 w-3.5" />
        Create shipment
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create shipment for this order</DialogTitle>
            <p className="text-sm text-slate-500">
              {order.business_name} · {unfulfillableItems.length} item type(s) with remaining quantity
            </p>
          </DialogHeader>

          <div className="space-y-5">
            {/* Warehouse picker */}
            <div className="space-y-1.5">
              <Label>Origin warehouse</Label>
              <Select
                value={warehouseId}
                onValueChange={setWarehouseId}
                disabled={isPending}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items table */}
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium text-slate-600">SKU</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Product</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Remaining</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Ship qty</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">Stock at warehouse</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => {
                    const avail = stock[row.product_id] ?? 0
                    const insufficient = row.shipQty > 0 && avail < row.shipQty
                    return (
                      <tr key={row.dealer_order_item_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.sku_code}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-900">{row.display_name}</span>
                          {row.color && (
                            <span className="ml-1.5 text-xs text-slate-400">{row.color}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                          {row.remaining}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={row.remaining}
                            value={row.shipQty}
                            onChange={(e) => setQty(idx, Number(e.target.value))}
                            disabled={isPending}
                            className="w-20 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={insufficient ? 'font-semibold text-red-600' : 'text-slate-700'}>
                            {avail}
                          </span>
                          {insufficient && (
                            <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-red-500" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hasInsufficientStock && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Some items exceed available stock at this warehouse. Reduce quantities or choose another warehouse.
              </p>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="shipment-notes">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                id="shipment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any instructions for this shipment…"
                rows={2}
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create shipment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
