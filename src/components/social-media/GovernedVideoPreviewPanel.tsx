"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Film,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type PreviewData = {
  content: {
    id: string;
    title: string;
    state: string;
  };
  version: {
    id: string;
    number: number;
    objectHash: string;
  };
  asset: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    checksum: string;
    storageRef: string;
  };
  governance: {
    complianceReviewId: string | null;
    complianceResult: string | null;
    approvalRequestId: string | null;
    approvalState: string | null;
    externalPublicationTaken: false;
  };
};

type PreviewResponse = {
  preview?: PreviewData | null;
  reason?: string | null;
  error?: { message?: string };
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function label(value: string | null | undefined, fallback: string) {
  return value ? value.replaceAll("_", " ") : fallback;
}

export function GovernedVideoPreviewPanel() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [contentId, setContentId] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Enter a finalized video content ID to load its authorized workspace preview.",
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("gem-social-workspace-id");
    if (saved) setWorkspaceId(saved);
  }, []);

  useEffect(() => {
    if (workspaceId) {
      window.localStorage.setItem("gem-social-workspace-id", workspaceId);
    }
  }, [workspaceId]);

  async function loadPreview() {
    if (!workspaceId.trim() || !contentId.trim()) {
      setPreview(null);
      setMessage("Enter both the workspace ID and the video content ID.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/video/content/${encodeURIComponent(contentId.trim())}/preview?workspaceId=${encodeURIComponent(workspaceId.trim())}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as PreviewResponse;
      if (!response.ok) {
        throw new Error(payload.error?.message || "The video preview could not be loaded.");
      }

      setPreview(payload.preview ?? null);
      setMessage(
        payload.preview
          ? "Verified media loaded for private operator review. Playback does not publish the video."
          : payload.reason === "CONTENT_VERSION_MISSING"
            ? "This content item does not have an active version yet."
            : "No finalized video asset is attached to the active content version yet.",
      );
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "The video preview could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-card/75 p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-violet-300" />
            <h2 className="text-lg font-bold text-white">Governed video preview</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Watch the verified video attached to an exact content version before approval or publishing. Access remains limited to an authenticated member of the same workspace.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-200/80">
          <ShieldCheck className="h-4 w-4" />
          Preview only · no external publication
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          placeholder="TokMetric workspace ID"
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/40"
        />
        <input
          value={contentId}
          onChange={(event) => setContentId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void loadPreview();
          }}
          placeholder="Finalized video content ID"
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/40"
        />
        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-violet-300 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Load preview
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              key={preview.asset.id}
              className="aspect-video w-full bg-black object-contain"
              controls
              controlsList="nodownload"
              playsInline
              preload="metadata"
            >
              <source src={preview.asset.storageRef} type={preview.asset.mimeType} />
              Your browser cannot play this video format.
            </video>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/8 bg-black/15 p-4">
              <div className="text-sm font-semibold text-white">{preview.content.title}</div>
              <div className="mt-2 text-xs leading-5 text-slate-400">
                Version {preview.version.number} · {label(preview.content.state, "Unknown state")}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Status
                label="Compliance"
                value={label(preview.governance.complianceResult, "Not reviewed")}
              />
              <Status
                label="Approval"
                value={label(preview.governance.approvalState, "Not requested")}
              />
              <Status label="Format" value={preview.asset.mimeType} />
              <Status label="File size" value={formatBytes(preview.asset.fileSize)} />
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-xs leading-5 text-slate-400">
              <div className="font-semibold text-slate-200">{preview.asset.fileName}</div>
              <div className="mt-2 break-all">
                SHA-256: <code className="text-slate-300">{preview.asset.checksum}</code>
              </div>
              <div className="mt-2 break-all">
                Version hash: <code className="text-slate-300">{preview.version.objectHash}</code>
              </div>
            </div>

            <a
              href={preview.asset.storageRef}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.05]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open verified media
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Status({ label: statusLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
        {statusLabel}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-200">{value}</div>
    </div>
  );
}
