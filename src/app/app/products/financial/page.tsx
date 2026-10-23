"use client"

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Eye,
  Clock,
} from 'lucide-react'

const flaggedTransactions = [
  {
    id: 'TXN-9821',
    date: 'Mar 14, 2026',
    amount: '8,500',
    type: 'Wire Transfer',
    flag: 'Unusual Amount',
    severity: 'Medium',
    resolved: false,
  },
  {
    id: 'TXN-9805',
    date: 'Mar 12, 2026',
    amount: '2,200',
    type: 'ACH Debit',
    flag: 'New Counterparty',
    severity: 'Low',
    resolved: true,
  },
]

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    High: 'bg-red-500/20 text-red-400 border-red-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return <Badge className={map[severity] ?? 'bg-slate-500/20 text-slate-400'}>{severity}</Badge>
}

export default function FinancialProductPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              <span className="text-cyan-400">Financial Shield</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Asset protection and transaction monitoring.</p>
          </div>
        </div>
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-sm px-3 py-1">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Active
        </Badge>
      </div>

      <Card className="bg-slate-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Shield Protection Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Asset Monitoring', badge: 'Active', color: 'bg-green-500/20 text-green-400' },
              { label: 'Fraud Detection', badge: 'High Sensitivity', color: 'bg-cyan-500/20 text-cyan-400' },
              { label: 'Account Integrity', badge: 'Verified', color: 'bg-blue-500/20 text-blue-400' },
            ].map(({ label, badge, color }) => (
              <div key={label} className="glass-panel rounded-lg p-4 text-center">
                <p className="text-sm text-slate-400 mb-2">{label}</p>
                <Badge className={color}>{badge}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Credit Readiness Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-slate-400">
            Authorize an approved Experian API product and verify read access without storing credit-report payloads.
          </p>
          <Button asChild className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            <Link href="/app/products/financial/credit-readiness">Manage Experian connection</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <CardTitle className="text-white">Recent Flagged Transactions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {flaggedTransactions.map((txn, idx) => (
              <div key={txn.id}>
                <div className="flex items-center justify-between py-2 flex-wrap gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-cyan-400">{txn.id}</span>
                      <span className="text-xs text-slate-500">{txn.date}</span>
                    </div>
                    <p className="text-sm text-white">{txn.type} — {txn.amount}</p>
                    <p className="text-xs text-slate-400">Flag: {txn.flag}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {severityBadge(txn.severity)}
                    <Badge
                      className={
                        txn.resolved
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      }
                    >
                      {txn.resolved ? 'Resolved' : 'Under Review'}
                    </Badge>
                  </div>
                </div>
                {idx < flaggedTransactions.length - 1 && <Separator className="bg-white/5" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
