import { cn } from '@/lib/utils'

type StatusConfig = {
  dot: string
  bg: string
  text: string
}

const statusConfig: Record<string, StatusConfig> = {
  // Neutral / draft
  draft:    { dot: 'bg-muted-foreground/40', bg: 'bg-muted', text: 'text-muted-foreground' },
  inactive: { dot: 'bg-muted-foreground/40', bg: 'bg-muted', text: 'text-muted-foreground' },

  // Pending / amber
  pending:             { dot: 'bg-status-pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  pending_allocation:  { dot: 'bg-status-pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  partially_fulfilled: { dot: 'bg-status-pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  pending_review:      { dot: 'bg-status-pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  partially_paid:      { dot: 'bg-status-pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  needs_review:        { dot: 'bg-status-pending', bg: 'bg-amber-50', text: 'text-amber-700' },

  // In transit / info / sky
  dispatched: { dot: 'bg-status-info', bg: 'bg-sky-50', text: 'text-sky-700' },
  in_transit:  { dot: 'bg-status-info', bg: 'bg-sky-50', text: 'text-sky-700' },
  allocated:   { dot: 'bg-status-info', bg: 'bg-sky-50', text: 'text-sky-700' },
  active:      { dot: 'bg-status-info', bg: 'bg-sky-50', text: 'text-sky-700' },

  // Success / green
  delivered:  { dot: 'bg-status-success', bg: 'bg-green-50', text: 'text-green-700' },
  fulfilled:  { dot: 'bg-status-success', bg: 'bg-green-50', text: 'text-green-700' },
  paid:       { dot: 'bg-status-success', bg: 'bg-green-50', text: 'text-green-700' },
  completed:  { dot: 'bg-status-success', bg: 'bg-green-50', text: 'text-green-700' },
  extracted:  { dot: 'bg-status-success', bg: 'bg-green-50', text: 'text-green-700' },

  // Danger / red
  cancelled: { dot: 'bg-status-danger', bg: 'bg-red-50', text: 'text-red-700' },
  rejected:  { dot: 'bg-status-danger', bg: 'bg-red-50', text: 'text-red-700' },
  failed:    { dot: 'bg-status-danger', bg: 'bg-red-50', text: 'text-red-700' },
}

const statusLabels: Record<string, string> = {
  in_transit:          'In transit',
  pending_allocation:  'Pending allocation',
  partially_fulfilled: 'Part. fulfilled',
  pending_review:      'Pending review',
  partially_paid:      'Part. paid',
  needs_review:        'Needs review',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { dot: 'bg-muted-foreground/40', bg: 'bg-muted', text: 'text-muted-foreground' }
  const label = statusLabels[status] ?? status.replace(/_/g, ' ')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dot)} />
      {label}
    </span>
  )
}
