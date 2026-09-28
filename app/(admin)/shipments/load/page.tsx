import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { LoadingMessageForm } from '@/components/admin/loading-message-form'
import { getLoadingOptions } from '@/lib/db/loading'

export default async function LoadingMessagePage() {
  const options = await getLoadingOptions()

  return (
    <div className="px-6 py-10">
      <Link
        href="/shipments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to shipments
      </Link>
      <PageHeader
        title="Paste loading message"
        subtitle="Paste today's WhatsApp loading message. It gets arranged into loads for you to check — nothing is saved until you confirm."
      />
      <LoadingMessageForm options={options} />
    </div>
  )
}
