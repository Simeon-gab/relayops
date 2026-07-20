'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Bell } from 'lucide-react'
import { getUnreadCountAction, getRecentNotificationsAction } from '@/app/actions/notifications'
import { NotificationsDropdown } from './notifications-dropdown'

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Awaited<ReturnType<typeof getRecentNotificationsAction>>>([])
  const [, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  function fetchUnread() {
    startTransition(async () => {
      const count = await getUnreadCountAction()
      setUnread(count)
    })
  }

  function fetchNotifications() {
    startTransition(async () => {
      const data = await getRecentNotificationsAction()
      setNotifications(data)
    })
  }

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) {
      fetchNotifications()
      fetchUnread()
    }
  }, [open])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-subtle hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:w-80">
          <NotificationsDropdown
            notifications={notifications}
            hasUnread={unread > 0}
            onClose={() => {
              setOpen(false)
              fetchUnread()
            }}
          />
        </div>
      )}
    </div>
  )
}
