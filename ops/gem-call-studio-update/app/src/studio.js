import { initSceneControls } from "./scene-controls.js";
import { singleFlight, pollSequential } from "./fast-flow.js";
const readOnce = singleFlight();
const refreshOnce = singleFlight();
import { initVirtualTeam, assessFullBodyReadiness } from "./virtual-team.js";
import { createDecartClient, models } from "@decartai/sdk";
import OBSWebSocket from "obs-websocket-js";
import { SessionState, requireTransition } from "./session-state.js";
import { createLocalAvatarProcessor } from "./local-avatar.js";
import { createBodyPuppetProcessor } from "./pose-puppet.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const events = [];
let virtualTeam;
let sceneState;
const obs = new OBSWebSocket();
const modelName = "lucy-2.5";
const model = models.realtime(modelName);

let state = SessionState.IDLE;
let localStream = null;
let remoteStream = null;
let realtimeClient = null;
let referenceImage = null;
let networkReport = null;
let sessionStartedAt = null;
let timerHandle = null;
let watchdogHandle = null;
let differenceHandle = null;
let relayHandle = null;
let relayBusy = false;
let remoteCurrentTime = 0;
let remoteProgressAt = 0;
let sdkState = "disconnected";
let lowDifferenceSamples = 0;
let frameValidationPassed = false;
let bridgePublisher = null;
let obsConfig = null;
let obsConnected = false;
let shuttingDown = false;
let activeEngine = "none";
let localProcessor = null;
let failoverInProgress = false;
let avatarTrackingReady = false;
let avatarAutoFallbackHandle = null;
let startTransactionInProgress = false;

const gates = {
  backend: { label: "Local backend healthy", status: "wait", detail: "Checking" },
  engine: { label: "Trusted engine selected", status: "wait", detail: "Standby" },
  key: { label: "Lucy credential (optional for local)", status: "wait", detail: "Checking" },
  image: { label: "Authorized reference image (Avatar/Lucy)", status: "wait", detail: "Optional" },
  preflight: { label: "Selected engine preflight acceptable", status: "wait", detail: "Not tested" },
  remote: { label: "Verified engine MediaStream received", status: "wait", detail: "Waiting" },
  advancing: { label: "Verified frames advancing", status: "wait", detail: "Waiting" },
  distinct: { label: "Output differs from physical camera", status: "wait", detail: "Waiting" },
  bridge: { label: "OBS browser bridge live", status: "wait", detail: "Waiting" },
  virtualCamera: { label: "OBS Virtual Camera running", status: "wait", detail: "Not checked" }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function log(message, type = "info", details = null) {
  events.unshift({ timestamp: new Date().toISOString(), message, type, details });
  events.splice(250);
  if ($("#eventLog")) {
    $("#eventLog").innerHTML = events.map((event) => `
      <div class="event ${event.type}"><strong>${escapeHtml(event.type.toUpperCase())}</strong> · ${escapeHtml(event.message)}<br><small>${new Date(event.timestamp).toLocaleTimeString()}</small></div>
    `).join("");
  }
  console[type === "error" ? "error" : "log"](message, details || "");
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2200);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const request = () => fetch(path, {
    cache: "no-store", ...options, headers,
    signal: options.signal || AbortSignal.timeout(path === "/api/obs/diagnostics" ? 20000 : 10000)
  });
  const readOnly = !options.method || options.method.toUpperCase() === "GET";
  const response = readOnly ? (await readOnce(path, request)).clone() : await request();
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function transition(next, message = "") {
  state = requireTransition(state, next);
  $("#sessionState").textContent = next.replaceAll("-", " ");
  if (message) $("#sessionMessage").textContent = message;
  updateControls();
}

function forceState(next, message = "") {
  state = next;
  $("#sessionState").textContent = next.replaceAll("-", " ");
  if (message) $("#sessionMessage").textContent = message;
  updateControls();
}

function setGate(name, status, detail) {
  gates[name] = { ...gates[name], status, detail };
  renderGates();
}

function renderGates() {
  $("#gateList").innerHTML = Object.values(gates).map((gate) => `
    <div class="gate ${gate.status}"><span>${escapeHtml(gate.label)}</span><strong>${escapeHtml(gate.detail)}</strong></div>
  `).join("");
}

function updateControls() {
  const active = [SessionState.PREFLIGHT, SessionState.CAMERA_READY, SessionState.CONNECTING, SessionState.CONNECTED, SessionState.GENERATING, SessionState.RECONNECTING, SessionState.DEGRADED].includes(state);
  $("#connect").disabled = active || startTransactionInProgress;
  $("#apply").disabled = activeEngine !== "lucy" || !realtimeClient || !referenceImage;
  $("#disconnect").disabled = !active && !localStream;
}

function setOutputBadge(label, css) {
  $("#outputBadge").textContent = label;
  $("#outputBadge").className = `mini-badge ${css}`;
}

async function clearTransformedOutput(reason, level = "warning") {
  try { localProcessor?.stop(reason); } catch {}
  localProcessor = null;
  try { remoteStream?.getTracks().forEach((track) => track.stop()); } catch {}
  remoteStream = null;
  $("#remoteVideo").srcObject = null;
  $("#outputPlaceholder").classList.remove("hidden");
  $("#outputPlaceholder").textContent = `${reason}. The physical camera is not substituted.`;
  setOutputBadge("NO VERIFIED OUTPUT", level === "error" ? "bad" : "warn");
  frameValidationPassed = false;
  avatarTrackingReady = false;
  clearTimeout(avatarAutoFallbackHandle);
  avatarAutoFallbackHandle = null;
  lowDifferenceSamples = 0;
  clearInterval(relayHandle);
  relayHandle = null;
  setGate("remote", "wait", "Unavailable");
  setGate("advancing", "wait", "Unavailable");
  setGate("distinct", "wait", "Unavailable");
  setGate("bridge", "wait", "Stopped");
  $("#frameValidation").textContent = "Unavailable";
  $("#bridgeState").textContent = "Stopped";
  try { await bridgePublisher?.stop(reason); } catch {}
  bridgePublisher = null;
  await api("/api/bridge/clear", { method: "POST", body: JSON.stringify({ reason }) }).catch(() => {});
}

function waitForIce(peer, timeoutMs = 6000) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = () => {
      if (peer.iceGatheringState === "complete") {
        clearTimeout(timer);
        peer.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    peer.addEventListener("icegatheringstatechange", done);
  });
}

class ObsBridgePublisher {
  constructor(stream) {
    this.stream = stream;
    this.peer = null;
    this.sessionId = crypto.randomUUID();
    this.stopped = false;
  }

