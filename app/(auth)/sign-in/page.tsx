import { SignInForm } from '@/components/shared/sign-in-form'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">RelayOps</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to your account
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  )
}