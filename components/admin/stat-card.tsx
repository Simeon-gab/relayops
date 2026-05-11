import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  href?: string
  className?: string
}

export function StatCard({ title, value, subtitle, icon: Icon, href, className }: StatCardProps) {
  const cardClass = cn(
    'flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-shadow',
    href && 'hover:shadow-md',
    className,
  )

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft">
          <Icon className="h-4 w-4 shrink-0 text-brand-deep" />
        </span>
      </div>
      <div>
        <p className="text-[32px] font-bold leading-none tracking-tight text-heading">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </>
  )

  if (href) return <Link href={href} className={cardClass}>{inner}</Link>
  return <div className={cardClass}>{inner}</div>
}