  async start() {
    this.peer = new RTCPeerConnection({ iceServers: [] });
    for (const track of this.stream.getTracks()) this.peer.addTrack(track, this.stream);
    this.peer.addEventListener("connectionstatechange", () => {
      const current = this.peer?.connectionState || "closed";
      $("#bridgeState").textContent = current;
      api("/api/bridge/state", {
        method: "POST",
        body: JSON.stringify({ side: "publisher", sessionId: this.sessionId, state: current })
      }).catch(() => {});
      if (current === "connected") setGate("bridge", "pass", "Connected");
      if (["failed", "closed", "disconnected"].includes(current)) setGate("bridge", "fail", current);
    });

    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    await waitForIce(this.peer);
    await api("/api/bridge/offer", {
      method: "POST",
      body: JSON.stringify({ sessionId: this.sessionId, description: this.peer.localDescription })
    });

    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (this.stopped) throw new Error("Bridge stopped");
      const answer = await api(`/api/bridge/answer?sessionId=${encodeURIComponent(this.sessionId)}`).catch(() => null);
      if (answer?.description) {
        await this.peer.setRemoteDescription(answer.description);
        $("#bridgeState").textContent = "negotiated";
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("OBS browser source did not answer the WebRTC bridge.");
  }

  async stop(reason = "stopped") {
    this.stopped = true;
    try { this.peer?.close(); } catch {}
    this.peer = null;
    await api("/api/bridge/state", {
      method: "POST",
      body: JSON.stringify({ side: "publisher", sessionId: this.sessionId, state: "stopped", reason })
    }).catch(() => {});
  }
}

async function startBridge(stream) {
  await bridgePublisher?.stop("replaced").catch(() => {});
  bridgePublisher = new ObsBridgePublisher(stream);
  $("#bridgeState").textContent = "negotiating";
  setGate("bridge", "wait", "Negotiating");
  try {
    await bridgePublisher.start();
    log("High-performance local WebRTC bridge negotiated with the OBS browser source.", "success");
  } catch (error) {
    try { await bridgePublisher?.stop("negotiation failed"); } catch {}
    bridgePublisher = null;
    log(`OBS WebRTC bridge pending: ${error.message}. AI-only JPEG compatibility relay remains available.`, "warning");
    $("#bridgeState").textContent = "compatibility relay";
    setGate("bridge", "wait", "Compatibility relay");
  }
}

async function sendCompatibilityFrame() {
  const video = $("#remoteVideo");
  if (!remoteStream || video.readyState < 2 || !video.videoWidth || relayBusy || !frameValidationPassed) return;
  relayBusy = true;
  try {
    const canvas = sendCompatibilityFrame.canvas || (sendCompatibilityFrame.canvas = document.createElement("canvas"));
    canvas.width = 1280;
    canvas.height = 720;
    canvas.getContext("2d", { alpha: false }).drawImage(video, 0, 0, 1280, 720);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (blob) await fetch("/api/stage-frame", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob, cache: "no-store" });
  } catch {} finally { relayBusy = false; }
}

function startCompatibilityRelay() {
  clearInterval(relayHandle);
  relayHandle = setInterval(sendCompatibilityFrame, 200);
}

async function refreshDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const microphones = devices.filter((device) => device.kind === "audioinput");
    $("#cameraDevice").innerHTML = cameras.map((device, index) => `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(device.label || `Camera ${index + 1}`)}</option>`).join("");
    $("#audioDevice").innerHTML = microphones.map((device, index) => `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(device.label || `Microphone ${index + 1}`)}</option>`).join("");
    log(`Devices enumerated without opening camera or microphone: ${cameras.length} camera(s), ${microphones.length} microphone(s).`, "success");
  } catch (error) {
    log(`Device enumeration failed: ${error.message}`, "error");
  }
}

async function getToken() {
  return api("/api/realtime-token", { method: "POST", body: JSON.stringify({ model: modelName }) });
}

async function runNetworkPreflight() {
  forceState(SessionState.PREFLIGHT, "Testing Decart signalling and WebRTC transport…");
  const token = await getToken();
  const client = createDecartClient({ apiKey: token.apiKey });
  const report = await client.realtime.checkConnectivity();
  networkReport = report;
  $("#networkQuality").textContent = report.quality || "Unknown";
  $("#networkTransport").textContent = report.metrics?.transport || "Unknown";
  $("#networkRtt").textContent = report.metrics?.rttMs == null ? "—" : `${Math.round(report.metrics.rttMs)} ms`;
  const acceptable = ["good", "fair", "poor"].includes(report.quality) && report.metrics?.transport !== "failed";
  if (acceptable) {
    setGate("preflight", report.quality === "poor" ? "wait" : "pass", `${report.quality} · ${report.metrics?.transport || "unknown"}`);
    $("#networkNotice").textContent = report.quality === "poor"
      ? "The connection is poor. Transformation may reconnect, but the Studio will never expose the physical camera as AI output."
      : "Connection preflight passed.";
    log(`Network preflight: ${report.quality}; transport ${report.metrics?.transport || "unknown"}.`, report.quality === "poor" ? "warning" : "success", report);
  } else {
    setGate("preflight", "fail", `${report.quality || "failed"} · ${report.metrics?.transport || "failed"}`);
    $("#networkNotice").textContent = `Connection blocked: ${(report.reasons || []).join(", ") || "WebRTC transport failed"}.`;
    log("Network preflight failed. The transformation will remain fail-closed.", "error", report);
  }
  forceState(SessionState.IDLE, acceptable ? "Preflight complete. Start the transformation when ready." : "Fix the network before starting.");
  return { token, client, report, acceptable };
}

async function createInputStream() {
  const videoConstraints = {
    deviceId: $("#cameraDevice").value ? { exact: $("#cameraDevice").value } : undefined,
    width: { ideal: model.width, min: Math.min(model.width, 640) },
    height: { ideal: model.height, min: Math.min(model.height, 360) },
    frameRate: model.fps
  };
  const audioConstraints = $("#sendAudio").checked ? {
    deviceId: $("#audioDevice").value ? { exact: $("#audioDevice").value } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1
  } : false;
  const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
  const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
  $("#modelCapture").textContent = `${settings.width || model.width}×${settings.height || model.height} @ ${settings.frameRate || model.fps}`;
  return stream;
}

