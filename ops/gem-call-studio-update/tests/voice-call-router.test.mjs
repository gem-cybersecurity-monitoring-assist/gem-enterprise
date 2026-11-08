import { test } from "node:test";
import assert from "node:assert/strict";
import { VoiceCallRouter } from "../app/public/voice-call-router.js";

function fixture({ devices, play, sinkFailure } = {}) {
  const track = new EventTarget(); track.readyState = "live";
  const stream = { getAudioTracks: () => [track] };
  const mediaDevices = new EventTarget();
  mediaDevices.devices = devices || [{ kind:"audiooutput", deviceId:"cable-1", label:"CABLE Input (VB-Audio Virtual Cable)" }];
  mediaDevices.enumerateDevices = async () => mediaDevices.devices;
  const players = [], events = [];
  const router = new VoiceCallRouter({ mediaDevices, onStatus: x => events.push(x), createAudio: () => {
    const player = { muted: false, srcObject: null, sinkId: "", paused: true,
      async setSinkId(id) { if (sinkFailure) throw new Error("sink denied"); this.sinkId = id; },
      async play() { this.paused = false; await play?.(); }, pause() { this.paused = true; } };
    players.push(player); return player;
  }});
  return { router, stream, track, players, events, mediaDevices };
}

test("routes only processed audio to the exact cable and makes no call-verification claim", async () => {
  const f = fixture();
  const result = await f.router.connect(f.stream);
  assert.equal(f.players[0].sinkId, "cable-1");
  assert.equal(f.players[0].srcObject, f.stream);
  assert.equal(f.players[0].muted, false);
  assert.equal(result.actualCallVerified, false);
  f.router.dispose();
  assert.equal(f.players[0].srcObject, null);
  assert.equal(f.track.readyState, "live");
});

test("never falls back to physical speakers or the system default", async () => {
  for (const d of [{kind:"audiooutput",deviceId:"default",label:"CABLE Input (VB-Audio Virtual Cable)"},
    {kind:"audiooutput",deviceId:"speakers",label:"Speakers / Headphones (Realtek Audio)"},
    {kind:"audioinput",deviceId:"cable",label:"CABLE Input (VB-Audio Virtual Cable)"}]) {
    const f = fixture({devices:[d]});
    await assert.rejects(f.router.connect(f.stream), /not available/);
    assert.equal(f.players.length, 0); f.router.dispose();
  }
});

test("sink failure leaves no attached audio source", async () => {
  const f = fixture({sinkFailure:true});
  await assert.rejects(f.router.connect(f.stream), /sink denied/);
  assert.equal(f.players[0].srcObject, null);
  assert.equal(f.players[0].muted, true); f.router.dispose();
});

test("accepts the signed Pack45 driver speaker endpoint name", async () => {
  const f=fixture({devices:[{kind:"audiooutput",deviceId:"cable-45",label:"Speakers (VB-Audio Virtual Cable)"}]});
  await f.router.connect(f.stream);
  assert.equal(f.players[0].sinkId,"cable-45"); f.router.dispose();
});

test("stopping during an unfinished play cannot restart routing", async () => {
  let finish;
  const f = fixture({play: () => new Promise(r => { finish = r; })});
  const starting = f.router.connect(f.stream);
  while (!finish) await new Promise(r => setImmediate(r));
  f.router.stop(); finish();
  assert.equal(await starting, null);
  assert.equal(f.router.state, "idle");
  assert.equal(f.players[0].muted, true);
  assert.equal(f.players[0].srcObject, null); f.router.dispose();
});

test("device removal silences output and never selects another sink", async () => {
  const f = fixture(); await f.router.connect(f.stream);
  f.mediaDevices.devices = []; await f.router.checkDevice();
  assert.equal(f.router.state, "idle");
  assert.equal(f.players[0].muted, true);
  assert.match(f.events.at(-1).message, /disconnected/); f.router.dispose();
});

test("an ended source silences the cable and releases the player", async () => {
  const f = fixture(); await f.router.connect(f.stream);
  f.track.readyState = "ended"; f.track.dispatchEvent(new Event("ended"));
  assert.equal(f.router.state, "idle");
  assert.equal(f.players[0].srcObject, null); f.router.dispose();
});
