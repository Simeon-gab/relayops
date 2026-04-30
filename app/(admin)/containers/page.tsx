import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/page-header'
import { getContainers } from '@/lib/db/containers'
import { ContainersTable } from '@/components/admin/containers-table'

export default async function ContainersPage() {
  const containers = await getContainers()

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="Containers"
        subtitle="Container arrivals at Lagos warehouse"
        actions={
          <Button asChild>
            <Link href="/containers/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New container
            </Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border bg-white">
        <ContainersTable containers={containers} />
      </div>
    </div>
  )
}
