'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Calendar, Plus, Loader2, Clock, Video, CheckCircle2, XCircle } from 'lucide-react'
import { WorkspaceBreadcrumb, WorkspaceEmptyState, WorkspaceErrorState } from '@/components/workspace/WorkspaceUi'

interface Meeting {
  id: string
  topic: string
  description: string | null
  proposedAt: string
  duration: number
  status: string
  meetingUrl: string | null
  requester: {
    email: string
    profile: { firstName: string | null; lastName: string | null } | null
  }
}

const statusColor: Record<string, string> = {
  REQUESTED:  'bg-yellow-500/20 text-yellow-400',
  CONFIRMED:  'bg-green-500/20 text-green-400',
  CANCELLED:  'bg-red-500/20 text-red-400',
  COMPLETED:  'bg-slate-500/20 text-slate-400',
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [proposedAt, setProposedAt] = useState('')
  const [duration, setDuration] = useState('30')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/meetings')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.meetings) setMeetings(data.meetings)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setFormError(null)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          description: description || undefined,
          proposedAt: new Date(proposedAt).toISOString(),
          duration: Number(duration),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTopic('')
        setDescription('')
        setProposedAt('')
        setDuration('30')
        setShowForm(false)
        await fetchMeetings()
      } else {
        setFormError(typeof data.error === 'string' ? data.error : 'The meeting request could not be submitted. Please try again.')
      }
    } catch {
      setFormError('The meeting service is temporarily unavailable. Please try again shortly.')
    } finally {
      setCreating(false)
    }
  }

  async function cancelMeeting(id: string) {
    if (confirmCancelId !== id) {
      setConfirmCancelId(id)
      return
    }
    setConfirmCancelId(null)
    setActionError(null)
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchMeetings()
    } catch {
      setActionError('That meeting could not be cancelled. Please try again.')
    }
  }

  const now = new Date()
  const upcoming = meetings.filter(m => m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && new Date(m.proposedAt) >= now)
  const past = meetings.filter(m => m.status === 'COMPLETED' || new Date(m.proposedAt) < now)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <WorkspaceBreadcrumb current="Meetings" />
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-cyan-400" aria-hidden="true" />
            Meetings
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Schedule and manage meetings with your GEM team.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          aria-expanded={showForm}
          aria-controls="meeting-request-form"
          className="bg-cyan-500 text-black hover:opacity-90 gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Request Meeting
        </Button>
      </div>

      {showForm && (
        <Card id="meeting-request-form" className="bg-card border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-white text-sm">New Meeting Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createMeeting} className="space-y-4">
              <div>
                <label htmlFor="meeting-topic" className="text-xs text-slate-400 mb-1 block">Topic</label>
                <Input
                  id="meeting-topic"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Portfolio review Q1"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="meeting-description" className="text-xs text-slate-400 mb-1 block">Description (optional)</label>
                <Input
                  id="meeting-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional context or agenda items"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="meeting-proposed-at" className="text-xs text-slate-400 mb-1 block">Proposed Date & Time</label>
                  <Input
                    id="meeting-proposed-at"
                    type="datetime-local"
                    value={proposedAt}
                    onChange={e => setProposedAt(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="meeting-duration" className="text-xs text-slate-400 mb-1 block">Duration (minutes)</label>
                  <select
                    id="meeting-duration"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3"
                  >
                    {[15, 30, 45, 60, 90, 120].map(d => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>
              {formError ? (
                <p role="alert" className="text-xs text-red-400">{formError}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={creating} className="bg-cyan-500 text-black hover:opacity-90 gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                  {creating ? 'Requesting…' : 'Submit Request'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {actionError ? (
        <p role="alert" className="text-xs text-red-400">{actionError}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-slate-500" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading meetings…
        </div>
      ) : loadError ? (
        <WorkspaceErrorState
          title="Meetings could not be loaded"
          description="Your meeting schedule could not be reached. Try again."
          onRetry={fetchMeetings}
        />
      ) : (
        <>
          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm">Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <WorkspaceEmptyState
                  title="No upcoming meetings"
                  description="Request a consultation, review, or briefing and it will appear here once scheduled."
                  action={
                    <Button size="sm" onClick={() => setShowForm(true)} className="bg-cyan-500 text-black hover:opacity-90 gap-2">
                      <Plus className="w-4 h-4" aria-hidden="true" /> Request a meeting
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {upcoming.map(m => (
                    <div key={m.id} className="flex flex-col gap-3 bg-white/5 rounded-lg p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{m.topic}</p>
                          <Badge className={`text-xs ${statusColor[m.status]}`}>{m.status}</Badge>
                        </div>
                        {m.description && <p className="text-xs text-slate-500 mb-1">{m.description}</p>}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            {new Date(m.proposedAt).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {m.duration} min
                          </span>
                          {m.meetingUrl && (
                            <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-cyan-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded">
                              <Video className="w-3 h-3" aria-hidden="true" /> Join
                            </a>
                          )}
                        </div>
                      </div>
                      {m.status === 'REQUESTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelMeeting(m.id)}
                          className={`border-red-500/30 text-xs gap-1 shrink-0 ${confirmCancelId === m.id ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'text-red-400 hover:bg-red-500/10'}`}
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {confirmCancelId === m.id ? 'Confirm cancel' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {past.length > 0 && (
            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-sm">Past Meetings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {past.map(m => (
                    <div key={m.id} className="flex items-start gap-3 bg-white/5 rounded-lg p-4 opacity-60">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{m.topic}</p>
                          <Badge className={`text-xs ${statusColor[m.status]}`}>{m.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">{new Date(m.proposedAt).toLocaleString()} · {m.duration} min</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
