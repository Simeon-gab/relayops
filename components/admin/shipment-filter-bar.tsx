'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShipmentStatusCounts } from '@/types/shipments'

const STATUS_PILLS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'In transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
] as const

const TYPE_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Dealer', value: 'dealer' },
  { label: 'Transfer', value: 'transfer' },
] as const

interface Props {
  counts: ShipmentStatusCounts
}

export function ShipmentFilterBar({ counts }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(searchParams.get('search') ?? '')

  const currentStatus = searchParams.get('status') ?? ''
  const currentType = searchParams.get('type') ?? ''

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
      startTransition(() => {
        router.push(`/shipments?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value)
      const timer = setTimeout(() => pushParams({ search: value }), 350)
      return () => clearTimeout(timer)
    },
    [pushParams]
  )

  function countFor(status: string): number {
    if (status === '') return counts.all_active + counts.delivered
    return counts[status as keyof ShipmentStatusCounts] ?? 0
  }

  return (
    <div className="space-y-3">
      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_PILLS.map(({ label, value }) => {
          const active = currentStatus === value
          const count = countFor(value)
          return (
            <button
              key={value}
              onClick={() => pushParams({ status: value })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              )}
            >
              {label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Type + Search row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type segment */}
        <div className="flex overflow-hidden rounded-lg border bg-white">
          {TYPE_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => pushParams({ type: value })}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                currentType === value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dealer or ID…"
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>
    </div>
  )
}
