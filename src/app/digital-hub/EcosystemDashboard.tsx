"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Globe2, Radio, RefreshCw, Users2, WalletCards } from "lucide-react";

type EcosystemPayload = {
  ok: boolean;
  generatedAt: string;
  brand: {
    name: string;
    publicUrl: string;
    digitalHubUrl: string;
    logo: string;
    walletReturnPath: string;
  };
  wallets: Array<{
    id: string;
    name: string;
    kind: string;
    ecosystems: readonly string[];
    connection: string;
    fallbackUrl: string;
    state: string;
  }>;
  profiles: Array<{
    id: string;
    name: string;
    kind: string;
    href: string;
    state: string;
    visibility: string;
    description: string;
    destinationKind: string;
    directProfileUrlConfigured: boolean;
  }>;
  redirects: {
    canonicalOrigin: string;
    walletReturnPath: string;
    walletReturnUrl: string;
  };
  adapters: {
    injectedEvm: boolean;
    phantomInjected: boolean;
    farcasterMiniAppRoute: boolean;
    reownAppKit: { configured: boolean; projectIdRequired: boolean; supportedExpansion: string[] };
    phantomConnect: { configured: boolean; appIdRequiredForEmbeddedProviders: boolean; injectedProviderRequiresAppId: boolean };
  };
  marketSources: Array<{ id: string; name: string; href: string; description: string }>;
  community: {
    name: string;
    href: string;
    description: string;
    communicationReferences: Array<{ name: string; state: string }>;
  };
};

type EipProvider = { isMetaMask?: boolean; isCoinbaseWallet?: boolean };
type Eip6963Event = CustomEvent<{ info?: { uuid?: string; name?: string }; provider?: EipProvider }>;

function walletRuntimeState(id: string, evmProviders: EipProvider[], phantomDetected: boolean) {
  if (id === "metamask") return evmProviders.some((provider) => provider.isMetaMask && !provider.isCoinbaseWallet) ? "detected now" : "configured";
  if (id === "coinbase") return evmProviders.some((provider) => provider.isCoinbaseWallet) ? "detected now" : "configured";
  if (id === "phantom") return phantomDetected ? "detected now" : "configured";
  if (id === "other-web3") return evmProviders.length > 0 ? `${evmProviders.length} EVM provider${evmProviders.length === 1 ? "" : "s"} detected` : "discovery ready";
  return "configured";
}

