'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { suggestContainerAllocation } from '@/app/actions/containers'
import { AllocationSuggestionReview } from '@/components/admin/allocation-suggestion-review'
import type { AllocationSuggestion } from '@/app/actions/containers'

interface Props {
  containerId: string
}

export function AllocationStarter({ containerId }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<AllocationSuggestion | null>(null)
  const [rejected, setRejected] = useState(false)

  async function handleSuggest() {
    setLoading(true)
    try {
      const result = await suggestContainerAllocation(containerId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSuggestion(result.suggestion)
    } finally {
      setLoading(false)
    }
  }

  if (rejected) {
    return (
      <div className="rounded-xl border border-dashed bg-white px-4 py-8 text-center text-sm text-muted-foreground">
        Allocation suggestion rejected. Use the manual allocation tools to proceed.
      </div>
    )
  }

  if (suggestion) {
    return (
      <AllocationSuggestionReview
        suggestion={suggestion}
        containerId={containerId}
        onReject={() => {
          setSuggestion(null)
          setRejected(true)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-white px-4 py-10">
      <p className="text-sm text-muted-foreground text-center max-w-md">
        This container is ready for allocation. Claude will review pending dealer orders and suggest how to split stock between Lagos and Kano.
      </p>
      <Button onClick={handleSuggest} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analysing orders and stock…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Suggest allocation with AI
          </>
        )}
      </Button>
      {loading && (
        <p className="text-xs text-muted-foreground">This may take 10–20 seconds</p>
      )}
    </div>
  )
}
