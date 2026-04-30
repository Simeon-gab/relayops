import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDealers } from '@/lib/db/dealers'
import { DealersTable } from '@/components/admin/dealers-table'
import { PageHeader } from '@/components/admin/page-header'

export default async function DealersPage() {
  const dealers = await getDealers()

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="Dealers"
        subtitle="Hungkee dealer network across Nigeria"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dealer-orders/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New order
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dealers/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New dealer
              </Link>
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border bg-white">
        <DealersTable dealers={dealers} />
      </div>
    </div>
  )
}