function createTrustedLocalProcessedStream(stream) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const source = $("#localVideo");
  let stopped = false;
  let animationId = 0;

  const render = () => {
    if (stopped) return;
    const width = canvas.width;
    const height = canvas.height;
    context.fillStyle = "#06111f";
    context.fillRect(0, 0, width, height);

    if (source.readyState >= 2 && source.videoWidth > 0) {
      const frameX = 38;
      const frameY = 64;
      const frameWidth = width - 76;
      const frameHeight = height - 102;
      const sourceRatio = source.videoWidth / source.videoHeight;
      const targetRatio = frameWidth / frameHeight;
      let sx = 0;
      let sy = 0;
      let sw = source.videoWidth;
      let sh = source.videoHeight;
      if (sourceRatio > targetRatio) {
        sw = source.videoHeight * targetRatio;
        sx = (source.videoWidth - sw) / 2;
      } else {
        sh = source.videoWidth / targetRatio;
        sy = (source.videoHeight - sh) / 2;
      }

      context.save();
      context.filter = "brightness(1.05) contrast(1.08) saturate(1.06)";
      context.drawImage(source, sx, sy, sw, sh, frameX, frameY, frameWidth, frameHeight);
      context.restore();

      context.fillStyle = "rgba(0, 21, 45, 0.82)";
      context.fillRect(0, 0, width, 50);
      context.fillRect(0, height - 28, width, 28);
      context.strokeStyle = "rgba(255, 191, 0, 0.92)";
      context.lineWidth = 3;
      context.strokeRect(frameX, frameY, frameWidth, frameHeight);
      context.fillStyle = "#ffffff";
      context.font = "700 18px Segoe UI, Arial, sans-serif";
      context.fillText("GEM VERIFIED LOCAL", 24, 32);
      context.fillStyle = "#ffbf00";
      context.font = "600 13px Segoe UI, Arial, sans-serif";
      context.fillText("FREE · LOCAL PROCESSING · NO CLOUD INFERENCE", width - 355, 31);
    }

    animationId = requestAnimationFrame(render);
  };

  render();
  const processed = canvas.captureStream(30);
  for (const track of stream.getAudioTracks()) processed.addTrack(track.clone());

  return {
    stream: processed,
    stop() {
      stopped = true;
      cancelAnimationFrame(animationId);
      processed.getTracks().forEach((track) => track.stop());
    }
  };
}

async function startLocalTrustedTransformation(reason = "Free-first trusted route") {
  if (!$("#consent").checked) throw new Error("Confirm authorized camera and voice use.");
  activeEngine = "local";
  sdkState = "local";
  $("#sdkState").textContent = "Local";
  $("#engineState").textContent = "Trusted Local";
  $("#networkQuality").textContent = "Local";
  $("#networkTransport").textContent = "No cloud";
  $("#networkRtt").textContent = "0 ms";
  setGate("engine", "pass", "Trusted Local");
  setGate("key", "pass", "Not required (local)");
  setGate("image", "pass", "Not required (local)");
  setGate("preflight", "pass", "Local · no cloud");

  forceState(SessionState.PREFLIGHT, "Preparing free local trusted processing.");
  localStream = await createInputStream();
  $("#localVideo").srcObject = localStream;
  await $("#localVideo").play().catch(() => {});
  forceState(SessionState.CAMERA_READY, "Camera ready. Building a separate processed output stream.");
  forceState(SessionState.CONNECTING, "Starting trusted local processor.");

  localProcessor = createTrustedLocalProcessedStream(localStream);
  remoteStream = localProcessor.stream;
  $("#remoteVideo").srcObject = remoteStream;
  $("#outputPlaceholder").classList.add("hidden");
  await $("#remoteVideo").play().catch(() => {});
  remoteProgressAt = Date.now();
  setGate("remote", "pass", "Local processed stream");
  setOutputBadge("VALIDATING LOCAL", "warn");
  forceState(SessionState.GENERATING, "Local processed stream received. Validating frame movement and camera separation.");
  startWatchdog();
  startCompatibilityRelay();
  updateControls();
  log(`Trusted local engine started: ${reason}. Raw camera is not bridged to OBS.`, "success");
}

async function startBodyPuppetDemo() {
  const profile = virtualTeam?.selected();
  if (!profile?.authorized || !profile?.fullBodyConfirmed || !profile.images?.length)
    throw new Error("Save and select an authorized full-body team member first.");
  activeEngine = "puppet";
  sdkState = "pose-2d";
  avatarTrackingReady = false;
  $("#sdkState").textContent = "Local 2D Pose";
  $("#engineState").textContent = "2D MOTION DEMO";
  $("#networkQuality").textContent = "Local";
  $("#networkTransport").textContent = "No cloud";
  setGate("engine", "pass", "2D preview, not photoreal");
  setGate("key", "pass", "No key needed");
  setGate("image", "pass", "Saved reference");
  setGate("preflight", "pass", "Local pose tracking");
  forceState(SessionState.PREFLIGHT, "Preparing free 2D motion demonstration.");
  localStream = await createInputStream();
  $("#localVideo").srcObject = localStream;
  await $("#localVideo").play().catch(() => {});
  forceState(SessionState.CAMERA_READY, "Capturing movement without sharing the raw camera.");
  forceState(SessionState.CONNECTING, "Loading the local full-body pose model.");
  const scene = sceneState?.background();
  localProcessor = await createBodyPuppetProcessor({
    sourceVideo: $("#localVideo"),
    referenceFile: profile.images[0],
    backgroundFile: scene?.file || profile.background,
    onTrackingChange(tracked) {
      avatarTrackingReady = tracked;
      frameValidationPassed = false;
      if (tracked) {
        setGate("remote", "pass", "Body tracking active");
        setOutputBadge("2D MOTION DEMO", "warn");
      } else {
        setGate("remote", "wait", "Body tracking unavailable");
        setGate("distinct", "wait", "Waiting for tracking");
        setOutputBadge("TRACKING WAIT", "warn");
        if (bridgePublisher) {
          bridgePublisher.stop("body tracking lost").catch(() => {});
          bridgePublisher = null;
          api("/api/bridge/clear", {method:"POST",body:JSON.stringify({reason:"body tracking lost"})}).catch(() => {});
        }
      }
    }
  });
  remoteStream = localProcessor.stream;
  $("#remoteVideo").srcObject = remoteStream;
  $("#outputPlaceholder").classList.add("hidden");
  await $("#remoteVideo").play().catch(() => {});
  remoteProgressAt = Date.now();
  forceState(SessionState.GENERATING, "2D presenter preview active; photorealistic animation is unavailable.");
  startWatchdog();
  startCompatibilityRelay();
  updateControls();
  log("Local 2D body-motion demonstration started without raw camera forwarding.","success");
}

