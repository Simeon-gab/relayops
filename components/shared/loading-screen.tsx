export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-brand-deep">
      <span className="text-[32px] font-semibold tracking-tight text-white">RelayOps</span>
      <div className="mt-4 h-0.5 w-16 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-full origin-left animate-pulse bg-white/70" />
      </div>
      <p className="mt-3 text-sm text-white/70">Loading your operations...</p>
    </div>
  )
}
