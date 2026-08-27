'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { NavLinks } from './nav-links'
import type { StaffRole } from '@/lib/auth/roles'

export function MobileNav({ role }: { role: StaffRole }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-left text-base font-bold tracking-tight text-slate-900">
              RelayOps
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-3 py-4">
            <NavLinks role={role} onNavigate={() => setOpen(false)} />
          </div>

          <div className="border-t px-4 py-3">
            <p className="text-xs text-slate-400">v0.1.0 · development</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