async function startLocalAvatarTransformation(reason = "Free face-tracked avatar route") {
  if (!$("#consent").checked) throw new Error("Confirm authorized camera, image and voice use.");
  if (!referenceImage) throw new Error("Local Avatar requires an authorized reference portrait.");

  activeEngine = "avatar";
  sdkState = "local-avatar";
  avatarTrackingReady = false;
  $("#sdkState").textContent = "Local Avatar";
  $("#engineState").textContent = "Local Avatar";
  $("#networkQuality").textContent = "Local";
  $("#networkTransport").textContent = "On-device";
  $("#networkRtt").textContent = "0 ms";
  setGate("engine", "pass", "Local Avatar");
  setGate("key", "pass", "Not required (local)");
  setGate("image", "pass", "Authorized portrait loaded");
  setGate("preflight", "pass", "MediaPipe · on-device");

  forceState(SessionState.PREFLIGHT, "Loading the self-hosted face-tracking engine.");
  localStream = await createInputStream();
  $("#localVideo").srcObject = localStream;
  await $("#localVideo").play().catch(() => {});
  forceState(SessionState.CAMERA_READY, "Camera ready. Initializing face-tracked avatar output.");
  forceState(SessionState.CONNECTING, "Starting local avatar tracker.");

  localProcessor = await createLocalAvatarProcessor({
    sourceVideo: $("#localVideo"),
    sourceStream: localStream,
    referenceFile: referenceImage,
    onTrackingChange(tracking) {
      avatarTrackingReady = tracking;
      frameValidationPassed = false;
      lowDifferenceSamples = 0;
      if (tracking) {
        clearTimeout(avatarAutoFallbackHandle);
        avatarAutoFallbackHandle = null;
        setGate("remote", "pass", "Face tracked · avatar active");
        setGate("distinct", "wait", "Validating avatar output");
        setOutputBadge("VALIDATING AVATAR", "warn");
        log("Local Avatar acquired face tracking.", "success");
      } else {
        setGate("remote", "wait", "Face tracking unavailable");
        setGate("distinct", "wait", "Waiting for tracked face");
        setOutputBadge("TRACKING WAIT", "warn");
        $("#frameValidation").textContent = "Face tracking required";
        if (bridgePublisher) {
          bridgePublisher.stop("avatar tracking lost").catch(() => {});
          bridgePublisher = null;
          api("/api/bridge/clear", { method: "POST", body: JSON.stringify({ reason: "avatar tracking lost" }) }).catch(() => {});
        }
      }
    }
  });

  remoteStream = localProcessor.stream;
  $("#remoteVideo").srcObject = remoteStream;
  $("#outputPlaceholder").classList.add("hidden");
  await $("#remoteVideo").play().catch(() => {});
  remoteProgressAt = Date.now();
  setGate("remote", "wait", "Waiting for face tracking");
  setOutputBadge("TRACKING WAIT", "warn");
  forceState(SessionState.GENERATING, "Local Avatar is running. OBS remains gated until face tracking and frame validation pass.");
  startWatchdog();
  startCompatibilityRelay();
  updateControls();
  log(`Local Avatar engine started: ${reason}. Face landmarks and rendering remain on-device.`, "success");
}

function samplePixels(video, mirror = false) {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const canvas = samplePixels.canvas || (samplePixels.canvas = document.createElement("canvas"));
  canvas.width = 32;
  canvas.height = 18;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.save();
  context.clearRect(0, 0, 32, 18);
  if (mirror) {
    context.translate(32, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0, 32, 18);
  context.restore();
  return context.getImageData(0, 0, 32, 18).data;
}

function normalizedDifference(first, second) {
  if (!first || !second || first.length !== second.length) return null;
  let total = 0;
  let samples = 0;
  for (let index = 0; index < first.length; index += 16) {
    const firstGray = (first[index] + first[index + 1] + first[index + 2]) / 3;
    const secondGray = (second[index] + second[index + 1] + second[index + 2]) / 3;
    total += Math.abs(firstGray - secondGray) / 255;
    samples += 1;
  }
  return samples ? total / samples : null;
}

async function validateFrameDifference() {
  if (!remoteStream || !localStream) return;
  if ((activeEngine === "avatar" || activeEngine === "puppet") && !avatarTrackingReady) {
    frameValidationPassed = false;
    $("#frameValidation").textContent = "Face tracking required";
    setGate("distinct", "wait", "Waiting for tracked face");
    setOutputBadge("TRACKING WAIT", "warn");
    return;
  }
  const local = samplePixels($("#localVideo"), false);
  const remote = samplePixels($("#remoteVideo"), false);
  const remoteMirrored = samplePixels($("#remoteVideo"), true);
  const direct = normalizedDifference(local, remote);
  const mirrored = normalizedDifference(local, remoteMirrored);
  const difference = Math.min(direct ?? 1, mirrored ?? 1);
  if (!Number.isFinite(difference)) return;

  if (difference < 0.025) lowDifferenceSamples += 1;
  else lowDifferenceSamples = 0;

  if (lowDifferenceSamples >= 3) {
    frameValidationPassed = false;
    $("#frameValidation").textContent = "IDENTICAL OUTPUT DETECTED";
    setGate("distinct", "fail", "Matches local camera");
    setOutputBadge("REJECTED", "bad");
    await clearTransformedOutput("Validation rejected an output matching the physical camera", "error");
    forceState(SessionState.FAILED, "The output matched the local camera and was blocked from OBS.");
    log("Output integrity gate rejected identical camera frames.", "error", { difference });
    return;
  }

  frameValidationPassed = true;
  $("#frameValidation").textContent = `Distinct · ${(difference * 100).toFixed(1)}%`;
  setGate("distinct", "pass", `${(difference * 100).toFixed(1)}% difference`);
  setOutputBadge(activeEngine === "puppet" ? "2D MOTION DEMO" : activeEngine === "lucy" ? "VERIFIED LUCY" : activeEngine === "avatar" ? "VERIFIED AVATAR" : "VERIFIED LOCAL", activeEngine === "puppet" ? "warn" : "good");
  if (!bridgePublisher && remoteStream) {
    await startBridge(remoteStream);
  }
}

function startWatchdog() {
  clearInterval(watchdogHandle);
  clearInterval(differenceHandle);
  remoteCurrentTime = 0;
  remoteProgressAt = Date.now();
  watchdogHandle = setInterval(async () => {
    if (!remoteStream || shuttingDown) return;
    const video = $("#remoteVideo");
    const progressing = video.currentTime > remoteCurrentTime + 0.02 && video.readyState >= 2 && video.videoWidth > 0;
    if (progressing) {
      remoteCurrentTime = video.currentTime;
      remoteProgressAt = Date.now();
      setGate("advancing", "pass", "Frames moving");
      return;
    }
    const stalledMs = Date.now() - remoteProgressAt;
    if (stalledMs > 7000) {
      setGate("advancing", "fail", `Stalled ${Math.round(stalledMs / 1000)}s`);
      if (state === SessionState.GENERATING) transition(SessionState.DEGRADED, activeEngine === "lucy"
        ? "Lucy frames stalled; waiting for the Decart SDK recovery sequence."
        : "Local processed frames stalled; verified output has been stopped.");
      await clearTransformedOutput("Verified engine frames stalled", "error");
    }
  }, 1500);
  differenceHandle = setInterval(() => validateFrameDifference().catch(() => {}), 2500);
}

function beginTimer() {
  sessionStartedAt = Date.now();
  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    const seconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
    $("#sessionTimer").textContent = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
    const limit = Number($("#maxDuration").value || 0);
    if (limit && seconds >= limit) disconnect("Automatic duration guard");
  }, 500);
}

