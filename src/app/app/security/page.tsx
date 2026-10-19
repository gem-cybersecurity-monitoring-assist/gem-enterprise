'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Lock, ShieldCheck, Key, Smartphone, Globe, CheckCircle2,
  AlertCircle, Clock, LogOut, Eye, EyeOff, Activity,
} from 'lucide-react'
import { useState } from 'react'

// TODO(v2): replace mock sessions with real server-side session store data
const sessions = [
  { id: 1, device: 'Chrome / macOS',    ip: '203.0.113.42', location: 'New York, US',   lastActive: 'Now',       current: true },
  { id: 2, device: 'Safari / iPhone 15', ip: '203.0.113.43', location: 'New York, US',  lastActive: '3h ago',    current: false },
  { id: 3, device: 'Chrome / Windows',  ip: '198.51.100.22', location: 'Miami, US',     lastActive: '2 days ago', current: false },
]

// TODO(v2): replace with audit log entries from /api/developers/logs
const securityEvents = [
  { icon: CheckCircle2, color: 'text-green-400',  text: 'Password changed successfully.',    at: '2026-02-20' },
  { icon: CheckCircle2, color: 'text-green-400',  text: 'MFA device enrolled.',              at: '2026-01-15' },
  { icon: AlertCircle,  color: 'text-yellow-400', text: 'Unrecognized login attempt — blocked.', at: '2026-01-03' },
  { icon: CheckCircle2, color: 'text-green-400',  text: 'Account created.',                  at: '2025-09-01' },
]

export default function SecurityPage() {
  const [showPw, setShowPw] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (newPassword.length < 12) {
      setPwError('New password must be at least 12 characters.')
      return
    }

    setPwLoading(true)
    try {
      const res = await fetch('/api/users/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwError(data.error || 'Failed to update password.')
      } else {
        setPwSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setPwError('Network error. Please try again.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Lock className="w-6 h-6 text-[hsl(var(--svc-cyber))]" />
          Security
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Account protection, authentication, and session management.</p>
      </div>

      {/* Security score */}
      <div className="glass-panel rounded-xl p-5 svc-cyber-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[hsl(var(--svc-cyber))]" />
            <p className="text-sm font-semibold text-white">Security Score</p>
          </div>
          <Badge className="bg-[hsl(var(--svc-cyber-muted))] text-[hsl(var(--svc-cyber))] border-0">Strong</Badge>
        </div>
        <p className="text-4xl font-bold text-white">82<span className="text-xl text-slate-400">/100</span></p>
        <div className="progress-track mt-3">
          <div className="progress-fill-cyber h-full rounded-full" style={{ width: '82%' }} />
        </div>
        <p className="text-xs text-slate-400 mt-2">Enable SMS backup to reach 100.</p>
      </div>

      {/* Password */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-[hsl(var(--svc-cyber))]" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Current password</label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm pr-10"
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">New password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 12 chars, mixed case + symbols"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Confirm new password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
                required
              />
            </div>
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Password updated successfully.</p>}
            <Button type="submit" size="sm" disabled={pwLoading} className="bg-[hsl(var(--svc-cyber))] text-black hover:opacity-90">
              {pwLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* MFA */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[hsl(var(--svc-financial))]" />
            Multi-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Authenticator app',  note: 'Google Authenticator / Authy', enabled: true },
            { label: 'SMS backup code',    note: '+1 (555) ••• ••47',            enabled: false },
          ].map(({ label, note, enabled }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-white">{label}</p>
                <p className="text-xs text-slate-500">{note}</p>
              </div>
              <Badge className={enabled ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-white/5 text-slate-400 border-white/10'}>
                {enabled ? 'Active' : 'Add'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Active sessions */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-[hsl(var(--svc-realty))]" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sessions.map(s => (
            <div key={s.id}>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white">{s.device}</p>
                    {s.current && <Badge className="bg-[hsl(var(--svc-cyber-muted))] text-[hsl(var(--svc-cyber))] border-0 text-[10px]">This device</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.ip} · {s.location} · {s.lastActive}</p>
                </div>
                {!s.current && (
                  <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Revoke
                  </Button>
                )}
              </div>
              <Separator className="bg-white/5 last:hidden" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security log */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-[hsl(var(--svc-cyber))]" />
            Security Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {securityEvents.map(({ icon: Icon, color, text, at }, i) => (
            <div key={i}>
              <div className="flex items-center gap-3 py-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                <p className="flex-1 text-sm text-slate-300">{text}</p>
                <span className="text-xs text-slate-500">{at}</span>
              </div>
              {i < securityEvents.length - 1 && <Separator className="bg-white/5" />}
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  )
}
