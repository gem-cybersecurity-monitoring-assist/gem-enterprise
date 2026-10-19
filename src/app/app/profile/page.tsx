'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Mail, Building2, Globe, CheckCircle2, Shield, Edit, Loader2 } from 'lucide-react'
import { WorkspaceBreadcrumb, WorkspaceErrorState } from '@/components/workspace/WorkspaceUi'

interface Profile {
  email: string
  createdAt: string
  kycStatus: string | null
  profile: {
    firstName: string | null
    lastName: string | null
    phone: string | null
    country: string | null
    entityType: string | null
    accreditedStatus: boolean | null
  } | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const loadProfile = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const r = await fetch('/api/users/profile')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      if (d.email) {
        setProfile(d as Profile)
        setFirstName(d.profile?.firstName ?? '')
        setLastName(d.profile?.lastName ?? '')
        setPhone(d.profile?.phone ?? '')
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setSaveError(null)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setSaveError('Your changes could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const displayName = profile
    ? [profile.profile?.firstName, profile.profile?.lastName].filter(Boolean).join(' ') || profile.email
    : '—'
  const initials = profile
    ? (((profile.profile?.firstName?.[0] ?? '') + (profile.profile?.lastName?.[0] ?? '')).toUpperCase() || profile.email[0]?.toUpperCase())
    : '?'
  const kycApproved = profile?.kycStatus === 'approved'

  return (
    <div className="space-y-8">
      <div>
        <WorkspaceBreadcrumb current="Profile" />
        <h1 className="text-2xl font-bold text-white">
          Your <span className="text-gradient-primary">Profile</span>
        </h1>
        <p className="text-slate-400 mt-1">View and manage your account information.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-500" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading profile…
        </div>
      ) : loadError ? (
        <WorkspaceErrorState
          title="Profile could not be loaded"
          description="Your account information could not be reached. Try again."
          onRetry={loadProfile}
        />
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-card border-white/10">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-2xl font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold text-white">{displayName}</p>
                    <p className="text-sm text-slate-400">{profile?.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {kycApproved && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> KYC Verified
                      </Badge>
                    )}
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      <Shield className="w-3 h-3 mr-1" /> Member
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { icon: User, label: 'Full Name', value: displayName },
                  { icon: Mail, label: 'Email Address', value: profile?.email ?? '—' },
                  { icon: Building2, label: 'Entity Type', value: profile?.profile?.entityType ?? 'Not recorded' },
                  { icon: Globe, label: 'Country', value: profile?.profile?.country ?? '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-sm text-white font-medium mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
                <Separator className="bg-white/10" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">KYC Status</p>
                    <p className="text-sm font-medium text-white mt-0.5 capitalize">{profile?.kycStatus?.replace(/_/g, ' ') ?? 'Not started'}</p>
                  </div>
                  <Badge className={kycApproved ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}>
                    {kycApproved ? <CheckCircle2 className="w-3 h-3 mr-1" /> : null}
                    {kycApproved ? 'Complete' : 'Pending'}
                  </Badge>
                </div>
                {profile?.createdAt && (
                  <div>
                    <p className="text-xs text-slate-400">Member Since</p>
                    <p className="text-sm font-medium text-white mt-0.5">{new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Edit className="w-4 h-4 text-cyan-400" />
                  Update Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveProfile} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-first-name" className="text-slate-300">First Name</Label>
                      <Input id="profile-first-name" value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-last-name" className="text-slate-300">Last Name</Label>
                      <Input id="profile-last-name" value={lastName} onChange={e => setLastName(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email" className="text-slate-300">Email Address</Label>
                    <Input id="profile-email" type="email" value={profile?.email ?? ''} readOnly className="bg-white/5 border-white/10 text-white opacity-60" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-phone" className="text-slate-300">Phone Number</Label>
                    <Input id="profile-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="bg-white/5 border-white/10 text-white placeholder:text-slate-500" />
                  </div>
                  {success && <p role="status" className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Profile updated.</p>}
                  {saveError && <p role="alert" className="text-xs text-red-400">{saveError}</p>}
                  <Button type="submit" disabled={saving} className="bg-cyan-500 text-black hover:bg-cyan-400 font-semibold gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  Entity Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">Entity Type</Label>
                      <Input value={profile?.profile?.entityType ?? 'Not recorded'} className="bg-white/5 border-white/10 text-white" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">Country</Label>
                      <Input value={profile?.profile?.country ?? '—'} className="bg-white/5 border-white/10 text-white" readOnly />
                    </div>
                  </div>
                  <div className="glass-panel rounded-lg p-4">
                    <p className="text-xs text-slate-400">
                      To change your entity type or legal name, open a service request and the GEM team will handle the change with you.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="border-white/10 text-slate-300 hover:text-white hover:bg-white/10">
                    <Link href="/app/requests">Request Entity Change</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
