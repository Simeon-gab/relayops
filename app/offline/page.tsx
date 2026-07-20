export const metadata = {
  title: 'Offline · RelayOps',
}

export default function OfflinePage() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-4 px-8 py-16 text-center bg-[#163828] text-white">
      <div className="text-2xl font-semibold">You&apos;re offline</div>
      <p className="max-w-sm text-white/70">
        RelayOps needs an internet connection to load live data — orders,
        shipments, and payments. Reconnect and try again.
      </p>
      <a
        href="/"
        className="mt-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
      >
        Try again
      </a>
    </div>
  )
}
