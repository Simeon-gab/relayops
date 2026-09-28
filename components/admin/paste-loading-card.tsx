import Link from 'next/link'
import { ArrowRight, ClipboardPaste } from 'lucide-react'

/**
 * Home-page shortcut to the loading-message page. Loading trucks is the most
 * frequent thing that happens in a day, so it sits one tap from the dashboard.
 */
export function PasteLoadingCard({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/shipments/load"
      className={`group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-subtle ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ClipboardPaste className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-heading">Loading today?</p>
        <p className="text-sm text-muted-foreground">
          Paste the WhatsApp loading message. It gets arranged for you to check and confirm.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