function attachSdkEvents(client) {
  client.on?.("connectionChange", (next) => {
    sdkState = next;
    $("#sdkState").textContent = next;
    log(`Decart SDK state: ${next}.`);
    if (next === "connected" && state === SessionState.CONNECTING) transition(SessionState.CONNECTED, "Connected; waiting for transformed frames.");
    if (next === "generating") {
      if ([SessionState.CONNECTING, SessionState.CONNECTED, SessionState.RECONNECTING, SessionState.DEGRADED].includes(state)) forceState(SessionState.GENERATING, "Lucy 2.5 is generating verified transformed frames.");
    }
    if (next === "reconnecting") {
      if ([SessionState.CONNECTED, SessionState.GENERATING, SessionState.DEGRADED].includes(state)) forceState(SessionState.RECONNECTING, "Decart SDK is reconnecting automatically. No camera fallback will be exposed.");
      setOutputBadge("SDK RECONNECTING", "warn");
    }
    if (next === "disconnected" && !shuttingDown) {
      if (activeEngine === "lucy" && $("#allowLocalFallback")?.checked) {
        failoverToLocal("Lucy session disconnected").catch((error) => {
          log(`Trusted local failover failed: ${error.message}`, "error");
        });
      } else {
        clearTransformedOutput("Decart session disconnected", "error").catch(() => {});
        forceState(SessionState.FAILED, "The Decart session disconnected. Start a trusted engine again.");
      }
    }
  });

  client.on?.("connectionQuality", (report) => {
    $("#networkQuality").textContent = report.quality || "Unknown";
    $("#networkTransport").textContent = report.limitingFactor || "none";
    if (report.quality === "critical") {
      log(`Critical in-session quality: ${report.limitingFactor || "unknown"}.`, "error", report);
    }
  });

  client.on?.("stats", (stats) => {
    const latency = stats?.glassToGlass?.medianMs ?? stats?.glassToGlass?.g2gMs ?? stats?.rttMs;
    $("#latencyMetric").textContent = latency == null ? "—" : `${Math.round(latency)} ms`;
  });

  client.on?.("error", (error) => {
    log(`Decart SDK error: ${error?.message || "unknown error"}.`, "error", error);
  });
}

async function startLucyTransformation() {
  if (!$("#consent").checked) throw new Error("Confirm authorized camera, image and voice use.");
  if (!referenceImage) throw new Error("Choose an authorized reference portrait for Lucy.");
  activeEngine = "lucy";
  $("#engineState").textContent = "Lucy 2.5";
  setGate("engine", "pass", "Lucy 2.5");
  setGate("image", "pass", "Authorized portrait loaded");

  const preflight = await runNetworkPreflight();
  if (!preflight.acceptable) throw new Error("Network preflight failed. The system will not start a misleading session.");

  transition(SessionState.PREFLIGHT, "Preparing exact Lucy 2.5 camera constraints.");
  localStream = await createInputStream();
  $("#localVideo").srcObject = localStream;
  await $("#localVideo").play().catch(() => {});
  transition(SessionState.CAMERA_READY, "Camera ready. Connecting securely with a short-lived token.");
  transition(SessionState.CONNECTING, "Connecting to Lucy 2.5…");

  realtimeClient = await preflight.client.realtime.connect(localStream, {
    model,
    mirror: "auto",
    preferredVideoCodec: "vp8",
    debugQuality: true,
    initialState: {
      prompt: { text: $("#prompt").value.trim(), enhance: $("#enhance").checked },
      image: referenceImage
    },
    onRemoteStream: async (stream) => {
      if (stream === localStream || stream.getVideoTracks()[0]?.id === localStream.getVideoTracks()[0]?.id) {
        await clearTransformedOutput("Remote stream identity matched the local camera", "error");
        forceState(SessionState.FAILED, "Unsafe identical stream rejected.");
        return;
      }
      remoteStream = stream;
      $("#remoteVideo").srcObject = stream;
      $("#outputPlaceholder").classList.add("hidden");
      await $("#remoteVideo").play().catch(() => {});
      remoteProgressAt = Date.now();
      setGate("remote", "pass", "Remote stream received");
      setOutputBadge("VALIDATING", "warn");
      forceState(SessionState.GENERATING, "Transformed stream received. Validating frame movement and identity difference.");
      startWatchdog();
      startCompatibilityRelay();
      log("Remote transformed MediaStream received from Decart. Output remains blocked until frame validation passes.", "success");
    },
    onConnectionQuality: (report) => {
      $("#networkQuality").textContent = report.quality || "Unknown";
      $("#networkTransport").textContent = report.limitingFactor || "none";
    },
    onError: (error) => log(`Realtime session fault: ${error?.message || "unknown"}.`, "error"),
    onDisconnect: () => {
      if (!shuttingDown) log("Realtime session disconnected; waiting for SDK lifecycle event.", "warning");
    }
  });

  attachSdkEvents(realtimeClient);
  updateControls();
  log("Secure Lucy 2.5 session started.", "success");
}

async function resetForLocalFallback(reason) {
  try { realtimeClient?.disconnect(); } catch {}
  realtimeClient = null;
  await clearTransformedOutput(reason);
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  $("#localVideo").srcObject = null;
  activeEngine = "none";
  avatarTrackingReady = false;
  forceState(SessionState.IDLE, "Preparing the best available free local engine.");
}

