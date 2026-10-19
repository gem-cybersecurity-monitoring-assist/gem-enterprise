'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Calendar, Plus, Loader2, Clock, Video, CheckCircle2, XCircle } from 'lucide-react'

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
  const [showForm, setShowForm] = useState(false)
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [proposedAt, setProposedAt] = useState('')
  const [duration, setDuration] = useState('30')
  const [creating, setCreating] = useState(false)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/meetings')
      const data = await res.json()
      if (data.meetings) setMeetings(data.meetings)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
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
      if (res.ok) {
        setTopic('')
        setDescription('')
        setProposedAt('')
        setDuration('30')
        setShowForm(false)
        await fetchMeetings()
      }
    } finally {
      setCreating(false)
    }
  }

  async function cancelMeeting(id: string) {
    await fetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    await fetchMeetings()
  }

  const upcoming = meetings.filter(m => m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && new Date(m.proposedAt) >= new Date())
  const past = meetings.filter(m => m.status === 'COMPLETED' || new Date(m.proposedAt) < new Date())

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-cyan-400" />
            Meetings
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Schedule and manage meetings with your advisor.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-cyan-500 text-black hover:opacity-90 gap-2">
          <Plus className="w-4 h-4" /> Request Meeting
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-white text-sm">New Meeting Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createMeeting} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Topic</label>
                <Input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Portfolio review Q1"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Description (optional)</label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional context or agenda items"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Proposed Date & Time</label>
                  <Input
                    type="datetime-local"
                    value={proposedAt}
                    onChange={e => setProposedAt(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Duration (minutes)</label>
                  <select
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
              <div className="flex gap-3">
                <Button type="submit" disabled={creating} className="bg-cyan-500 text-black hover:opacity-90 gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
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

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading meetings…
        </div>
      ) : (
        <>
          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-sm">Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No upcoming meetings.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(m => (
                    <div key={m.id} className="flex items-start justify-between bg-white/5 rounded-lg p-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{m.topic}</p>
                          <Badge className={`text-xs ${statusColor[m.status]}`}>{m.status}</Badge>
                        </div>
                        {m.description && <p className="text-xs text-slate-500 mb-1">{m.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(m.proposedAt).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {m.duration} min
                          </span>
                          {m.meetingUrl && (
                            <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-cyan-400 hover:underline">
                              <Video className="w-3 h-3" /> Join
                            </a>
                          )}
                        </div>
                      </div>
                      {m.status === 'REQUESTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelMeeting(m.id)}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel
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
                      <div>
                        <div className="flex items-center gap-2 mb-1">
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
