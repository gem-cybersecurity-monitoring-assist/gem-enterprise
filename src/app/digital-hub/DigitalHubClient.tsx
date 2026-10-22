"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw, Unplug, Wallet } from "lucide-react";

type ProviderListener = (...args: unknown[]) => void;

type EvmProvider = {
  request: (request: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: ProviderListener) => void;
  removeListener?: (event: string, listener: ProviderListener) => void;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
};

type SolanaProvider = {
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  isConnected?: boolean;
  publicKey?: { toString: () => string };
};

type Eip6963Detail = {
  info: { uuid: string; name: string; icon?: string; rdns?: string };
  provider: EvmProvider;
};

type EvmCandidate = {
  id: string;
  name: string;
  provider: EvmProvider;
};

declare global {
  interface Window {
    ethereum?: EvmProvider & { providers?: EvmProvider[] };
    phantom?: { solana?: SolanaProvider };
  }
}

function shortAddress(value: string) {
  return value.length > 13 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function chainLabel(chainId: string | null) {
  if (!chainId) return "network unknown";
  const known: Record<string, string> = {
    "0x1": "Ethereum",
    "0x89": "Polygon",
    "0xa": "Optimism",
    "0xa4b1": "Arbitrum One",
    "0x2105": "Base",
  };
  return known[chainId.toLowerCase()] ?? `EVM chain ${Number.parseInt(chainId, 16)}`;
}

async function record(event: string, target: string) {
  try {
    await fetch("/api/digital-hub/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, target, path: window.location.pathname }),
      keepalive: true,
    });
  } catch {
    // Interaction telemetry must never block the wallet or referral action.
  }
}