async function startBestFreeLocal(reason = "Best free local route") {
  if (referenceImage) {
    try {
      await startLocalAvatarTransformation(`${reason} · avatar preferred`);
      clearTimeout(avatarAutoFallbackHandle);
      avatarAutoFallbackHandle = setTimeout(async () => {
        if (shuttingDown || activeEngine !== "avatar" || avatarTrackingReady || failoverInProgress) return;
        failoverInProgress = true;
        try {
          log("Automatic mode did not acquire a face in time; switching to Trusted Local.", "warning");
          await resetForLocalFallback("Local Avatar face acquisition timeout; switching to Trusted Local");
          await startLocalTrustedTransformation("Automatic face-tracking timeout fallback");
        } catch (error) {
          log(`Automatic local fallback failed: ${error.message}`, "error");
        } finally {
          failoverInProgress = false;
          avatarAutoFallbackHandle = null;
        }
      }, 8000);
      return;
    } catch (error) {
      log(`Local Avatar unavailable; falling back to Trusted Local: ${error.message}`, "warning");
      await resetForLocalFallback("Local Avatar unavailable; switching to Trusted Local");
    }
  }
  return startLocalTrustedTransformation(`${reason} · trusted local`);
}

async function failoverToLocal(reason) {
  if (failoverInProgress || shuttingDown) return;
  failoverInProgress = true;
  try {
    log(`Switching from Lucy to the best free local engine: ${reason}`, "warning");
    await resetForLocalFallback(`Lucy unavailable: ${reason}`);
    await startBestFreeLocal(`Lucy failover: ${reason}`);
  } finally {
    failoverInProgress = false;
  }
}

