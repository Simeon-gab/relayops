'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  ClipboardList,
  Truck,
  Receipt,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard',      href: '/portal',                icon: LayoutGrid,   exact: true },
  { label: 'My Orders',      href: '/portal/orders',         icon: ClipboardList },
  { label: 'Shipments',      href: '/portal/shipments',      icon: Truck },
  { label: 'Payments',       href: '/portal/payments',       icon: Receipt },
  { label: 'Upload Receipt', href: '/portal/upload-receipt', icon: Upload },
]

interface NavLinksProps {
  onNavigate?: () => void
}

export function DealerNavLinks({ onNavigate }: NavLinksProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map(({ label, href, icon: Icon, exact }) => {
        const isActive = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-brand-soft text-brand-deep'
                : 'text-muted-foreground hover:bg-subtle hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-brand-deep' : ''
              )}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
