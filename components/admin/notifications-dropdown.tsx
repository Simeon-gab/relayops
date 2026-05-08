'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  CreditCard,
  FileText,
  Truck,
  MessageSquare,
  Package,
  CheckCircle,
  Bell,
} from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'

type Notification = {
  id: string
  event_type: string
  title: string
  description: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

function entityPath(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null
  switch (entityType) {
    case 'order': return `/dealer-orders/${entityId}`
    case 'payment': return `/payments/${entityId}`
    case 'shipment': return `/shipments/${entityId}`
    case 'receipt': return `/messages`
    case 'message': return `/messages/${entityId}`
    case 'container': return `/containers/${entityId}`
    default: return null
  }
}

function EventIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4 shrink-0'
  switch (type) {
    case 'order_created': return <ShoppingCart className={`${cls} text-blue-500`} />
    case 'payment_received': return <CreditCard className={`${cls} text-green-500`} />
    case 'receipt_extracted': return <FileText className={`${cls} text-purple-500`} />
    case 'shipment_delivered': return <Truck className={`${cls} text-emerald-500`} />
    case 'shipment_dispatched': return <Truck className={`${cls} text-amber-500`} />
    case 'message_received': return <MessageSquare className={`${cls} text-sky-500`} />
    case 'allocation_pending': return <Package className={`${cls} text-orange-500`} />
    case 'order_auto_fulfilled': return <CheckCircle className={`${cls} text-green-600`} />
    default: return <Bell className={`${cls} text-slate-400`} />
  }
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

interface Props {
  notifications: Notification[]
  hasUnread: boolean
  onClose: () => void
}

export function NotificationsDropdown({ notifications, hasUnread, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
      onClose()
    })
  }

  function handleClick(n: Notification) {
    startTransition(async () => {
      if (!n.read_at) await markNotificationRead(n.id)
      const path = entityPath(n.entity_type, n.entity_id)
      onClose()
      if (path) router.push(path)
    })
  }

  return (
    <div className="flex max-h-[480px] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">Notifications</span>
        {hasUnread && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bell className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No notifications yet</p>
          </div>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => (
              <li
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50 ${
                  !n.read_at ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="mt-0.5">
                  <EventIcon type={n.event_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-tight ${!n.read_at ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                    {n.title}
                  </p>
                  {n.description && (
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{n.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
