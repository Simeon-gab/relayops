import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/shared/sign-out-button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-semibold">RelayOps</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user.email}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Warehouse Stock', value: '—' },
            { label: 'Active Shipments', value: '—' },
            { label: 'Pending Payments', value: '—' },
            { label: 'Items Needing Attention', value: '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-slate-400">
          Block 2 coming next: database schema, seed data, and real counts.
        </p>
      </main>
    </div>
  )
}
