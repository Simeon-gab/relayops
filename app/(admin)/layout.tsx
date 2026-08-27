import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isStaff } from '@/lib/auth/roles'
import { SignOutButton } from '@/components/shared/sign-out-button'
import { NavLinks } from '@/components/admin/nav-links'
import { MobileNav } from '@/components/admin/mobile-nav'
import { NotificationsBell } from '@/components/admin/notifications-bell'
import { Toaster } from '@/components/ui/sonner'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (!profile?.role) {
    redirect('/sign-in?error=no_role')
  }

  if (profile.role === 'dealer') {
    redirect('/portal')
  }

  if (!isStaff(profile.role)) {
    redirect('/sign-in?error=invalid_role')
  }

  const role = profile.role

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border px-5 py-4">
          <span className="text-base font-bold tracking-tight text-brand-deep">RelayOps</span>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3">
          <NavLinks role={role} />
        </div>

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">v0.1.0 · development</p>
        </div>
      </aside>

      {/* Main column: topbar + scrollable content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-4">
          <MobileNav role={role} />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <NotificationsBell />
            <div className="mx-1 hidden h-4 w-px bg-border sm:block" />
            <span className="hidden max-w-[38vw] truncate text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}
