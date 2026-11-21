import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PlatformAccessDirectory } from "@/components/home/PlatformAccessDirectory";

export default function LoginDirectoryPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            GEM Enterprise home
          </Link>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Email and password access
          </span>
        </div>
      </header>
      <nav aria-label="Account help" className="mx-auto flex max-w-7xl flex-wrap gap-6 px-6 pt-6 text-sm text-cyan-300">
        <Link href="/forgot-password">Reset your GEM password</Link>
        <Link href="/request-access">Request access</Link>
      </nav>
      <PlatformAccessDirectory exclude="login" compact headingLevel={1} />
    </div>
  );
}
