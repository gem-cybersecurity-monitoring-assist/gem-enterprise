'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Bell, CheckCircle2, AlertCircle, Clock, CheckCheck, X, Loader2,
} from 'lucide-react'

interface DbNotification {
  id: string
  title: string
  body: string
  channel: string
  isRead: boolean
  readAt: string | null
  data: Record<string, unknown> | null
  createdAt: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsPage() {
  const [items, setItems] = useState<DbNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (data.notifications) {
        setItems(data.notifications)
        setUnreadCount(data.unreadCount ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  async function markRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
  }

  const displayed = filter === 'unread' ? items.filter(n => !n.isRead) : items

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-[hsl(var(--svc-cyber))]" />
            Notifications
            {unreadCount > 0 && (
              <span className="w-6 h-6 rounded-full bg-[hsl(var(--svc-cyber))] text-black text-xs font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Alerts, approvals, and platform updates.</p>
        </div>
        <Button variant="outline" size="sm" className="border-white/10 text-slate-300 hover:text-white gap-2" onClick={markAllRead}>
          <CheckCheck className="w-3.5 h-3.5" /> Mark all read
        </Button>
      </div>

      <div className="flex gap-2">
        {(['unread', 'all'] as const).map(f => (
          <Button
            key={f}
            variant="outline"
            size="sm"
            onClick={() => setFilter(f)}
            className={`border-white/10 text-xs ${filter === f ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {f === 'unread' ? `Unread (${unreadCount})` : 'All'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading notifications…
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-xl">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-white font-semibold">All caught up</p>
          <p className="text-slate-400 text-sm mt-1">No {filter === 'unread' ? 'unread ' : ''}notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <div
              key={n.id}
              className={`glass-panel rounded-xl p-4 bento-card flex gap-3 cursor-pointer ${!n.isRead ? 'border-l-2 border-l-[hsl(var(--svc-cyber))]' : ''}`}
              onClick={() => !n.isRead && markRead(n.id)}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${n.isRead ? 'bg-white/5' : 'bg-[hsl(var(--svc-cyber-muted))]'}`}>
                {n.isRead
                  ? <CheckCircle2 className="w-5 h-5 text-slate-500" />
                  : <Bell className="w-5 h-5 text-[hsl(var(--svc-cyber))]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{n.channel.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500">{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.body}</p>
                {!n.isRead && (
                  <button
                    className="text-xs text-[hsl(var(--svc-cyber))] hover:underline mt-1"
                    onClick={e => { e.stopPropagation(); markRead(n.id) }}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
