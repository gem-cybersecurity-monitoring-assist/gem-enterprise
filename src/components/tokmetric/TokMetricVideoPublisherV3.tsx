"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Square,
  UploadCloud,
} from "lucide-react";
import {
  chunkByteRange,
  type TikTokChunkPlan,
  type TikTokCreatorInfo,
  type TikTokPrivacyLevel,
  type TikTokPublishStatus,
  type TikTokVideoSource,
} from "@/lib/tokmetric/publishing/types";
import { GemVideoPlayer } from "@/components/video/GemVideoPlayer";

type WorkspaceContext = {
  id: string;
  name: string;
  globalEmergencyLock: boolean;
  publishingDisabled: boolean;
  connectors: Array<{
    id: string;
    displayName: string;
    externalAccountId: string | null;
    grantedScopes: string[];
  }>;
  contents: Array<{ id: string; title: string }>;
};

type PublishingContext = {
  gate: {
    environment: "sandbox" | "production";
    enabled: boolean;
    mode: "production" | "sandbox" | "disabled";
    configurationMismatch?: boolean;
  };
  verifiedMediaHosts: string[];
  workspaces: WorkspaceContext[];
};

type InitResult = {
  jobId: string;
  publishId: string;
  uploadUrl: string | null;
  chunkPlan: TikTokChunkPlan | null;
  source: TikTokVideoSource;
  processingNotice: string;
};

type StatusResult = TikTokPublishStatus & {
  jobId: string;
  internalState: string;
  externalState: string;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

const MUSIC_CONFIRMATION_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_CONTENT_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";
const FOUR_GIB = 4 * 1024 * 1024 * 1024;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.ok || payload.data === undefined) {
    throw new Error(payload?.error?.message ?? "The request could not be completed.");
  }
  return payload.data;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function readVideoMetadata(file: File): Promise<{
  durationSec?: number;
  width?: number;
  height?: number;
}> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (value: { durationSec?: number; width?: number; height?: number }) => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish({
      durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
    });
    video.onerror = () => finish({});
    video.src = objectUrl;
  });
}

async function uploadChunkWithRetry(
  uploadUrl: string,
  file: File,
  plan: TikTokChunkPlan,
  index: number,
) {
  const range = chunkByteRange(plan, index);
  const chunk = file.slice(range.start, range.end + 1, file.type);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "Content-Range": `bytes ${range.start}-${range.end}/${plan.videoSize}`,
      },
      body: chunk,
    });
    if ([200, 201, 206].includes(response.status)) return;
    if (response.status < 500 || attempt === 3) {
      throw new Error(`TikTok rejected upload chunk ${index + 1} with HTTP ${response.status}.`);
    }
    await wait(750 * 2 ** (attempt - 1));
  }
}

async function uploadChunks(
  uploadUrl: string,
  plan: TikTokChunkPlan,
  file: File,
  reportProgress: (percent: number) => void,
) {
  for (let index = 0; index < plan.totalChunkCount; index += 1) {
    await uploadChunkWithRetry(uploadUrl, file, plan, index);
    reportProgress(Math.round(((index + 1) / plan.totalChunkCount) * 100));
  }
}

