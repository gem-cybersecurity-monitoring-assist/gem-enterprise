'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Calendar, Plus, Loader2, Clock, Video, CheckCircle2, XCircle, Users, RefreshCw } from 'lucide-react'
import { WorkspaceBreadcrumb, WorkspaceEmptyState, WorkspaceErrorState } from '@/components/workspace/WorkspaceUi'

interface Recipient { id: string; email: string; name: string; role: string }
interface Invitee { id: string; userId: string; email: string; status: string; joinedAt?: string | null; leftAt?: string | null }
interface Meeting {
  id: string; topic: string; description: string | null; proposedAt: string; duration: number
  status: string; meetingUrl: string | null; zoomJoinUrl?: string | null; zoomMeetingId?: string | null
  requester: { email: string; profile: { firstName: string | null; lastName: string | null } | null }
  invitees?: Invitee[]
}
const statusColor: Record<string, string> = {
  REQUESTED: 'bg-yellow-500/20 text-yellow-400', CONFIRMED: 'bg-green-500/20 text-green-400',
  CANCELLED: 'bg-red-500/20 text-red-400', COMPLETED: 'bg-slate-500/20 text-slate-400',
}
export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [adminAccess, setAdminAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [proposedAt, setProposedAt] = useState('')
  const [duration, setDuration] = useState('30')
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true); setLoadError(false)
    try {
      const res = await fetch('/api/meetings')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMeetings(data.meetings ?? [])
    } catch { setLoadError(true) } finally { setLoading(false) }
  }, [])
  const fetchRecipients = useCallback(async () => {
    const res = await fetch('/api/meetings/recipients')
    if (res.ok) {
      const data = await res.json()
      setRecipients(data.recipients ?? [])
      setAdminAccess(true)
    } else if (res.status === 403) setAdminAccess(false)
  }, [])
  useEffect(() => { fetchMeetings(); fetchRecipients() }, [fetchMeetings, fetchRecipients])

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault(); setCreating(true); setFormError(null); setNotice(null)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, description: description || undefined, proposedAt: new Date(proposedAt).toISOString(), duration: Number(duration), attendeeIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The invitation could not be created.')
      setNotice(`${data.message} ${data.integration?.email ? 'Invitation email sent.' : 'Email delivery is not configured or could not be confirmed.'}`)
      setTopic(''); setDescription(''); setProposedAt(''); setDuration('30'); setAttendeeIds([]); setShowForm(false)
      await fetchMeetings()
    } catch (error) { setFormError(error instanceof Error ? error.message : 'The meeting service is temporarily unavailable.') }
    finally { setCreating(false) }
  }
  async function cancelMeeting(id: string) {
    if (confirmCancelId !== id) { setConfirmCancelId(id); return }
    setConfirmCancelId(null); setActionError(null)
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchMeetings()
    } catch { setActionError('That meeting could not be cancelled. Please try again.') }
  }
  const now = new Date()
  const upcoming = meetings.filter(m => m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && new Date(m.proposedAt) >= now)
  const past = meetings.filter(m => m.status === 'COMPLETED' || new Date(m.proposedAt) < now)

  return <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><WorkspaceBreadcrumb current="Meetings" /><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Calendar className="w-6 h-6 text-cyan-400" /> GEM Meeting Request Centre</h1>
        <p className="text-slate-400 text-sm mt-1">Invite any active team member in your organization and track meeting attendance.</p></div>
      {adminAccess && <Button size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm} className="bg-cyan-500 text-black hover:opacity-90 gap-2"><Plus className="w-4 h-4" /> New team invitation</Button>}
    </div>
    {showForm && <Card className="bg-card border-cyan-500/30"><CardHeader><CardTitle className="text-white text-sm">Create team meeting</CardTitle></CardHeader><CardContent>
      <form onSubmit={createMeeting} className="space-y-4">
        <div><label htmlFor="meeting-topic" className="text-xs text-slate-400 mb-1 block">Meeting topic</label><Input id="meeting-topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. GEM weekly operations briefing" required minLength={2} maxLength={200} className="bg-white/5 border-white/10 text-white" /></div>
        <div><label htmlFor="meeting-description" className="text-xs text-slate-400 mb-1 block">Agenda / description</label><Input id="meeting-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Purpose and preparation" maxLength={1000} className="bg-white/5 border-white/10 text-white" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="meeting-time" className="text-xs text-slate-400 mb-1 block">Date and time (your local time)</label><Input id="meeting-time" type="datetime-local" value={proposedAt} onChange={e => setProposedAt(e.target.value)} required className="bg-white/5 border-white/10 text-white" /></div>
          <div><label htmlFor="meeting-duration" className="text-xs text-slate-400 mb-1 block">Duration</label><select id="meeting-duration" value={duration} onChange={e => setDuration(e.target.value)} className="w-full h-9 rounded-md bg-slate-900 border border-white/10 text-white text-sm px-3">{[15,30,45,60,90,120,180,240].map(d => <option key={d} value={d}>{d} minutes</option>)}</select></div></div>
        <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs text-slate-300 flex items-center gap-2"><Users className="w-4 h-4" /> Invite team members ({attendeeIds.length} selected)</label><button type="button" onClick={() => setAttendeeIds(attendeeIds.length === recipients.length ? [] : recipients.map(r => r.id))} className="text-xs text-cyan-400 hover:underline">{attendeeIds.length === recipients.length ? 'Clear all' : 'Select all'}</button></div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">{recipients.map(r => <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer"><input type="checkbox" checked={attendeeIds.includes(r.id)} onChange={e => setAttendeeIds(current => e.target.checked ? [...current, r.id] : current.filter(id => id !== r.id))} className="accent-cyan-400" /><span className="min-w-0 flex-1"><span className="block text-sm text-white">{r.name}</span><span className="block text-xs text-slate-500">{r.email}</span></span><Badge className="text-xs">{r.role}</Badge></label>)}{recipients.length === 0 && <p className="p-4 text-sm text-slate-500">No other active members were found in your organization.</p>}</div>
        </div>
        <p className="text-xs text-slate-500">Invitations are sent only to selected organization members. Zoom join links are included when Zoom is connected. Joining a meeting does not activate endpoint monitoring or remote control.</p>
        {formError && <p role="alert" className="text-xs text-red-400">{formError}</p>}
        <div className="flex gap-3"><Button type="submit" disabled={creating || !attendeeIds.length || !proposedAt} className="bg-cyan-500 text-black hover:opacity-90 gap-2">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{creating ? 'Creating invitation…' : 'Create and send invitations'}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-slate-300">Close</Button></div>
      </form>
    </CardContent></Card>}
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
    {actionError && <p role="alert" className="text-xs text-red-400">{actionError}</p>}
    {loading ? <div className="flex items-center justify-center py-12 gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading meetings…</div> : loadError ? <WorkspaceErrorState title="Meetings could not be loaded" description="Your meeting schedule could not be reached." onRetry={fetchMeetings} /> : <>
      <Card className="bg-card border-white/10"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-white text-sm">Upcoming meetings</CardTitle><Button variant="ghost" size="sm" onClick={() => { fetchMeetings(); fetchRecipients() }} className="text-slate-400"><RefreshCw className="w-4 h-4" /></Button></CardHeader><CardContent>
        {upcoming.length === 0 ? <WorkspaceEmptyState title="No upcoming meetings" description={adminAccess ? "Create an invitation to any active team member in your organization." : "There are no meetings assigned to your account."} action={adminAccess ? <Button size="sm" onClick={() => setShowForm(true)} className="bg-cyan-500 text-black"><Plus className="w-4 h-4 mr-2" /> New invitation</Button> : undefined} /> :
          <div className="space-y-3">{upcoming.map(m => <div key={m.id} className="bg-white/5 rounded-lg p-4 space-y-3"><div className="flex flex-col sm:flex-row sm:justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 mb-1"><p className="text-sm font-medium text-white">{m.topic}</p><Badge className={statusColor[m.status]}>{m.status}</Badge>{m.zoomMeetingId && <Badge className="bg-cyan-500/15 text-cyan-300">Zoom linked</Badge>}</div>{m.description && <p className="text-xs text-slate-500 mb-2">{m.description}</p>}<div className="flex flex-wrap gap-3 text-xs text-slate-400"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.proposedAt).toLocaleString()}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.duration} min</span>{(m.zoomJoinUrl || m.meetingUrl) && <a href={m.zoomJoinUrl || m.meetingUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1"><Video className="w-3 h-3" /> Join Zoom</a>}</div></div>{adminAccess && m.status !== 'CANCELLED' && <Button size="sm" variant="outline" onClick={() => cancelMeeting(m.id)} className="border-red-500/30 text-red-400 shrink-0">{confirmCancelId === m.id ? 'Confirm cancel' : 'Cancel meeting'}</Button>}</div>
            {m.invitees?.length ? <div className="border-t border-white/10 pt-2"><p className="text-xs text-slate-500 mb-2">Invitees and attendance</p><div className="flex flex-wrap gap-2">{m.invitees.map(i => <Badge key={i.id} className={i.status === 'JOINED' ? 'bg-green-500/15 text-green-300' : i.status === 'LEFT' ? 'bg-slate-500/20 text-slate-300' : 'bg-yellow-500/15 text-yellow-300'}>{i.email} · {i.status}</Badge>)}</div></div> : null}
          </div>)}</div>}
      </CardContent></Card>
      {past.length > 0 && <Card className="bg-card border-white/10"><CardHeader><CardTitle className="text-white text-sm">Past meetings</CardTitle></CardHeader><CardContent><div className="space-y-2">{past.map(m => <div key={m.id} className="flex justify-between gap-3 bg-white/5 rounded-lg p-3 opacity-70"><div><p className="text-sm text-white">{m.topic}</p><p className="text-xs text-slate-500">{new Date(m.proposedAt).toLocaleString()} · {m.duration} min</p></div><Badge className={statusColor[m.status] || ''}>{m.status}</Badge></div>)}</div></CardContent></Card>}
    </>}
  </div>
}
