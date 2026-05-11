import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/shared/sign-out-button'
import { DealerNavLinks } from '@/components/dealer/nav-links'
import { DealerMobileNav } from '@/components/dealer/mobile-nav'
import { Toaster } from '@/components/ui/sonner'

export default async function DealerLayout({
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
    .select('role, display_name, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.role) {
    redirect('/sign-in?error=no_role')
  }

  if (profile.role === 'admin') {
    redirect('/dashboard')
  }

  if (profile.role !== 'dealer') {
    redirect('/sign-in?error=invalid_role')
  }

  if (!profile.dealer_id) {
    redirect('/sign-in?error=no_dealer_link')
  }

  const { data: dealer } = await supabase
    .from('dealers')
    .select('business_name, contact_name')
    .eq('id', profile.dealer_id)
    .single()

  const displayName = dealer?.business_name ?? profile.display_name ?? user.email

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="border-b border-border px-5 py-4">
          <span className="text-base font-bold tracking-tight text-brand-deep">RelayOps</span>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3">
          <DealerNavLinks />
        </div>

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">v0.1.0 · development</p>
        </div>
      </aside>

      {/* Main column: topbar + scrollable content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-4">
          <DealerMobileNav />
          <div className="flex flex-1 items-center justify-end gap-2">
            <span className="text-sm font-medium text-heading">{displayName}</span>
            <div className="h-4 w-px bg-border mx-1" />
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
