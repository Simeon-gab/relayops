'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Container,
  ClipboardList,
  Truck,
  Warehouse,
  Bike,
  Users,
  Receipt,
  MessageSquare,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard',  href: '/dashboard',     icon: LayoutDashboard },
  { label: 'Containers', href: '/containers',     icon: Container },
  { label: 'Orders',     href: '/dealer-orders',  icon: ClipboardList },
  { label: 'Shipments',  href: '/shipments',      icon: Truck },
  { label: 'Warehouses', href: '/warehouses',     icon: Warehouse },
  { label: 'Products',   href: '/products',       icon: Bike },
  { label: 'Dealers',    href: '/dealers',        icon: Users },
  { label: 'Payments',   href: '/payments',       icon: Receipt },
  { label: 'Messages',   href: '/messages',       icon: MessageSquare },
  { label: 'Queries',    href: '/queries',        icon: Search },
]

interface NavLinksProps {
  onNavigate?: () => void
}

export function NavLinks({ onNavigate }: NavLinksProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
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
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