export function EcosystemDashboard() {
  const [payload, setPayload] = useState<EcosystemPayload | null>(null);
  const [apiState, setApiState] = useState<"loading" | "live" | "error">("loading");
  const [evmProviders, setEvmProviders] = useState<EipProvider[]>([]);
  const [phantomDetected, setPhantomDetected] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string>("");

  const refreshApi = useCallback(async () => {
    try {
      const response = await fetch("/api/digital-hub/ecosystem", { cache: "no-store" });
      const data = (await response.json()) as EcosystemPayload;
      if (!response.ok || !data.ok) throw new Error("ecosystem unavailable");
      setPayload(data);
      setApiState("live");
      setRefreshedAt(new Date().toLocaleTimeString());
    } catch {
      setApiState("error");
    }
  }, []);

  useEffect(() => {
    const providers: EipProvider[] = [];
    const runtimeWindow = window as typeof window & {
      ethereum?: EipProvider & { providers?: EipProvider[] };
      phantom?: { solana?: unknown };
    };
    const add = (provider?: EipProvider) => {
      if (!provider || providers.includes(provider)) return;
      providers.push(provider);
      setEvmProviders([...providers]);
    };

    (runtimeWindow.ethereum?.providers ?? (runtimeWindow.ethereum ? [runtimeWindow.ethereum] : [])).forEach(add);
    setPhantomDetected(Boolean(runtimeWindow.phantom?.solana));

    const onAnnounce = (event: Event) => {
      add((event as Eip6963Event).detail?.provider);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    void refreshApi();
    const interval = window.setInterval(() => void refreshApi(), 30_000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    };
  }, [refreshApi]);

  const readiness = useMemo(() => {
    if (!payload) return [];
    return [
      ["Injected EVM", payload.adapters.injectedEvm ? "LIVE" : "OFF"],
      ["Phantom injected", payload.adapters.phantomInjected ? "LIVE" : "OFF"],
      ["Farcaster Mini App", payload.adapters.farcasterMiniAppRoute ? "LIVE" : "REGISTRATION NEEDED"],
      ["Reown multi-wallet", payload.adapters.reownAppKit.configured ? "LIVE" : "PROJECT ID NEEDED"],
    ] as const;
  }, [payload]);

  if (!payload) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[.04] p-8 text-slate-300">
        {apiState === "error" ? "Wallet ecosystem API is unavailable." : "Loading real-time wallet ecosystem preview…"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section id="wallets" className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#071521] shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-[.72fr_1.28fr]">
          <div className="border-b border-white/10 bg-gradient-to-br from-cyan-300/10 via-transparent to-amber-300/10 p-7 lg:border-b-0 lg:border-r sm:p-9">
            <div className="flex items-center gap-4">
              <Image src={payload.brand.logo} alt="GEM Enterprise" width={64} height={64} className="rounded-2xl" />
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Verified application identity</p>
                <h3 className="mt-1 text-2xl font-black">{payload.brand.name}</h3>
              </div>
            </div>
            <p className="mt-7 text-sm leading-7 text-slate-400">
              Wallet previews use GEM's canonical production identity. Connections remain user-approved and non-custodial.
            </p>
            <div className="mt-7 space-y-2">
              {readiness.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className={`font-mono font-bold ${value === "LIVE" || value === "READY" ? "text-emerald-300" : "text-amber-300"}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Return / redirect</p>
              <p className="mt-2 break-all text-xs text-slate-300">{payload.redirects.walletReturnUrl}</p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-300">Real-time preview</p>
                <h3 className="mt-1 text-2xl font-black">Wallet connection dashboard</h3>
              </div>
              <button type="button" onClick={() => void refreshApi()} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh · {refreshedAt || "now"}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {payload.wallets.map((wallet) => {
                const runtime = walletRuntimeState(wallet.id, evmProviders, phantomDetected);
                return (
                  <article key={wallet.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Image src={payload.brand.logo} alt="" width={38} height={38} className="rounded-xl" />
                        <div>
                          <h4 className="font-bold text-white">{wallet.name}</h4>
                          <p className="mt-0.5 text-[11px] text-slate-500">{wallet.kind}</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase ${runtime.includes("detected") ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-300" : "border-cyan-300/15 bg-cyan-300/5 text-cyan-200"}`}>
                        {runtime}
                      </span>
                    </div>
                    <p className="mt-5 text-xs leading-5 text-slate-400">{wallet.connection}</p>
                    <p className="mt-3 font-mono text-[10px] text-slate-500">{wallet.ecosystems.join(" · ")}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <a href="#wallet-connect" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-slate-950">
                        Connect / inspect <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                      <a href={wallet.fallbackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5">
                        Provider <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="profiles" className="scroll-mt-24 rounded-[2rem] border border-white/10 bg-white/[.025] p-6 sm:p-8">
        <div className="mb-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Connected profiles / accounts</p>
          <h3 className="mt-1 text-2xl font-black">Existing GEM platform profiles</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            These are existing GEM-operated profiles or account destinations. A profile can exist even when an optional wallet-host or API integration is not yet registered.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {payload.profiles.map((profile) => (
            <a key={profile.id} href={`/api/digital-hub/profiles/${profile.id}`} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/25">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Image src={payload.brand.logo} alt="" width={38} height={38} className="rounded-xl" />
                  <div>
                    <h4 className="font-bold text-white">{profile.name}</h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">{profile.kind}</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 font-mono text-[9px] font-bold uppercase text-emerald-300">
                  {profile.state}
                </span>
              </div>
              <p className="mt-5 text-xs leading-5 text-slate-400">{profile.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {profile.visibility} · {profile.directProfileUrlConfigured ? "direct route" : "provider home"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200">
                  {profile.directProfileUrlConfigured ? "Open profile" : "Open provider"} <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="market-references" className="scroll-mt-24 grid gap-4 lg:grid-cols-3">
        {payload.marketSources.map((source) => (
          <a key={source.id} href={`/api/digital-hub/market/${source.id}`} target="_blank" rel="noopener noreferrer" className="group rounded-3xl border border-white/10 bg-white/[.04] p-6 transition hover:-translate-y-1 hover:border-amber-300/25">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><Radio className="h-5 w-5 text-amber-300" /></div>
              <ExternalLink className="h-4 w-4 text-slate-600 transition group-hover:text-amber-300" />
            </div>
            <h3 className="mt-8 text-xl font-black">{source.name}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">{source.description}</p>
            <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200">External market reference</p>
          </a>
        ))}
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-r from-cyan-300/10 via-white/[.03] to-violet-400/10 p-7 sm:p-9">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3"><Users2 className="h-6 w-6 text-cyan-300" /></div>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Direct community route</p>
                <h3 className="mt-1 text-2xl font-black">{payload.community.name}</h3>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">{payload.community.description}</p>
            <p className="mt-3 break-all font-mono text-[11px] text-slate-500">{payload.community.href}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {payload.community.communicationReferences.map((reference) => (
                <span key={reference.name} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-slate-300">
                  {reference.name} · {reference.state}
                </span>
              ))}
            </div>
          </div>
          <a href="/api/digital-hub/community" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-cyan-300 px-6 font-bold text-slate-950 transition hover:-translate-y-0.5">
            Open Community Hub <Globe2 className="h-4 w-4" />
          </a>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <WalletCards className="h-4 w-4" />
        API status: {apiState}. Configuration refreshes every 30 seconds; installed-wallet discovery remains browser-local.
      </div>
    </div>
  );
}
