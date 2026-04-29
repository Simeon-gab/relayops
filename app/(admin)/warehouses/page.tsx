import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getWarehouses } from '@/lib/db/warehouses'

export default async function WarehousesPage() {
  const warehouses = await getWarehouses()

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Warehouses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lagos is the import base. Kano serves the north.
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
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {wh.city}, {wh.state}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold tabular-nums">
                    {wh.total_units}
                  </p>
                  <p className="text-xs text-muted-foreground">units in stock</p>
                </div>
              </div>

              <div className="mt-5">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/warehouses/${wh.id}`}>View stock detail</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
