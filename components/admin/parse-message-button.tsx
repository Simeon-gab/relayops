'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { parseMessage } from '@/app/actions/messages'

export function ParseMessageButton({ messageId }: { messageId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleParse() {
    startTransition(async () => {
      const result = await parseMessage(messageId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      const label = `${intentLabel(result.intent)} — ${Math.round(result.confidence * 100)}% confidence`
      toast.success(label)
      router.refresh()
    })
  }

  return (
    <Button size="sm" onClick={handleParse} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Parsing…
        </>
      ) : (
        <>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Parse message
        </>
      )}
    </Button>
  )
}

function intentLabel(intent: string): string {
  const map: Record<string, string> = {
    order_request: 'Order request detected',
    payment_notification: 'Payment notification detected',
    delivery_status: 'Delivery status detected',
    question_inquiry: 'Question detected',
    general: 'Message parsed',
  }
  return map[intent] ?? 'Message parsed'
}
