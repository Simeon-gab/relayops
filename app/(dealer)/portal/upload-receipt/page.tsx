import { createClient } from '@/lib/supabase/server'
import { ReceiptUploadForm, type OpenOrder } from '@/components/dealer/receipt-upload-form'

type OrderRow = {
  id: string
  requested_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function DealerUploadReceiptPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('dealer_orders')
    .select('id, requested_at')
    .in('status', ['pending', 'partially_fulfilled'])
    .is('deleted_at', null)
    .order('requested_at', { ascending: false })

  const openOrders: OpenOrder[] = ((data ?? []) as OrderRow[]).map((o) => ({
    id: o.id,
    label: `Order ...${o.id.slice(-8)} — ${formatDate(o.requested_at)}`,
  }))

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">Upload Receipt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send proof of payment for confirmation. We&apos;ll read the details from your receipt automatically.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ReceiptUploadForm openOrders={openOrders} />
      </div>
    </div>
  )
}
