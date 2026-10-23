import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("V2.3.1 pins the published Decart SDK dependency", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "app", "package.json"), "utf8"));
  assert.equal(pkg.version, "2.3.1");
  assert.equal(pkg.dependencies["@decartai/sdk"], "0.1.16");
});

test("call consumers are never configured for automatic restart", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "config", "apps.json"), "utf8"));
  assert.equal(config.apps.zoom.restartDuringMonitoring, false);
  assert.equal(config.apps.whatsapp.restartDuringMonitoring, false);
});

test("recovery policy prohibits physical-camera fallback", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(root, "config", "recovery-policy.json"), "utf8"));
  assert.equal(policy.videoFailurePolicy.physicalCameraFallbackAllowed, false);
});

test("trusted engine router exposes local, avatar and Lucy without raw-camera bridging", () => {
  const studio = fs.readFileSync(path.join(root, "app", "src", "studio.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "app", "public", "index.html"), "utf8");
  const server = fs.readFileSync(path.join(root, "app", "server.mjs"), "utf8");
  assert.match(studio, /const modelName = "lucy-2\.5";/);
  assert.match(studio, /function createTrustedLocalProcessedStream/);
  assert.match(studio, /startLocalAvatarTransformation/);
  assert.match(studio, /startBestFreeLocal/);
  assert.match(studio, /createLocalAvatarProcessor/);
  assert.match(studio, /startBridge\(remoteStream\)/);
  assert.doesNotMatch(studio, /startBridge\(localStream\)/);
  assert.match(html, /Virtual Team · Full-body live performance/);
  assert.match(html, /Legacy demonstration · Face portrait overlay/);
  assert.match(html, /Lucy experiment · Explicit cloud use/);
  assert.match(server, /model: "lucy-2\.5"/);
  assert.match(server, /wasm-unsafe-eval/);
});

test("local avatar is self-hosted and gates OBS on active face tracking", () => {
  const avatar = fs.readFileSync(path.join(root, "app", "src", "local-avatar.js"), "utf8");
  const studio = fs.readFileSync(path.join(root, "app", "src", "studio.js"), "utf8");
  const bundle = path.join(root, "app", "public", "vendor", "mediapipe", "vision_bundle.mjs");
  const wasm = path.join(root, "app", "public", "vendor", "mediapipe", "wasm", "vision_wasm_internal.wasm");
  const model = path.join(root, "app", "public", "models", "face_landmarker.task");
  assert.match(avatar, /\/vendor\/mediapipe\/vision_bundle\.mjs/);
  assert.match(avatar, /\/vendor\/mediapipe\/wasm/);
  assert.match(avatar, /\/models\/face_landmarker\.task/);
  assert.match(avatar, /detectForVideo/);
  assert.match(studio, /avatarTrackingReady/);
  assert.match(studio, /if \(\(activeEngine === "avatar" \|\| activeEngine === "puppet"\) && !avatarTrackingReady\)/);
  assert.ok(fs.statSync(bundle).size > 100000);
  assert.ok(fs.statSync(wasm).size > 10000000);
  assert.ok(fs.statSync(model).size > 1000000);
});