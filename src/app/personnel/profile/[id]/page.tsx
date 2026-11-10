import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, ShieldCheck } from "lucide-react";
import { getPublicDirectory } from "@/lib/notion-public-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Approved Professional Profile | GEM Enterprise",
  description: "Individually verified and publication-approved GEM Enterprise professional profile.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ApprovedPersonProfile({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  if (!/^[a-f\d-]{32,36}$/i.test(id)) notFound();
  const directory = await getPublicDirectory();
  if (directory.status !== "ready") notFound();
  const profile = directory.profiles.find(item=>item.id===id);
  if (!profile) notFound();

  const florida = profile.licenseJurisdiction?.toLowerCase().includes("florida") ?? false;
  const hasLicense = Boolean(profile.licenseType || profile.licenseJurisdiction || profile.licenseAuthority);
  return <main className="min-h-screen bg-[#020817] px-4 py-10 text-white sm:px-6">
    <div className="mx-auto max-w-4xl space-y-7">
      <Link href="/personnel#approved-people" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-white">
        <ArrowLeft className="h-4 w-4"/> Approved public directory
      </Link>
      <header className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#132f43] to-[#091527] p-7 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-200">
          <BadgeCheck className="h-4 w-4" /> Website publication approved
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">{profile.name}</h1>
        {profile.role && <p className="mt-4 text-lg font-semibold text-cyan-200">{profile.role}</p>}
        {profile.division && <p className="mt-2 text-sm text-slate-400">{profile.division}</p>}
        {profile.bio && <p className="mt-6 text-base leading-8 text-slate-300">{profile.bio}</p>}
        <p className="mt-6 text-xs leading-6 text-slate-400">
          Publication approval is recorded by GEM's review process. Any regulated credential
          must be independently checked with the issuing authority; private evidence and
          license identifiers are never shown on this page.
        </p>
      </header>
      {hasLicense && <section className="rounded-3xl border border-emerald-300/20 bg-[#0d242a] p-7 sm:p-9">
        <div className="flex items-center gap-2 text-xl font-semibold text-emerald-200">
          <ShieldCheck className="h-5 w-5"/> Approved public license information
        </div>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            ["Type",profile.licenseType],["Authority",profile.licenseAuthority],["Jurisdiction",profile.licenseJurisdiction]
          ].filter(item=>item[1]).map(([label,value])=><div key={label}>
            <dt className="text-xs uppercase tracking-wider text-emerald-100/60">{label}</dt>
            <dd className="mt-2 text-sm text-slate-200">{value}</dd>
          </div>)}
        </dl>
        {florida && <Link href="https://www.myfloridalicense.com/wl11.asp?SID=&mode=0" target="_blank" rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 underline underline-offset-4">
          Check Florida DBPR <ArrowRight className="h-4 w-4"/>
        </Link>}
      </section>}
      <div className="rounded-3xl border border-white/10 bg-[#0b1b2b] p-7">
        <h2 className="text-xl font-bold">Contact &amp; professional enquiries</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Contact GEM through the central intake process. Staff contact details and
          restricted personnel information are not published here.
        </p>
        <Link href="/get-started" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#061323] hover:bg-cyan-300">Start an enquiry <ArrowRight className="h-4 w-4"/></Link>
      </div>
    </div>
  </main>;
}
