'use client'

import { useTransition } from 'react'
import { ArrowRight } from 'lucide-react'
import { setMdFullView } from '@/app/actions/preferences'
import { cn } from '@/lib/utils'

/**
 * The MD's switch between the short briefing and the full system.
 *
 * Two shapes of the same control: a switch in the header, reachable from any
 * page, and a link-styled button at the foot of the MD dashboard that turns
 * the mode on. Both call the same action, so the sidebar and dashboard always
 * agree on which world the MD is in.
 */
interface Props {
  enabled: boolean
  variant?: 'switch' | 'link'
}

export function MdViewToggle({ enabled, variant = 'switch' }: Props) {
  const [pending, startTransition] = useTransition()

  const toggle = (next: boolean) => startTransition(() => setMdFullView(next))

  if (variant === 'link') {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => toggle(true)}
        className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      >
        {pending ? 'Opening the full system…' : 'See the full system'}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <label
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground',
        pending && 'opacity-60'
      )}
    >
      <span className="hidden sm:inline">Full system</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Full system view"
        disabled={pending}
        onClick={() => toggle(!enabled)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          enabled ? 'bg-brand-deep' : 'bg-border'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-card shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  )
}
