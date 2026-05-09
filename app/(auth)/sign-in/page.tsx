import { SignInForm } from '@/components/shared/sign-in-form'

export default function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel — desktop only */}
      <div className="hidden lg:flex flex-col bg-gradient-to-b from-[#1F4D3C] to-[#163828] p-16">
        <div>
          <span className="text-4xl font-bold tracking-tight text-white">RelayOps</span>
          <p className="mt-5 text-base leading-relaxed text-white/80">
            Operations layer for motorcycle distribution.<br />
            Container to dealer to delivery —<br />
            tracked, parsed, and dispatched.
          </p>
        </div>
        <p className="mt-auto text-xs text-white/50">
          Built for Hungkee Motorcycle · Lagos &amp; Kano
        </p>
      </div>

      {/* Right panel — full width on mobile, 50% on desktop */}
      <div className="flex min-h-screen items-center justify-center bg-card px-8 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only wordmark */}
          <div className="mb-8 lg:hidden">
            <span className="text-2xl font-bold tracking-tight text-heading">RelayOps</span>
          </div>

          <h1 className="text-2xl font-semibold text-heading">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Welcome back. Enter your credentials to continue.
          </p>

          <div className="mt-8">
            <SignInForm />
          </div>
        </div>
      </div>
    </div>
  )
}