export function ReferralActions({
  code,
  href,
}: {
  code: string;
  href: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    void record("referral_copy", "btcc");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="flex overflow-hidden rounded-2xl border border-lime-200/30 bg-slate-950 shadow-2xl">
        <div className="flex-1 px-6 py-5 font-mono text-2xl font-bold tracking-[0.18em] text-lime-300 sm:text-4xl">
          {code}
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="flex min-w-28 items-center justify-center gap-2 border-l border-white/10 px-5 font-semibold text-white hover:bg-white/10"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-950/10 bg-slate-950 px-6 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
      >
        Open BTCC referral <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

export function WalletConnector() {
  const [status, setStatus] = useState("Checking available wallet providers…");
  const [connected, setConnected] = useState(false);
  const [connectedTarget, setConnectedTarget] = useState<"metamask" | "phantom" | "coinbase" | "browser" | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [evmCandidates, setEvmCandidates] = useState<EvmCandidate[]>([]);
  const candidatesRef = useRef<EvmCandidate[]>([]);
  const cleanupEvmRef = useRef<(() => void) | null>(null);

  const addCandidate = useCallback((candidate: EvmCandidate) => {
    if (candidatesRef.current.some((existing) => existing.provider === candidate.provider)) return;
    candidatesRef.current = [...candidatesRef.current, candidate];
    setEvmCandidates(candidatesRef.current);
  }, []);

  const clearEvmListeners = useCallback(() => {
    cleanupEvmRef.current?.();
    cleanupEvmRef.current = null;
  }, []);

  const applyEvmSession = useCallback((
    provider: EvmProvider,
    target: "metamask" | "coinbase" | "browser",
    account: string,
    nextChainId: string | null,
  ) => {
    clearEvmListeners();
    setConnected(true);
    setConnectedTarget(target);
    setAddress(account);
    setChainId(nextChainId);
    setStatus(`Connected: ${shortAddress(account)} · ${chainLabel(nextChainId)}`);

    const accountsChanged: ProviderListener = (...args) => {
      const accounts = args[0];
      const values = Array.isArray(accounts) ? accounts.filter((item): item is string => typeof item === "string") : [];
      if (!values[0]) {
        setConnected(false);
        setConnectedTarget(null);
        setAddress(null);
        setChainId(null);
        setStatus("Wallet permission ended. Choose a wallet to reconnect.");
        return;
      }
      setAddress(values[0]);
      setStatus(`Connected: ${shortAddress(values[0])} · ${chainLabel(nextChainId)}`);
    };

    const chainChanged: ProviderListener = (...args) => {
      const value = typeof args[0] === "string" ? args[0] : null;
      setChainId(value);
      setStatus(`Connected: ${shortAddress(account)} · ${chainLabel(value)}`);
    };

    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    cleanupEvmRef.current = () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [clearEvmListeners]);

  const refreshProviders = useCallback(() => {
    candidatesRef.current = [];
    setEvmCandidates([]);

    const injected = window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : []);
    injected.forEach((provider, index) => {
      const name = provider.isCoinbaseWallet
        ? "Coinbase Wallet"
        : provider.isMetaMask
          ? "MetaMask"
          : `Browser wallet ${index + 1}`;
      addCandidate({ id: `injected-${index}-${name}`, name, provider });
    });

    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }, [addCandidate]);

  useEffect(() => {
    let active = true;

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      if (!detail?.provider || !detail.info?.uuid) return;
      addCandidate({
        id: detail.info.uuid,
        name: detail.info.name || "EVM wallet",
        provider: detail.provider,
      });
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    refreshProviders();

    void fetch("/api/digital-hub/wallet", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (active && !payload?.ok) setStatus("Wallet connection service is not ready.");
      })
      .catch(() => {
        if (active) setStatus("Wallet connection service could not be verified.");
      });

    const restore = window.setTimeout(async () => {
      for (const candidate of candidatesRef.current) {
        try {
          const result = await candidate.provider.request({ method: "eth_accounts" });
          const accounts = Array.isArray(result) ? result.filter((item): item is string => typeof item === "string") : [];
          if (!accounts[0]) continue;
          const chain = await candidate.provider.request({ method: "eth_chainId" }).catch(() => null);
          const target = candidate.provider.isCoinbaseWallet
            ? "coinbase"
            : candidate.provider.isMetaMask
              ? "metamask"
              : "browser";
          if (active) applyEvmSession(candidate.provider, target, accounts[0], typeof chain === "string" ? chain : null);
          return;
        } catch {
          // Silent restore never prompts and may legitimately find no authorized account.
        }
      }

      const phantom = window.phantom?.solana;
      if (phantom?.isConnected && phantom.publicKey && active) {
        const value = phantom.publicKey.toString();
        setConnected(true);
        setConnectedTarget("phantom");
        setAddress(value);
        setChainId("solana");
        setStatus(`Connected: ${shortAddress(value)} · Solana`);
        return;
      }

      if (active) setStatus("No authorized wallet session found. Choose a wallet to connect.");
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(restore);
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      clearEvmListeners();
    };
  }, [addCandidate, applyEvmSession, clearEvmListeners, refreshProviders]);

  async function connectEvm(kind: "metamask" | "coinbase" | "browser") {
    void record("wallet_connect_attempt", kind);
    const candidates = candidatesRef.current;
    const candidate =
      kind === "metamask"
        ? candidates.find((item) => item.provider.isMetaMask && !item.provider.isCoinbaseWallet)
        : kind === "coinbase"
          ? candidates.find((item) => item.provider.isCoinbaseWallet)
          : candidates.find((item) => !item.provider.isMetaMask && !item.provider.isCoinbaseWallet) ?? candidates[0];

    if (!candidate) {
      setStatus("That wallet is not available in this browser. Open GEM inside the wallet's browser or install its provider.");
      return;
    }

    try {
      const result = await candidate.provider.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(result) ? result.filter((item): item is string => typeof item === "string") : [];
      if (!accounts[0]) throw new Error("No public account returned");
      const chain = await candidate.provider.request({ method: "eth_chainId" }).catch(() => null);
      applyEvmSession(candidate.provider, kind, accounts[0], typeof chain === "string" ? chain : null);
      void record("wallet_connected", kind);
    } catch {
      setStatus("Wallet connection was cancelled or could not be completed.");
    }
  }

  async function connectPhantom() {
    void record("wallet_connect_attempt", "phantom");
    const provider = window.phantom?.solana;
    if (!provider) {
      setStatus("Phantom was not detected. Open GEM in Phantom's in-app browser or install Phantom.");
      return;
    }

    try {
      const result = await provider.connect();
      const value = result.publicKey?.toString();
      if (!value) throw new Error("No public account returned");
      clearEvmListeners();
      setConnected(true);
      setConnectedTarget("phantom");
      setAddress(value);
      setChainId("solana");
      setStatus(`Connected: ${shortAddress(value)} · Solana`);
      void record("wallet_connected", "phantom");
    } catch {
      setStatus("Phantom connection was cancelled or could not be completed.");
    }
  }

  function disconnectLocal() {
    const target = connectedTarget;
    clearEvmListeners();
    setConnected(false);
    setConnectedTarget(null);
    setAddress(null);
    setChainId(null);
    setStatus("Disconnected from this GEM browser session. Wallet permissions remain controlled by your wallet.");
    if (target) void record("wallet_disconnected", target);
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-[#0a2233] to-slate-950 p-6 text-white shadow-2xl sm:p-8">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-cyan-300/10 bg-cyan-300/5" />
      <div className="relative mb-6 flex items-start gap-4">
        <div className="rounded-2xl bg-lime-300 p-3 text-slate-950"><Wallet className="h-6 w-6" /></div>
        <div>
          <h3 className="text-xl font-black">Connect a wallet</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Approval stays inside the wallet. GEM does not request a seed phrase, private key, payment, signature, or transfer here.
          </p>
        </div>
      </div>

      <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => connectEvm("metamask")} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left font-semibold transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[.07]">MetaMask</button>
        <button type="button" onClick={connectPhantom} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left font-semibold transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[.07]">Phantom</button>
        <button type="button" onClick={() => connectEvm("coinbase")} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left font-semibold transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[.07]">Coinbase Wallet</button>
        <button type="button" onClick={() => connectEvm("browser")} className="rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left font-semibold transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[.07]">Other EVM wallet</button>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        <p className={`font-mono text-xs ${connected ? "text-emerald-300" : "text-slate-400"}`} aria-live="polite">
          {status}
        </p>
        <button
          type="button"
          onClick={refreshProviders}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh wallets
        </button>
        {connected ? (
          <button
            type="button"
            onClick={disconnectLocal}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/20 bg-rose-300/5 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-300/10"
          >
            <Unplug className="h-3.5 w-3.5" /> Disconnect GEM session
          </button>
        ) : null}
      </div>

      {connected && address ? (
        <div className="relative mt-4 grid gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.05] p-4 text-xs sm:grid-cols-3">
          <div><span className="text-slate-500">Provider</span><p className="mt-1 font-semibold text-white">{connectedTarget}</p></div>
          <div><span className="text-slate-500">Account</span><p className="mt-1 font-mono text-white">{shortAddress(address)}</p></div>
          <div><span className="text-slate-500">Network</span><p className="mt-1 font-semibold text-white">{chainId === "solana" ? "Solana" : chainLabel(chainId)}</p></div>
        </div>
      ) : null}

      <p className="relative mt-4 text-[11px] leading-5 text-slate-500">
        Detected EVM providers: {evmCandidates.length}. Wallet addresses are displayed only in this browser session and are not sent to GEM's event backend.
      </p>
    </div>
  );
}