async function startTransformation() {
  const requestedEngine = $("#engineMode")?.value || "fullbody";
  if (requestedEngine === "fullbody") {
    const report = assessFullBodyReadiness(virtualTeam?.selected());
    throw new Error("Virtual team output blocked: " + report.missing.join("; "));
  }

  if (requestedEngine === "puppet") return startBodyPuppetDemo();

  if (requestedEngine === "local") {
    return startLocalTrustedTransformation("Trusted Local selected");
  }

  if (requestedEngine === "avatar") {
    try {
      return await startLocalAvatarTransformation("Local Avatar selected");
    } catch (error) {
      if (!$("#allowLocalFallback")?.checked) throw error;
      log(`Local Avatar start failed; switching to Trusted Local: ${error.message}`, "warning");
      await resetForLocalFallback("Local Avatar unavailable; switching to Trusted Local");
      return startLocalTrustedTransformation(`Avatar failover: ${error.message}`);
    }
  }

  if (requestedEngine === "auto") {
    return startBestFreeLocal("Automatic best-free route");
  }

  try {
    return await startLucyTransformation();
  } catch (error) {
    if (!$("#allowLocalFallback")?.checked) throw error;
    await failoverToLocal(error.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAutomatedReady(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastObsRepairAt = 0;
  let lastBridgeRetryAt = 0;

  while (Date.now() < deadline) {
    if (shuttingDown) throw new Error("Automated setup was stopped.");
    if (state === SessionState.FAILED) throw new Error($("#sessionMessage")?.textContent || "Transformation failed.");

    let virtualCameraActive = false;
    try {
      const status = await obs.call("GetVirtualCamStatus");
      virtualCameraActive = Boolean(status.outputActive);
      if (virtualCameraActive) setGate("virtualCamera", "pass", "Running");
    } catch {}

    const bridge = await api("/api/bridge/status").catch(() => null);
    const publisherReady = ["connected", "streaming"].includes(String(bridge?.publisherState || "").toLowerCase());
    const viewerReady = ["connected", "streaming"].includes(String(bridge?.viewerState || "").toLowerCase());
    const webRtcReady = publisherReady && viewerReady;
    const relayReady = Boolean(bridge?.jpegFallbackReady) && frameValidationPassed;

    if (frameValidationPassed && virtualCameraActive && (webRtcReady || relayReady)) {
      const transport = webRtcReady ? "WebRTC" : "compatibility relay";
      setGate("bridge", "pass", webRtcReady ? "Connected" : "Compatibility relay");
      $("#bridgeState").textContent = webRtcReady ? "connected" : "compatibility relay";
      $("#sessionMessage").textContent = `READY · ${activeEngine === "puppet" ? "2D MOTION DEMO" : activeEngine === "lucy" ? "Lucy 2.5" : activeEngine === "avatar" ? "Local Avatar" : "Trusted Local"} → OBS Virtual Camera · ${transport}`;
      beginTimer();
      toast("GEM live output ready");
      log(`Automated setup complete: verified ${activeEngine} output is live through OBS Virtual Camera using ${transport}. Session duration guard starts now.`, "success");
      return true;
    }

    if (!virtualCameraActive && Date.now() - lastObsRepairAt > 5000) {
      lastObsRepairAt = Date.now();
      await ensureObs(true);
    }

    if (frameValidationPassed && remoteStream && !webRtcReady && !bridgePublisher && Date.now() - lastBridgeRetryAt > 7000) {
      lastBridgeRetryAt = Date.now();
      await startBridge(remoteStream);
    }

    await sleep(500);
  }

  throw new Error("Automated setup timed out before verified output reached OBS Virtual Camera.");
}

async function connect() {
  if (startTransactionInProgress) return;
  startTransactionInProgress = true;
  shuttingDown = false;
  const button = $("#connect");
  const originalLabel = button.textContent;
  button.textContent = "Completing setup…";
  updateControls();

  try {
    if ($("#engineMode").value === "fullbody") {
      const report = assessFullBodyReadiness(virtualTeam?.selected());
      if (!report.ready) throw new Error("Full-body call setup incomplete: " + report.missing.join("; "));
    }
    $("#sessionMessage").textContent = "Automated setup: preparing OBS and Virtual Camera…";
    log("Start Transformation initiated the full automated setup transaction.", "success");
    await ensureObs(true);

    $("#sessionMessage").textContent = "Automated setup: starting the selected trusted transformation engine…";
    await startTransformation();

    $("#sessionMessage").textContent = "Automated setup: validating transformed frames and connecting OBS…";
    await waitForAutomatedReady();
  } catch (error) {
    log(`Automated setup failed: ${error.message}`, "error");
    await clearTransformedOutput(error.message, "error");
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
      $("#localVideo").srcObject = null;
    }
    activeEngine = "none";
    $("#engineState").textContent = "Failed";
    setGate("engine", "fail", "No verified engine");
    forceState(SessionState.FAILED, $("#engineMode").value === "fullbody" ? "Live body animation is not connected yet. You can set up your team and test the voice." : error.message);
  } finally {
    startTransactionInProgress = false;
    button.textContent = originalLabel;
    updateControls();
  }
}

async function applyChanges() {
  if (activeEngine !== "lucy") {
    toast("Local mode is processed automatically; Lucy portrait updates apply only in Lucy mode.");
    return;
  }
  if (!realtimeClient || !referenceImage) return;
  try {
    await realtimeClient.set({
      prompt: { text: $("#prompt").value.trim(), enhance: $("#enhance").checked },
      image: referenceImage
    });
    frameValidationPassed = false;
    lowDifferenceSamples = 0;
    setGate("distinct", "wait", "Revalidating");
    setOutputBadge("VALIDATING", "warn");
    toast("Transformation updated");
    log("Reference portrait and prompt updated atomically.", "success");
  } catch (error) {
    log(`Transformation update failed: ${error.message}`, "error");
  }
}

async function disconnect(reason = "User stopped the session") {
  shuttingDown = true;
  if (state !== SessionState.DISCONNECTED && state !== SessionState.IDLE) forceState(SessionState.DISCONNECTING, reason);
  clearInterval(timerHandle);
  clearInterval(watchdogHandle);
  clearInterval(differenceHandle);
  clearInterval(relayHandle);
  try { realtimeClient?.disconnect(); } catch {}
  realtimeClient = null;
  await clearTransformedOutput(reason);
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  $("#localVideo").srcObject = null;
  $("#sessionTimer").textContent = "00:00:00";
  activeEngine = "none";
  sdkState = "disconnected";
  $("#sdkState").textContent = "Disconnected";
  $("#engineState").textContent = "Standby";
  setGate("engine", "wait", "Standby");
  forceState(SessionState.DISCONNECTED, reason);
  shuttingDown = false;
  updateControls();
  log(reason);
}

async function ensureObs(strict = false) {
  try {
    obsConfig = await api("/api/orchestrator/config");
    await api("/api/obs/start", { method: "POST" }).catch(() => null);
    $("#obsAddress").value = obsConfig.obsAddress;
    if (obsConfig.obsPassword) $("#obsPassword").value = obsConfig.obsPassword;
    const password = $("#obsPassword").value;
    if (!password) throw new Error("OBS WebSocket password is unavailable. Restart Studio with OBS closed, or enter the OBS password.");

    if (!obsConnected) await obs.connect($("#obsAddress").value, password, { rpcVersion: 1 });
    obsConnected = true;
    $("#obsConnectionState").textContent = "Connected";

    const sceneName = "GEM Verified AI Output";
    const inputName = "GEM Verified Browser Bridge";
    const scenes = await obs.call("GetSceneList");
    if (!scenes.scenes.some((scene) => scene.sceneName === sceneName)) await obs.call("CreateScene", { sceneName });

    const inputs = await obs.call("GetInputList");
    const settings = {
      url: obsConfig.obsStageUrl,
      width: 1280,
      height: 720,
      reroute_audio: false,
      shutdown: false,
      restart_when_active: true
    };
    if (!inputs.inputs.some((input) => input.inputName === inputName)) {
      await obs.call("CreateInput", { sceneName, inputName, inputKind: "browser_source", inputSettings: settings, sceneItemEnabled: true });
    } else {
      await obs.call("SetInputSettings", { inputName, inputSettings: settings, overlay: false });
    }
    await obs.call("SetCurrentProgramScene", { sceneName });
    $("#obsSceneState").textContent = sceneName;

    let status = await obs.call("GetVirtualCamStatus");
    if (!status.outputActive) {
      await obs.call("StartVirtualCam");
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await sleep(250);
        status = await obs.call("GetVirtualCamStatus");
        if (status.outputActive) break;
      }
    }
    if (!status.outputActive) throw new Error("OBS Virtual Camera did not become active within the readiness window.");
    $("#obsCameraState").textContent = "Running";
    setGate("virtualCamera", "pass", "Running");
    if (remoteStream && frameValidationPassed) await startBridge(remoteStream);
    log("OBS scene and Virtual Camera prepared for verified engine output.", "success");
  } catch (error) {
    obsConnected = false;
    $("#obsConnectionState").textContent = "Not connected";
    $("#obsCameraState").textContent = "Not verified";
    setGate("virtualCamera", "fail", "Not verified");
    log(`OBS preparation failed: ${error.message}`, "error");
    if (strict) throw error;
    return false;
  }
  return true;
}

async function refreshHealth() {
  try {
    const health = await api("/api/health");
    $("#serviceBadge").textContent = health.keyConfigured
      ? "Studio connected"
      : `Backend online · Virtual team engine pending · v${health.version}`;
    $("#serviceBadge").className = "badge good";
    setGate("backend", "pass", `v${health.version}`);
    if (["local", "avatar"].includes(activeEngine)) setGate("key", "pass", "Not required (local)");
    else setGate("key", health.keyConfigured ? "pass" : "wait", health.keyConfigured ? "Configured" : "Optional");
    const supervisor = await api("/api/orchestrator/status");
    $("#orchestratorStatus").textContent = `Supervisor: ${supervisor.status || "running"} · Automatic server repairs: ${supervisor.healCount || 0}`;
  } catch {
    $("#serviceBadge").textContent = "Backend unavailable";
    $("#serviceBadge").className = "badge bad";
    setGate("backend", "fail", "Unavailable");
  }
}

async function refreshTools() {
  try {
    const tools = await api("/api/tools");
    $("#toolGrid").innerHTML = Object.entries(tools).map(([name, tool]) => `
      <div class="tool-card"><strong>${escapeHtml(tool.label)}</strong><br><span class="${tool.installed ? "good" : "bad"}">${tool.installed ? "Installed" : "Not detected"}</span>${tool.installed ? `<br><button data-launch="${name}">Open</button>` : ""}</div>
    `).join("");
    bindLaunchButtons();
  } catch {}
}

async function refreshObs() {
  return refreshOnce("obs", () => Promise.allSettled([
    (async () => {
  try {
    const diagnostics = await api("/api/obs/diagnostics");
    $("#obsDiagnostics").innerHTML = `
      <div><span>OBS Studio</span><strong class="${diagnostics.installed ? "good" : "bad"}">${diagnostics.installed ? "Installed" : "Not installed"}</strong></div>
      <div><span>OBS process</span><strong>${diagnostics.running ? "Running" : "Stopped"}</strong></div>
      <div><span>Virtual Camera device</span><strong>${diagnostics.virtualCameraDetected ? escapeHtml(diagnostics.virtualCameraName) : "Not detected"}</strong></div>
      <div><span>Supervisor ownership</span><strong>${diagnostics.managed ? "Managed" : "Manual/existing"}</strong></div>`;
    if (diagnostics.virtualCameraActive === true) {
      $("#obsCameraState").textContent = "Running";
      setGate("virtualCamera", "pass", "Running · verified automatically");
    } else {
      $("#obsCameraState").textContent = diagnostics.virtualCameraActive === false ? "Stopped" : "Not verified";
      setGate("virtualCamera", "wait", diagnostics.virtualCameraActive === false ? "Camera stopped" : "Activation not verified");
    }
  } catch {
    $("#obsCameraState").textContent = "Status unavailable";
    setGate("virtualCamera", "wait", "Status unavailable");
  }

    })(),
    (async () => {
  try {
    const bridge = await api("/api/bridge/status");
    $("#obsBridgeState").textContent = `${bridge.publisherState} / ${bridge.viewerState}`;
    if (bridge.viewerState === "streaming" && frameValidationPassed && remoteStream) setGate("bridge", "pass", "OBS receiving transformed video");
    else setGate("bridge", "wait", "Waiting for transformed video");
  } catch {
    setGate("bridge", "wait", "Bridge status unavailable");
  }

    })()
  ]));
}

async function launch(target) {
  try { await api(`/api/launch/${target}`, { method: "POST" }); }
  catch (error) { toast(error.message); }
}

function bindLaunchButtons() {
  $$('[data-launch]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => launch(button.dataset.launch));
  });
}

