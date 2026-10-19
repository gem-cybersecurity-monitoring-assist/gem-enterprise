'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileText,
  FolderLock,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'

interface KycDoc {
  id: string
  documentType: string
  fileName: string
  fileSize: number
  status: string
  createdAt: string
}

type DocRow = { id: string; name: string; type: string; date: string; status: string }

function typeBadge(type: string) {
  const map: Record<string, string> = {
    agreement: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    identity: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    statement: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    compliance: 'bg-green-500/20 text-green-400 border-green-500/30',
    proof_of_address: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  }
  const key = type.toLowerCase()
  const cls = map[key] ?? 'bg-white/10 text-slate-300 border-white/10'
  return <Badge className={cls}>{type.replace(/_/g, ' ')}</Badge>
}

function DocsTable({ docs }: { docs: DocRow[] }) {
  if (docs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <Archive className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">No documents in this category.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
            <TableHead className="text-slate-400">Name</TableHead>
            <TableHead className="text-slate-400">Type</TableHead>
            <TableHead className="text-slate-400">Date</TableHead>
            <TableHead className="text-slate-400">Status</TableHead>
            <TableHead className="text-slate-400">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map(doc => (
            <TableRow key={doc.id} className="border-white/5 hover:bg-white/5">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                    <FileText className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-white">{doc.name}</span>
                    <span className="font-mono text-[11px] text-slate-600">{doc.id.slice(0, 10)}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{typeBadge(doc.type)}</TableCell>
              <TableCell className="text-sm text-slate-400">{doc.date}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-xs capitalize text-green-400">{doc.status}</span>
                </div>
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white" disabled>
                  <Download className="h-3 w-3" /> Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.documents) && d.documents.length > 0) {
          setDocs((d.documents as KycDoc[]).map(doc => ({
            id: doc.id,
            name: doc.fileName,
            type: doc.documentType,
            date: new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: doc.status,
          })))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const kycDocs = docs.filter(d => ['identity', 'proof_of_address'].includes(d.type.toLowerCase()))
  const compliance = docs.filter(d => ['compliance', 'agreement'].includes(d.type.toLowerCase()))
  const statements = docs.filter(d => d.type.toLowerCase() === 'statement')

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <FolderLock className="h-3.5 w-3.5" />
            Encrypted Document Vault
          </div>
          <h1 className="text-2xl font-bold text-white">
            Your <span className="text-gradient-primary">Documents</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Access KYC evidence, compliance records, statements, agreements, and institutional files through the existing document API.
          </p>
        </div>
        <Button disabled className="gap-2 rounded-full bg-cyan-400 text-black hover:bg-cyan-500 disabled:opacity-60">
          <UploadCloud className="h-4 w-4" /> Upload Coming Soon
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Documents', value: loading ? '…' : String(docs.length), icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'KYC / Identity', value: loading ? '…' : String(kycDocs.length), icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Statements', value: loading ? '…' : String(statements.length), icon: FileText, color: 'text-[hsl(var(--svc-financial))]', bg: 'bg-[hsl(var(--svc-financial-muted))]' },
          { label: 'Compliance', value: loading ? '…' : String(compliance.length), icon: FileCheck2, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="glass-panel bento-card rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-cyan-400" />
              Document Library
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            ) : docs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                <FolderLock className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                <p className="text-sm font-medium text-white">No documents available yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  Documents will appear here once your KYC is complete or institutional records are added to your profile.
                </p>
              </div>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="mb-6 border border-white/10 bg-white/5">
                  {['all', 'kyc', 'statements', 'compliance'].map(tab => (
                    <TabsTrigger key={tab} value={tab} className="capitalize data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                      {tab === 'kyc' ? 'KYC' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="all"><DocsTable docs={docs} /></TabsContent>
                <TabsContent value="kyc"><DocsTable docs={kycDocs} /></TabsContent>
                <TabsContent value="statements"><DocsTable docs={statements} /></TabsContent>
                <TabsContent value="compliance"><DocsTable docs={compliance} /></TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-5">
            <div className="mb-3 flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-cyan-400" />
              <p className="text-sm font-semibold text-cyan-400">Vault Controls</p>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Document records are displayed from the current document API and grouped for verification, compliance, statement, and agreement workflows.
            </p>
          </div>

          {[
            ['KYC Evidence', 'Identity and proof-of-address documents'],
            ['Compliance Records', 'Agreements, approvals, and notices'],
            ['Statements', 'Portfolio and service reporting files'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