export function TokMetricVideoPublisherV3() {
  const [context, setContext] = useState<PublishingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [connectorId, setConnectorId] = useState("");
  const [contentId, setContentId] = useState("");
  const [creator, setCreator] = useState<TikTokCreatorInfo | null>(null);
  const [source, setSource] = useState<TikTokVideoSource>("FILE_UPLOAD");
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [durationSec, setDurationSec] = useState<number | undefined>();
  const [videoWidth, setVideoWidth] = useState<number | undefined>();
  const [videoHeight, setVideoHeight] = useState<number | undefined>();
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState<TikTokPrivacyLevel | "">("");
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [commercialContent, setCommercialContent] = useState(false);
  const [brandContentToggle, setBrandContentToggle] = useState(false);
  const [brandOrganicToggle, setBrandOrganicToggle] = useState(false);
  const [isAigc, setIsAigc] = useState(false);
  const [consentToUpload, setConsentToUpload] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [musicRightsConfirmed, setMusicRightsConfirmed] = useState(false);
  const [processingNoticeAccepted, setProcessingNoticeAccepted] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<TikTokVideoSource | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const workspace = useMemo(
    () => context?.workspaces.find((item) => item.id === workspaceId) ?? null,
    [context, workspaceId],
  );

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<PublishingContext>("/api/tokmetric/publishing/context");
      setContext(data);
      const initial = data.workspaces[0];
      if (initial) {
        setWorkspaceId(initial.id);
        setConnectorId(initial.connectors[0]?.id ?? "");
        setContentId(initial.contents[0]?.id ?? "");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Publishing context could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const blocked =
    !context?.gate.enabled ||
    Boolean(workspace?.globalEmergencyLock) ||
    Boolean(workspace?.publishingDisabled);
  const commercialSelectionValid =
    !commercialContent || brandContentToggle || brandOrganicToggle;
  const brandedPrivacyInvalid =
    brandContentToggle && privacyLevel === "SELF_ONLY";
  const durationInvalid = Boolean(
    creator && durationSec && durationSec > creator.maxVideoPostDurationSec,
  );
  const fileSizeInvalid = Boolean(file && file.size > FOUR_GIB);
  const dimensionsInvalid = Boolean(
    videoWidth && videoHeight &&
    (videoWidth < 360 || videoHeight < 360 || videoWidth > 4096 || videoHeight > 4096),
  );
  const confirmationsComplete =
    consentToUpload &&
    rightsConfirmed &&
    musicRightsConfirmed &&
    processingNoticeAccepted;
  const canPublish =
    !busy &&
    !blocked &&
    Boolean(creator) &&
    Boolean(privacyLevel) &&
    confirmationsComplete &&
    commercialSelectionValid &&
    !brandedPrivacyInvalid &&
    !durationInvalid &&
    !fileSizeInvalid &&
    !dimensionsInvalid;

  function resetPostControls() {
    setPrivacyLevel("");
    setAllowComment(false);
    setAllowDuet(false);
    setAllowStitch(false);
    setCommercialContent(false);
    setBrandContentToggle(false);
    setBrandOrganicToggle(false);
    setConsentToUpload(false);
    setRightsConfirmed(false);
    setMusicRightsConfirmed(false);
    setProcessingNoticeAccepted(false);
    setActiveJobId(null);
    setActiveSource(null);
    setPublishId(null);
    setStatus(null);
    setProgress(0);
  }

  function changeWorkspace(nextWorkspaceId: string) {
    const next = context?.workspaces.find((item) => item.id === nextWorkspaceId);
    setWorkspaceId(nextWorkspaceId);
    setConnectorId(next?.connectors[0]?.id ?? "");
    setContentId(next?.contents[0]?.id ?? "");
    setCreator(null);
    resetPostControls();
  }

  async function queryCreator() {
    if (!workspaceId || !connectorId) return;
    setBusy(true);
    setError("");
    setMessage("Querying the latest TikTok creator settings…");
    try {
      const data = await api<TikTokCreatorInfo>("/api/tokmetric/publishing/creator-info", {
        method: "POST",
        body: JSON.stringify({ workspaceId, connectorId }),
      });
      setCreator(data);
      resetPostControls();
      setMessage(`Connected as ${data.creatorNickname} (@${data.creatorUsername}). Select every post setting manually.`);
    } catch (requestError) {
      setMessage("");
      setError(requestError instanceof Error ? requestError.message : "Creator settings could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    setDurationSec(undefined);
    setVideoWidth(undefined);
    setVideoHeight(undefined);
    setProgress(0);
    if (!nextFile) {
      setLocalPreviewUrl("");
      return;
    }
    setLocalPreviewUrl(URL.createObjectURL(nextFile));
    const metadata = await readVideoMetadata(nextFile);
    setDurationSec(metadata.durationSec);
    setVideoWidth(metadata.width);
    setVideoHeight(metadata.height);
  }

  function setCommercialDisclosure(enabled: boolean) {
    setCommercialContent(enabled);
    if (!enabled) {
      setBrandContentToggle(false);
      setBrandOrganicToggle(false);
    }
  }

  function setThirdPartyBrandedContent(enabled: boolean) {
    setBrandContentToggle(enabled);
    if (enabled && privacyLevel === "SELF_ONLY") setPrivacyLevel("");
  }

  async function refreshStatus(jobId = activeJobId) {
    if (!jobId || !workspaceId) return null;
    const next = await api<StatusResult>("/api/tokmetric/publishing/status", {
      method: "POST",
      body: JSON.stringify({ workspaceId, jobId }),
    });
    setStatus(next);
    setMessage(`TikTok status: ${next.status}. Processing can take several minutes.`);
    return next;
  }

  async function pollStatus(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const next = await refreshStatus(jobId);
      if (next?.isFinal) return next;
      await wait(5000);
    }
    throw new Error("TikTok is still processing the video. Use Refresh status to continue checking.");
  }

  async function startPublish() {
    if (!creator) return setError("Query the latest TikTok creator settings first.");
    if (!workspaceId || !connectorId || !contentId) return setError("Select a workspace, account, and approved content item.");
    if (!privacyLevel) return setError("Manually select a TikTok privacy level.");
    if (source === "FILE_UPLOAD" && !file) return setError("Select an MP4, MOV, or WebM video.");
    if (source === "PULL_FROM_URL" && !videoUrl) return setError("Enter a verified HTTPS video URL.");
    if (!commercialSelectionValid) return setError("Select Your brand, Branded content, or both.");
    if (brandedPrivacyInvalid) return setError("Branded content cannot use SELF ONLY visibility.");

    setBusy(true);
    setError("");
    setStatus(null);
    setProgress(0);
    setMessage("Initializing the TikTok publishing request…");
    try {
      const initialized = await api<InitResult>("/api/tokmetric/publishing/init", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          workspaceId,
          contentId,
          connectorId,
          title,
          privacyLevel,
          disableComment: creator.commentDisabled || !allowComment,
          disableDuet: creator.duetDisabled || !allowDuet,
          disableStitch: creator.stitchDisabled || !allowStitch,
          brandContentToggle: commercialContent && brandContentToggle,
          brandOrganicToggle: commercialContent && brandOrganicToggle,
          isAigc,
          source,
          file: file ? { name: file.name, mimeType: file.type, size: file.size, durationSec } : undefined,
          videoUrl: source === "PULL_FROM_URL" ? videoUrl : undefined,
          consentToUpload,
          rightsConfirmed,
          musicRightsConfirmed,
          processingNoticeAccepted,
        }),
      });
      setActiveJobId(initialized.jobId);
      setActiveSource(initialized.source);
      setPublishId(initialized.publishId);

      if (initialized.source === "FILE_UPLOAD") {
        if (!file || !initialized.uploadUrl || !initialized.chunkPlan) {
          throw new Error("TikTok did not return a complete upload session.");
        }
        setMessage("Uploading the selected video directly to TikTok…");
        await uploadChunks(initialized.uploadUrl, initialized.chunkPlan, file, setProgress);
        await api("/api/tokmetric/publishing/upload-complete", {
          method: "POST",
          body: JSON.stringify({ workspaceId, jobId: initialized.jobId }),
        });
      }

      setMessage(initialized.processingNotice);
      const finalStatus = await pollStatus(initialized.jobId);
      if (finalStatus?.succeeded) {
        setMessage("TikTok confirmed that the publishing workflow completed.");
      } else if (finalStatus?.isFinal) {
        setError(finalStatus.failReason ?? `TikTok finished with status ${finalStatus.status}.`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Publishing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function manuallyRefreshStatus() {
    if (!activeJobId) return;
    setBusy(true);
    setError("");
    try {
      await refreshStatus(activeJobId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Status refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelUrlDownload() {
    if (!activeJobId || activeSource !== "PULL_FROM_URL") return;
    setBusy(true);
    setError("");
    try {
      await api("/api/tokmetric/publishing/cancel", {
        method: "POST",
        body: JSON.stringify({ workspaceId, jobId: activeJobId }),
      });
      setMessage("TikTok accepted the best-effort request to cancel the URL download.");
      setStatus(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The URL download could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 p-6 text-white/60">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading video publishing controls…
      </div>
    );
  }

  if (!context) {
    return (
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6 text-amber-100">
        Sign in with an authorized GEM Enterprise account to use publishing.
      </div>
    );
  }

  const sandbox = context.gate.mode === "sandbox";
  const previewSource = source === "FILE_UPLOAD" ? localPreviewUrl : videoUrl;
  const thirdPartyDisclosureDisabled = sandbox;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">TikTok Direct Post workflow</p>
          <h2 className="mt-2 text-2xl font-bold">Publish a real video through TikTok</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
            The selected video is transmitted only after the latest creator settings are loaded and every required post choice and consent is completed manually.
          </p>
        </div>
        <div className={`rounded-xl border px-4 py-3 text-sm ${blocked ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}`}>
          {blocked ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <CheckCircle2 className="mr-2 inline h-4 w-4" />}
          {context.gate.mode.toUpperCase()} · {blocked ? "Publishing blocked" : "Publishing enabled"}
        </div>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        <label className="text-sm text-white/65">
          Workspace
          <select value={workspaceId} onChange={(event) => changeWorkspace(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#091019] px-3 py-3 text-white">
            <option value="">Select workspace</option>
            {context.workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-white/65">
          TikTok account
          <select value={connectorId} onChange={(event) => { setConnectorId(event.target.value); setCreator(null); resetPostControls(); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#091019] px-3 py-3 text-white">
            <option value="">Select connected account</option>
            {workspace?.connectors.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.externalAccountId ?? "account"}</option>)}
          </select>
        </label>
        <label className="text-sm text-white/65">
          Approved content
          <select value={contentId} onChange={(event) => setContentId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#091019] px-3 py-3 text-white">
            <option value="">Select approved content</option>
            {workspace?.contents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      </div>

      <button type="button" onClick={() => void queryCreator()} disabled={busy || !connectorId} className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-[#071019] disabled:opacity-40">
        <RefreshCw className="mr-2 inline h-4 w-4" />
        Query creator settings
      </button>
      {creator && (
        <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-sm text-white/65">
          Posting to <strong className="text-white">{creator.creatorNickname}</strong> (@{creator.creatorUsername}) · maximum video duration {creator.maxVideoPostDurationSec}s. No post setting has been preselected.
        </div>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-white/10 bg-[#091019] p-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
            {(["FILE_UPLOAD", "PULL_FROM_URL"] as TikTokVideoSource[]).map((value) => (
              <button key={value} type="button" onClick={() => { setSource(value); setProgress(0); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${source === value ? "bg-cyan-300 text-[#071019]" : "text-white/55"}`}>
                {value === "FILE_UPLOAD" ? "Local video file" : "Verified video URL"}
              </button>
            ))}
          </div>

          {source === "FILE_UPLOAD" ? (
            <label className="block text-sm text-white/65">
              MP4, MOV, or WebM
              <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-dashed border-white/15 p-4" />
              {file && <span className="mt-2 block text-xs text-white/45">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB{durationSec ? ` · ${durationSec.toFixed(1)}s` : ""}{videoWidth && videoHeight ? ` · ${videoWidth}×${videoHeight}` : ""}</span>}
            </label>
          ) : (
            <label className="block text-sm text-white/65">
              Verified HTTPS video URL
              <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white" placeholder="https://verified-domain.example/video.mp4" />
              <span className="mt-2 block text-xs text-white/45">Configured properties: {context.verifiedMediaHosts.join(", ") || "none"}</span>
            </label>
          )}

          <div>
            <p className="text-sm font-medium text-white/70">Video preview</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {previewSource ? (
                <GemVideoPlayer
                  src={previewSource}
                  title="TikTok video preview"
                  description="Private preview of the video selected for the governed TikTok publishing workflow."
                  providerHint="native"
                  allowLocalObjectUrl={source === "FILE_UPLOAD"}
                  className="rounded-none border-0"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-white/35">Select a video to preview it before posting.</div>
              )}
            </div>
          </div>

          <label className="block text-sm text-white/65">
            Editable caption, hashtags, and mentions
            <textarea value={title} onChange={(event) => setTitle(event.target.value)} maxLength={2200} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white" />
            <span className="mt-1 block text-right text-xs text-white/35">{title.length}/2200</span>
          </label>

          <label className="block text-sm text-white/65">
            Privacy level — manual selection required
            <select value={privacyLevel} onChange={(event) => setPrivacyLevel(event.target.value as TikTokPrivacyLevel | "")} disabled={!creator} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white disabled:opacity-40">
              <option value="">Select privacy</option>
              {(creator?.privacyLevelOptions ?? []).map((value) => {
                const disabledBySandbox = sandbox && value !== "SELF_ONLY";
                const disabledByBrand = brandContentToggle && value === "SELF_ONLY";
                return <option key={value} value={value} disabled={disabledBySandbox || disabledByBrand}>{value.replaceAll("_", " ")}</option>;
              })}
            </select>
            {sandbox && <span className="mt-2 block text-xs text-amber-200/70">Unaudited sandbox posting is restricted to SELF ONLY and requires a private test account.</span>}
          </label>
        </div>

        <div className="space-y-6 rounded-2xl border border-white/10 bg-[#091019] p-5">
          <div>
            <h3 className="font-semibold">Interaction permissions</h3>
            <p className="mt-1 text-xs text-white/45">Nothing is enabled by default. Select each interaction you want to allow.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className={`flex items-start gap-2 rounded-xl border border-white/10 p-3 text-sm ${creator?.commentDisabled ? "text-white/30" : "text-white/60"}`}>
                <input type="checkbox" checked={allowComment} disabled={!creator || creator.commentDisabled} onChange={(event) => setAllowComment(event.target.checked)} className="mt-0.5" />
                Allow comments{creator?.commentDisabled ? " (disabled in TikTok settings)" : ""}
              </label>
              <label className={`flex items-start gap-2 rounded-xl border border-white/10 p-3 text-sm ${creator?.duetDisabled ? "text-white/30" : "text-white/60"}`}>
                <input type="checkbox" checked={allowDuet} disabled={!creator || creator.duetDisabled} onChange={(event) => setAllowDuet(event.target.checked)} className="mt-0.5" />
                Allow Duet{creator?.duetDisabled ? " (disabled in TikTok settings)" : ""}
              </label>
              <label className={`flex items-start gap-2 rounded-xl border border-white/10 p-3 text-sm ${creator?.stitchDisabled ? "text-white/30" : "text-white/60"}`}>
                <input type="checkbox" checked={allowStitch} disabled={!creator || creator.stitchDisabled} onChange={(event) => setAllowStitch(event.target.checked)} className="mt-0.5" />
                Allow Stitch{creator?.stitchDisabled ? " (disabled in TikTok settings)" : ""}
              </label>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Content disclosure</h3>
            <label className="mt-3 flex gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/65">
              <input type="checkbox" checked={commercialContent} onChange={(event) => setCommercialDisclosure(event.target.checked)} className="mt-0.5" />
              This content promotes a brand, product, service, or my own business.
            </label>
            {commercialContent && (
              <div className="mt-3 space-y-3 pl-2">
                <label className="flex gap-3 text-sm text-white/60">
                  <input type="checkbox" checked={brandOrganicToggle} onChange={(event) => setBrandOrganicToggle(event.target.checked)} />
                  Your brand — promotes me or my own business. The post will be labelled “Promotional content.”
                </label>
                <label className={`flex gap-3 text-sm ${thirdPartyDisclosureDisabled ? "text-white/30" : "text-white/60"}`}>
                  <input type="checkbox" checked={brandContentToggle} disabled={thirdPartyDisclosureDisabled} onChange={(event) => setThirdPartyBrandedContent(event.target.checked)} />
                  Branded content — promotes another brand or third party. The post will be labelled “Paid partnership.”
                </label>
                {thirdPartyDisclosureDisabled && <p className="text-xs text-amber-200/70">Branded content cannot use SELF ONLY visibility, so it is unavailable during unaudited sandbox posting.</p>}
                {!commercialSelectionValid && <p className="text-xs text-red-300">Select Your brand, Branded content, or both.</p>}
              </div>
            )}
          </div>

          <label className="flex gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/60">
            <input type="checkbox" checked={isAigc} onChange={(event) => setIsAigc(event.target.checked)} className="mt-0.5" />
            This video contains AI-generated content and should receive TikTok’s AI-generated label.
          </label>

          <div>
            <h3 className="font-semibold">Required confirmations</h3>
            <div className="mt-3 space-y-3">
              <label className="flex gap-3 text-sm text-white/60"><input type="checkbox" checked={consentToUpload} onChange={(event) => setConsentToUpload(event.target.checked)} className="mt-0.5" />I expressly consent to send this selected video to TikTok now.</label>
              <label className="flex gap-3 text-sm text-white/60"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5" />I own this video or have permission to publish every visual element in it.</label>
              <label className="flex gap-3 text-sm text-white/60">
                <input type="checkbox" checked={musicRightsConfirmed} onChange={(event) => setMusicRightsConfirmed(event.target.checked)} className="mt-0.5" />
                <span>
                  By posting, I agree to TikTok’s <a href={MUSIC_CONFIRMATION_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Music Usage Confirmation</a>
                  {brandContentToggle && <> and <a href={BRANDED_CONTENT_POLICY_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Branded Content Policy</a></>}.
                </span>
              </label>
              <label className="flex gap-3 text-sm text-white/60"><input type="checkbox" checked={processingNoticeAccepted} onChange={(event) => setProcessingNoticeAccepted(event.target.checked)} className="mt-0.5" />I understand the post may take several minutes to process and appear on the TikTok profile.</label>
            </div>
          </div>
        </div>
      </div>

      {(durationInvalid || fileSizeInvalid || dimensionsInvalid || brandedPrivacyInvalid) && (
        <div className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-200">
          {durationInvalid && <p>The selected video exceeds this creator’s current maximum duration.</p>}
          {fileSizeInvalid && <p>The selected video exceeds TikTok’s 4 GB maximum.</p>}
          {dimensionsInvalid && <p>Video width and height must each be between 360 and 4096 pixels.</p>}
          {brandedPrivacyInvalid && <p>Branded content cannot use SELF ONLY visibility.</p>}
        </div>
      )}

      {(message || error || progress > 0 || status) && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          {message && <p className="text-sm text-cyan-100">{message}</p>}
          {error && <p className="mt-1 text-sm text-red-300">{error}</p>}
          {progress > 0 && progress < 100 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300" style={{ width: `${progress}%` }} /></div>}
          {publishId && <p className="mt-2 text-xs text-white/40">TikTok publish ID: {publishId}</p>}
          {status && <p className="mt-1 text-xs text-white/40">Internal: {status.internalState} · External: {status.externalState} · Uploaded: {status.uploadedBytes ?? "—"} bytes</p>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => void startPublish()} disabled={!canPublish} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#071019] disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : source === "FILE_UPLOAD" ? <UploadCloud className="mr-2 inline h-4 w-4" /> : <Send className="mr-2 inline h-4 w-4" />}
          Send video to TikTok
        </button>
        <button type="button" onClick={() => void manuallyRefreshStatus()} disabled={busy || !activeJobId} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/70 disabled:opacity-40">
          <RefreshCw className="mr-2 inline h-4 w-4" />
          Refresh status
        </button>
        {activeSource === "PULL_FROM_URL" && activeJobId && !status?.isFinal && (
          <button type="button" onClick={() => void cancelUrlDownload()} disabled={busy} className="rounded-xl border border-red-300/20 px-4 py-3 text-sm font-semibold text-red-200 disabled:opacity-40">
            <Square className="mr-2 inline h-4 w-4" />
            Cancel URL download
          </button>
        )}
      </div>
    </section>
  );
}
