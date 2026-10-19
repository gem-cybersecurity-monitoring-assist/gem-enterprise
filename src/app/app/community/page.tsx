'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Users,
  MessageSquare,
  Calendar,
  ArrowRight,
  Globe,
  BookOpen,
} from 'lucide-react'

const announcements = [
  {
    title: 'Q1 2026 Threat Intelligence Briefing',
    date: 'Mar 15, 2026',
    category: 'Security',
    summary: 'Key findings from GEM SOC across ransomware trends, supply-chain vectors, and recommended mitigations for enterprise environments.',
  },
  {
    title: 'Compliance Framework Update — SOC 2 Type II',
    date: 'Mar 10, 2026',
    category: 'Compliance',
    summary: 'Updated audit procedures and control requirements for clients pursuing SOC 2 Type II certification with GEM advisory support.',
  },
  {
    title: 'Real Estate Investment Outlook — March 2026',
    date: 'Mar 5, 2026',
    category: 'Real Estate',
    summary: 'Current market analysis for commercial and multi-family assets across key US markets, with cap-rate trends and acquisition guidance.',
  },
]

const resources = [
  { icon: BookOpen, label: 'Knowledge Base', desc: 'Security guides, compliance checklists, and investment frameworks', href: '/resources' },
  { icon: Calendar, label: 'Upcoming Events', desc: 'Webinars, briefings, and client roundtables', href: '/hub' },
  { icon: Globe, label: 'Public Intelligence', desc: 'Open-source threat intelligence and market data', href: '/intel' },
]

export default function CommunityPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Community</h1>
        <p className="text-slate-400 text-sm mt-1">
          Intelligence briefings, compliance updates, and client resources.
        </p>
      </div>

      {/* Announcements */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Recent Updates</h2>
        </div>
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.title} className="bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:border-[hsl(var(--svc-cyber))]/30 transition-colors">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-xs border-[hsl(var(--border))] text-slate-400">{a.category}</Badge>
                      <span className="text-xs text-slate-500">{a.date}</span>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{a.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{a.summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Resources</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {resources.map(({ icon: Icon, label, desc, href }) => (
            <Card key={label} className="bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:border-[hsl(var(--svc-cyber))]/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="w-9 h-9 rounded-lg bg-[hsl(var(--svc-cyber-muted))] flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4 text-[hsl(var(--svc-cyber))]" />
                </div>
                <CardTitle className="text-sm text-white">{label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                <Button asChild size="sm" variant="ghost" className="w-full justify-start px-0 text-[hsl(var(--svc-cyber))] hover:text-[hsl(var(--svc-cyber))] hover:bg-transparent text-xs">
                  <Link href={href}>
                    Explore <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Team / Contacts */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Your Account Team</h2>
        <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row gap-4">
              {[
                { initials: 'AM', name: 'Account Manager', role: 'Primary contact for service requests and account questions', color: 'bg-[hsl(var(--svc-cyber-muted))] text-[hsl(var(--svc-cyber))]' },
                { initials: 'CS', name: 'Compliance Specialist', role: 'Regulatory guidance and KYC / AML advisory', color: 'bg-[hsl(var(--svc-financial-muted))] text-[hsl(var(--svc-financial))]' },
              ].map(({ initials, name, role, color }) => (
                <div key={name} className="flex items-center gap-3 flex-1">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className={`text-sm font-semibold ${color}`}>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{name}</p>
                    <p className="text-xs text-slate-500 leading-snug">{role}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
              <Button asChild size="sm" variant="outline" className="border-[hsl(var(--border))] text-slate-300 hover:text-white">
                <Link href="/app/support">
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Open Support Request
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
