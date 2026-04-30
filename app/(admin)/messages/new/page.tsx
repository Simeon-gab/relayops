import { getDealers } from '@/lib/db/dealers'
import { InboundMessageForm } from '@/components/admin/inbound-message-form'

type Props = {
  searchParams: Promise<{ dealer?: string }>
}

export default async function NewMessagePage({ searchParams }: Props) {
  const { dealer: defaultDealerId } = await searchParams
  const dealers = await getDealers()

  const dealerOptions = dealers.map((d) => ({
    id: d.id,
    business_name: d.business_name,
    city: d.city,
  }))

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">New inbound message</h1>
        <p className="mt-1 text-sm text-slate-500">
          Record a message received from a dealer (paste from WhatsApp, SMS, etc.)
        </p>
      </div>

      <InboundMessageForm dealers={dealerOptions} defaultDealerId={defaultDealerId} />
    </div>
  )
}
