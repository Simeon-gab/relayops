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
  FileText,
  MessageSquare,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StaffRole } from '@/lib/auth/roles'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: readonly StaffRole[]
}

const ALL: readonly StaffRole[] = ['md', 'manager', 'partner']

/**
 * The nav is the main way each role's world is scoped. Nothing here is a
 * security boundary — that lives in RLS and the capability checks — this
 * just keeps each person's screen to what their job actually needs.
 *
 * The MD gets four items on purpose. The partner gets the physical chain
 * and no pricing.
 */
const navItems: NavItem[] = [
  { label: 'Dashboard',  href: '/dashboard',    icon: LayoutDashboard, roles: ALL },
  { label: 'Containers', href: '/containers',   icon: Container,       roles: ['manager', 'partner'] },
  { label: 'Orders',     href: '/dealer-orders', icon: ClipboardList,  roles: ['manager'] },
  { label: 'Shipments',  href: '/shipments',    icon: Truck,           roles: ['manager', 'partner'] },
  { label: 'Warehouses', href: '/warehouses',   icon: Warehouse,       roles: ['manager', 'partner'] },
  { label: 'Products',   href: '/products',     icon: Bike,            roles: ['manager'] },
  { label: 'Dealers',    href: '/dealers',      icon: Users,           roles: ['md', 'manager', 'partner'] },
  { label: 'Payments',   href: '/payments',     icon: Receipt,         roles: ['md', 'manager'] },
  { label: 'Receipts',   href: '/receipts',     icon: FileText,        roles: ['manager'] },
  { label: 'Messages',   href: '/messages',     icon: MessageSquare,   roles: ['manager'] },
  { label: 'Ask',        href: '/queries',      icon: Search,          roles: ALL },
]

export function navItemsForRole(role: StaffRole): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role))
}

interface NavLinksProps {
  role: StaffRole
  onNavigate?: () => void
}

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {navItemsForRole(role).map(({ label, href, icon: Icon }) => {
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
