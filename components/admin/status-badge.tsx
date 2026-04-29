'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  // gray
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  // blue
  dispatched: 'bg-blue-50 text-blue-700 border-blue-200',
  in_transit: 'bg-blue-50 text-blue-700 border-blue-200',
  allocated: 'bg-blue-50 text-blue-700 border-blue-200',
  // green
  delivered: 'bg-green-50 text-green-700 border-green-200',
  fulfilled: 'bg-green-50 text-green-700 border-green-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  // amber
  pending_allocation: 'bg-amber-50 text-amber-700 border-amber-200',
  partially_fulfilled: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  needs_review: 'bg-amber-50 text-amber-700 border-amber-200',
  // red
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  in_transit: 'In transit',
  pending_allocation: 'Pending allocation',
  partially_fulfilled: 'Part. fulfilled',
  pending_review: 'Pending review',
  partially_paid: 'Part. paid',
  needs_review: 'Needs review',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const label = statusLabels[status] ?? status.replace(/_/g, ' ')

  return (
    <Badge
      variant="outline"
      className={cn('capitalize', style, className)}
    >
      {label}
    </Badge>
  )
}
