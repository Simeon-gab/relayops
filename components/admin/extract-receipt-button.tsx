'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { extractReceipt } from '@/app/actions/receipts'

export function ExtractReceiptButton({ receiptId }: { receiptId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleExtract() {
    startTransition(async () => {
      const result = await extractReceipt(receiptId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const label =
        result.status === 'extracted'
          ? `Extracted with ${Math.round(result.confidence * 100)}% confidence`
          : result.status === 'rejected'
          ? 'Marked as not a receipt'
          : `Needs review (${Math.round(result.confidence * 100)}% confidence)`
      toast.success(label)
      setDone(true)
      router.refresh()
    })
  }

  if (done) return null

  return (
    <Button size="sm" onClick={handleExtract} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Extracting…
        </>
      ) : (
        <>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Extract data
        </>
      )}
    </Button>
  )
}
