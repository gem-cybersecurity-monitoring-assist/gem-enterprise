'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bell, CheckCircle2, CheckCheck, Loader2,
} from 'lucide-react'
import { WorkspaceBreadcrumb, WorkspaceEmptyState, WorkspaceErrorState } from '@/components/workspace/WorkspaceUi'

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
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.notifications) {
        setItems(data.notifications)
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  async function patchNotifications(body: Record<string, unknown>) {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  async function markRead(id: string) {
    const previous = items
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
    setActionError(null)
    try {
      await patchNotifications({ ids: [id] })
    } catch {
      // Roll back the optimistic update so unread state stays truthful.
      setItems(previous)
      setUnreadCount(previous.filter(n => !n.isRead).length)
      setActionError('Could not mark that notification as read. Try again.')
    }
  }

  async function markAllRead() {
    const previous = items
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    setActionError(null)
    try {
      await patchNotifications({ markAllRead: true })
    } catch {
      setItems(previous)
      setUnreadCount(previous.filter(n => !n.isRead).length)
      setActionError('Could not mark all notifications as read. Try again.')
    }
  }

  const displayed = filter === 'unread' ? items.filter(n => !n.isRead) : items
  const hasUnread = unreadCount > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <WorkspaceBreadcrumb current="Notifications" />
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-[hsl(var(--svc-cyber))]" />
            Notifications
            {hasUnread && (
              <span aria-label={`${unreadCount} unread`} className="w-6 h-6 rounded-full bg-[hsl(var(--svc-cyber))] text-black text-xs font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Alerts, approvals, and platform updates.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 text-slate-300 hover:text-white gap-2 disabled:opacity-40"
          onClick={markAllRead}
          disabled={!hasUnread || loading}
        >
          <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> Mark all read
        </Button>
      </div>

      <div className="flex gap-2" role="group" aria-label="Notification filters">
        {(['unread', 'all'] as const).map(f => (
          <Button
            key={f}
            variant="outline"
            size="sm"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`border-white/10 text-xs ${filter === f ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {f === 'unread' ? `Unread (${unreadCount})` : 'All'}
          </Button>
        ))}
      </div>

      {actionError ? (
        <p role="alert" className="text-xs text-red-400">{actionError}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading notifications…
        </div>
      ) : loadError ? (
        <WorkspaceErrorState
          title="Notifications could not be loaded"
          description="Check your connection and try again. Unread counts may be stale."
          onRetry={fetchNotifications}
        />
      ) : displayed.length === 0 ? (
        <WorkspaceEmptyState
          title="All caught up"
          description={filter === 'unread'
            ? 'No unread notifications. New alerts, approvals, and updates will appear here.'
            : 'No notifications yet. New alerts, approvals, and updates will appear here.'}
          action={
            <Link
              href="/app/workspace"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Back to workspace
            </Link>
          }
        />
      ) : (
        <div className="space-y-2" role="list" aria-label="Notifications">
          {displayed.map(n => (
            <article
              key={n.id}
              role="listitem"
              className={`glass-panel rounded-xl p-4 bento-card flex gap-3 ${!n.isRead ? 'border-l-2 border-l-[hsl(var(--svc-cyber))]' : ''}`}
            >
              <div aria-hidden="true" className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${n.isRead ? 'bg-white/5' : 'bg-[hsl(var(--svc-cyber-muted))]'}`}>
                {n.isRead
                  ? <CheckCircle2 className="w-5 h-5 text-slate-500" />
                  : <Bell className="w-5 h-5 text-[hsl(var(--svc-cyber))]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{n.channel.replace('_', ' ')}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.body}</p>
                {!n.isRead && (
                  <button
                    type="button"
                    className="text-xs text-[hsl(var(--svc-cyber))] hover:underline mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                    onClick={() => markRead(n.id)}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