function setTabs() {
  $$(".tabs button").forEach((button) => button.addEventListener("click", () => {
    $$(".tabs button").forEach((candidate) => candidate.classList.remove("active"));
    $$(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    $(`#tab-${button.dataset.tab}`).classList.add("active");
  }));
}

function downloadLog() {
  const report = {
    generatedAt: new Date().toISOString(),
    version: "2.3.1",
    sessionState: state,
    sdkState,
    activeEngine,
    networkReport,
    frameValidationPassed,
    lowDifferenceSamples,
    gates,
    connection: navigator.connection || null,
    events
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `GEM-Call-Studio-v2-Diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function bind() {
  setTabs();
  bindLaunchButtons();
  $("#refreshDevices").onclick = refreshDevices;
  $("#engineMode").onchange = () => {
    const requested = $("#engineMode").value;
    const lucy = requested === "lucy";
    if (requested === "fullbody") {
      $("#allowLocalFallback").checked = false; $("#allowLocalFallback").disabled = true;
      $("#networkTest").disabled = true;
      $("#networkNotice").textContent = "Full-body virtual team mode uses your selected assets. No fallback to the original camera or voice. Live processing is awaiting verified engine connection.";
      setGate("engine", "wait", "Full-body renderer not connected");
      return;
    }
    $("#allowLocalFallback").disabled = false;
    const avatar = requested === "avatar";
    const autoAvatar = requested === "auto" && Boolean(referenceImage);
    $("#networkTest").disabled = !lucy;
    $("#networkNotice").textContent = lucy
      ? "Lucy mode uses a short-lived Decart token and network preflight. Failure can switch to the best free local route."
      : avatar
        ? "Local Avatar uses the self-hosted MediaPipe face tracker and authorized portrait entirely on-device. Lost face tracking withdraws the OBS bridge."
        : autoAvatar
          ? "Automatic mode will prefer the on-device Local Avatar because an authorized portrait is loaded; it falls back to Trusted Local if needed."
          : "Automatic/Trusted Local runs on-device with no inference subscription. Load a portrait to let Automatic prefer Local Avatar.";
    if (activeEngine === "none") {
      setGate("engine", "wait", lucy ? "Lucy requested" : avatar ? "Local Avatar requested" : autoAvatar ? "Avatar preferred" : "Local free-first");
      const requiresImage = lucy || avatar;
      setGate("image", referenceImage ? "pass" : (requiresImage ? "wait" : "pass"), referenceImage ? "Loaded" : (requiresImage ? "Required" : "Optional"));
    }
  };
  $("#engineMode").dispatchEvent(new Event("change"));
  $("#networkTest").onclick = () => runNetworkPreflight().catch((error) => {
    forceState(SessionState.FAILED, error.message);
    log(`Network preflight failed: ${error.message}`, "error");
  });
  $("#referenceImage").onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast("Use JPEG, PNG or WebP under 5 MB");
      return;
    }
    referenceImage = file;
    $("#imagePreview").src = URL.createObjectURL(file);
    $("#imagePreviewWrap").classList.remove("hidden");
    setGate("image", "pass", `${Math.round(file.size / 1024)} KB`);
    $("#engineMode").dispatchEvent(new Event("change"));
  };
  $("#connect").onclick = connect;
  $("#tryPuppet").onclick = () => { $("#engineMode").value = "puppet"; connect(); };
  $("#apply").onclick = applyChanges;
  $("#disconnect").onclick = () => disconnect();
  $("#prepareObs").onclick = ensureObs;
  $("#repairVirtualCamera").onclick = () => api("/api/obs/repair-virtual-camera", { method: "POST" }).catch((error) => toast(error.message));
  $("#downloadLog").onclick = downloadLog;
  $("#clearLog").onclick = () => { events.splice(0); log("Log cleared."); };
  $("#refreshSystem").onclick = () => { refreshHealth(); refreshTools(); refreshObs(); };
  window.addEventListener("beforeunload", () => {
    shuttingDown = true;
    try { realtimeClient?.disconnect(); } catch {}
    try { localProcessor?.stop("window closed"); } catch {}
    try { bridgePublisher?.stop("window closed"); } catch {}
    localStream?.getTracks().forEach((track) => track.stop());
  });
}

sceneState = initSceneControls({ isBusy: () => startTransactionInProgress || Boolean(localStream || remoteStream) });
virtualTeam = initVirtualTeam({
  isBusy: () => startTransactionInProgress || Boolean(localStream || remoteStream),
  onSelect: (profile) => { if ($("#engineMode").value === "fullbody") $("#sessionMessage").textContent = profile ? profile.name + " selected. Live body animation is still being built." : "Select or create a virtual team member."; }
});
bind();
renderGates();
updateControls();
refreshTools();
refreshDevices();
const pollOptions = { isHidden: () => document.hidden };
const stopHealthPolling = pollSequential(() => refreshOnce("health", refreshHealth), pollOptions);
const stopObsPolling = pollSequential(refreshObs, pollOptions);
window.addEventListener("beforeunload", () => { stopHealthPolling(); stopObsPolling(); });