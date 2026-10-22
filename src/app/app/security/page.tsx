'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Lock, Key, Smartphone, Globe, CheckCircle2,
  Eye, EyeOff, Activity, ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { WorkspaceBreadcrumb, WorkspaceEmptyState } from '@/components/workspace/WorkspaceUi'

/**
 * Account security. Only the password workflow is live in this build:
 * session listings, MFA enrollment state, and the security log are not
 * backed by a client-visible store yet, so they render as explicit
 * not-available states instead of fabricated posture data.
 */

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
        <WorkspaceBreadcrumb current="Security" />
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Lock className="w-6 h-6 text-[hsl(var(--svc-cyber))]" />
          Security
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Account protection and authentication controls.</p>
      </div>

      {/* Password — the only live workflow on this page */}
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
              <label htmlFor="security-current-password" className="text-xs text-slate-400 block mb-1.5">Current password</label>
              <div className="relative">
                <Input
                  id="security-current-password"
                  type={showPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm pr-10"
                  required
                />
                <button
                  type="button"
                  aria-label={showPw ? 'Hide current password' : 'Show current password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 rounded"
                  onClick={() => setShowPw(v => !v)}
                >
                  {showPw ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="security-new-password" className="text-xs text-slate-400 block mb-1.5">New password</label>
              <Input
                id="security-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 12 chars, mixed case + symbols"
                autoComplete="new-password"
                aria-describedby="security-password-hint"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
                required
              />
              <p id="security-password-hint" className="mt-1 text-[11px] text-slate-600">At least 12 characters, with mixed case and symbols.</p>
            </div>
            <div>
              <label htmlFor="security-confirm-password" className="text-xs text-slate-400 block mb-1.5">Confirm new password</label>
              <Input
                id="security-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
                required
              />
            </div>
            {pwError && <p role="alert" className="text-xs text-red-400">{pwError}</p>}
            {pwSuccess && <p role="status" className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Password updated successfully.</p>}
            <Button type="submit" size="sm" disabled={pwLoading} className="bg-[hsl(var(--svc-cyber))] text-black hover:opacity-90">
              {pwLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* MFA — not yet backed by a client-visible enrollment store */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[hsl(var(--svc-financial))]" />
            Multi-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceEmptyState
            title="MFA status not connected"
            description="Multi-factor enrollment is provisioned by GEM operations for your account. Ask support to review or enroll MFA on this account."
            action={
              <Link
                href="/app/support"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Request MFA review
              </Link>
            }
          />
        </CardContent>
      </Card>

      {/* Active sessions — no client-visible session store in this build */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-[hsl(var(--svc-realty))]" />
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceEmptyState
            title="Session list not available"
            description="Active sessions are not listed in the client portal yet. If you suspect unauthorized access, change your password above and contact support immediately."
            action={
              <Link
                href="/app/support"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Report a security concern
              </Link>
            }
          />
        </CardContent>
      </Card>

      {/* Security log — no client-visible audit store in this build */}
      <Card className="bg-card border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-[hsl(var(--svc-cyber))]" />
            Security Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceEmptyState
            title="Security log not available"
            description="A client-visible security event log is not connected yet. Account-level security events are reviewed by GEM operations."
            action={
              <Link
                href="/app/support"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Ask about recent account activity
              </Link>
            }
          />
        </CardContent>
      </Card>

    </div>
  )
}
