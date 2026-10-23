import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studio = fs.readFileSync(path.join(root, "app", "src", "studio.js"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "public", "index.html"), "utf8");

test("virtual team is default and legacy modes require explicit selection", () => {
  assert.match(html, /id="engineMode"/);
  assert.match(html, /value="fullbody" selected/);
  assert.match(html, /value="local"/);
  assert.match(html, /value="avatar"/);
  assert.match(html, /value="lucy"/);
  assert.doesNotMatch(html, /id="allowLocalFallback"[^>]*checked/);
  assert.match(studio, /Full-body call setup incomplete/);
});

test("local trusted output is a distinct canvas MediaStream, not the raw camera stream", () => {
  assert.match(studio, /function createTrustedLocalProcessedStream\(stream\)/);
  assert.match(studio, /canvas\.captureStream/);
  assert.match(studio, /remoteStream = localProcessor\.stream/);
  assert.doesNotMatch(studio, /startBridge\(localStream\)/);
});

test("verified output is labeled by engine and raw-camera substitution remains prohibited", () => {
  assert.match(studio, /"VERIFIED LUCY"/);
  assert.match(studio, /"VERIFIED AVATAR"/);
  assert.match(studio, /"VERIFIED LOCAL"/);
  assert.match(studio, /The physical camera is not substituted/);
  assert.match(html, /Raw physical camera is never substituted/);
});

test("Lucy startup and mid-session disconnect can fail over to the best free local route", () => {
  assert.match(studio, /async function failoverToLocal\(reason\)/);
  assert.match(studio, /Lucy session disconnected/);
  assert.match(studio, /await failoverToLocal\(error\.message\)/);
  assert.match(studio, /startBestFreeLocal/);
});

test("automatic mode is free-first and prefers local avatar when a portrait is available", () => {
  assert.match(studio, /requestedEngine === "auto"/);
  assert.match(studio, /startBestFreeLocal\("Automatic best-free route"\)/);
  assert.match(studio, /if \(referenceImage\)/);
  assert.match(studio, /startLocalAvatarTransformation/);
  assert.match(studio, /setGate\("preflight", "pass", "Local · no cloud"\)/);
});

test("local avatar requires active face tracking before frame verification", () => {
  assert.match(studio, /\(activeEngine === "avatar" \|\| activeEngine === "puppet"\) && !avatarTrackingReady/);
  assert.match(studio, /TRACKING WAIT/);
  assert.match(studio, /avatar tracking lost/);
});