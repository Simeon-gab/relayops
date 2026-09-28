import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getWarehouses } from '@/lib/db/warehouses'
import { formatQty } from '@/lib/utils/format'

export default async function WarehousesPage() {
  const warehouses = await getWarehouses()

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Warehouses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lagos is the import base and the only stock we hold. Partner warehouses show what we delivered to them.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {warehouses.map((wh) => (
          <Card key={wh.id}>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold leading-snug">
                      {wh.name}
                    </h2>
                    {wh.is_import_base && (
                      <Badge variant="secondary">Import base</Badge>
                    )}
                    {wh.partner_dealer_id && (
                      <Badge variant="outline">{wh.partner_dealer_name ?? 'Partner'}&apos;s warehouse</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {wh.city}, {wh.state}
                  </p>
                </div>

                {!wh.partner_dealer_id && (
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-semibold tabular-nums">
                      {wh.total_units}
                    </p>
                    <p className="text-xs text-muted-foreground">motorcycles in stock</p>
                  </div>
                )}
              </div>

              {!wh.partner_dealer_id && wh.spare_part_lines.length > 0 && (
                <p className="mt-3 text-sm text-slate-600">
                  Spare parts:{' '}
                  {wh.spare_part_lines
                    .map((p) => `${formatQty(p.quantity, p.unit_label)} ${p.display_name.toLowerCase()}`)
                    .join(' · ')}
                </p>
              )}

              {wh.partner_dealer_id && (
                <p className="mt-3 text-sm text-slate-600">
                  Owned by {wh.partner_dealer_name ?? 'a partner'} — not counted in our stock.
                </p>
              )}

              <div className="mt-5">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/warehouses/${wh.id}`}>
                    {wh.partner_dealer_id ? 'View deliveries' : 'View stock detail'}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
