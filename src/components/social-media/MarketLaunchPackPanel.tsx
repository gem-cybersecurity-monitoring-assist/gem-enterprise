"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Download, ExternalLink, FileImage, ShieldCheck } from "lucide-react";

type MarketLaunchAsset = {
  id: string;
  path: string;
  format: string;
  placement: string[];
  alt: string;
};

type MarketLaunchChannel = {
  provider: string;
  source: string;
  medium: string;
  status: "DRAFT";
  caption: string;
  mediaIds: string[];
};

type MarketLaunchManifest = {
  campaignId: string;
  campaignName: string;
  status: "DRAFT_NOT_PUBLISHED";
  ownerApprovalRequired: true;
  primaryLandingPage: string;
  priceUSD: number;
  offerScope: string;
  media: MarketLaunchAsset[];
  channels: MarketLaunchChannel[];
  trackingLinks: Array<{ source: string; medium: string; campaign: string; url: string }>;
  releaseGates: string[];
};

export function MarketLaunchPackPanel({ campaign }: { campaign: MarketLaunchManifest }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function copyText(key: string, value: string) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
    } catch {
      setCopyError("Clipboard access is unavailable. Select and copy the text manually.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Governed launch pack</p>
            <h2 className="mt-2 text-xl font-bold text-white">{campaign.campaignName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{campaign.offerScope}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-300/20 px-3 py-1.5 text-xs font-semibold text-amber-100">
            <ShieldCheck className="h-4 w-4" /> Draft · not published
          </span>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Every item remains a draft. Copying text or downloading artwork does not publish anything or authorize ad spend.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={campaign.primaryLandingPage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.05]">
            Open business review <ExternalLink className="h-4 w-4" />
          </a>
          <a href="/market-launch/founding-first-20.json" download className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.05]">
            Download campaign manifest <Download className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-white">Creative assets</h3>
          <p className="mt-1 text-sm text-slate-400">Original SVG source files. Render to the target network's supported format before upload.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaign.media.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card/75">
              <div className="aspect-[4/5] overflow-hidden bg-slate-950">
                <Image src={asset.path} alt={asset.alt} width={1080} height={asset.format === "1080x1920" ? 1920 : asset.format === "1080x1080" ? 1080 : 1350} unoptimized className="h-full w-full object-contain" loading="lazy" />
              </div>
              <div className="space-y-2 p-4">
                <p className="font-semibold text-white">{asset.id.replaceAll("-", " ")}</p>
                <p className="text-xs text-slate-400">{asset.format} · {asset.placement.join(", ")}</p>
                <p className="text-xs leading-5 text-slate-500">{asset.alt}</p>
                <a href={asset.path} download className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                  <Download className="h-4 w-4" /> Download SVG
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-white">Channel copy</h3>
          <p className="mt-1 text-sm text-slate-400">Copy the approved draft into the provider's native composer only after account and content approval.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {campaign.channels.map((channel) => (
            <article key={channel.provider} className="rounded-2xl border border-white/10 bg-card/75 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold text-white">{channel.provider.replaceAll("_", " ")}</h4>
                <span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-100">{channel.status}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{channel.caption}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void copyText(channel.provider, channel.caption)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
                  {copied === channel.provider ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === channel.provider ? "Caption copied" : "Copy caption"}
                </button>
                {campaign.trackingLinks.some((link) => link.source === channel.source) ? (
                  <button type="button" onClick={() => { const link = campaign.trackingLinks.find((item) => item.source === channel.source); if (link) void copyText(`${channel.provider}-link`, link.url); }} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10">
                    {copied === `${channel.provider}-link` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === `${channel.provider}-link` ? "Link copied" : "Copy tracked CTA link"}
                  </button>
                ) : null}
              </div>
              {channel.mediaIds.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Linked creative files</p>
                  <div className="flex flex-wrap gap-3">
                    {channel.mediaIds.map((assetId) => {
                      const asset = campaign.media.find((item) => item.id === assetId);
                      return asset ? <a key={assetId} href={asset.path} download className="inline-flex items-center gap-2 text-xs font-medium text-cyan-200 hover:text-cyan-100"><FileImage className="h-4 w-4" />{assetId}</a> : null;
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {copyError ? <p role="status" className="text-sm text-amber-100">{copyError}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-card/75 p-5">
        <h3 className="font-bold text-white">Release checklist</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
          {campaign.releaseGates.map((gate) => <li key={gate} className="flex gap-2"><span className="text-cyan-200">•</span><span>{gate}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
