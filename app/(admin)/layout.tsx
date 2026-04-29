import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/shared/sign-out-button'
import { NavLinks } from '@/components/admin/nav-links'
import { MobileNav } from '@/components/admin/mobile-nav'

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-white md:flex">
        <div className="border-b px-6 py-5">
          <span className="text-base font-bold tracking-tight text-slate-900">
            RelayOps
          </span>
        </div>

        <div className="flex-1 overflow-auto px-3 py-4">
          <NavLinks />
        </div>

        <div className="border-t px-4 py-3">
          <p className="text-xs text-slate-400">v0.1.0 · development</p>
        </div>
      </aside>

      {/* Right column: topbar + scrollable content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b bg-white px-4">
          <MobileNav />
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="text-sm text-slate-500">{user.email}</span>
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
