'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { signIn } from '@/app/actions/auth'

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, undefined)

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-status-danger">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-deep py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-mid disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="text-center">
        <a
          href="#"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Forgot password?
        </a>
      </div>
    </form>
  )
}
