import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresenterController } from './controller.mjs';

const profile = { id: 'team-1', imageAssetIds: ['front', 'body'], voiceAssetId: 'voice-1',
  backgroundAssetId: 'office', likenessAuthorized: true, voiceAuthorized: true,
  presentation: 'disclosed-virtual-team-member' };
const stream = prefix => ({ getTracks: () => ['video', 'audio'].map(kind =>
  ({ id: prefix + kind, kind, readyState: 'live' })) });
function fixture(overrides = {}) {
  let time = 0, emit;
  const gates = [];
  const session = { stream: stream('output'), capabilities: { fullBody: true,
    liveMotion: true, liveVoice: true, backgroundReplacement: true },
    observeOutput: callback => { emit = callback; return () => {}; }, stop: async () => {}, ...overrides };
  const controller = new PresenterController({ renderer: { start: async () => session },
    sink: { gate: async value => gates.push(value), attach: async () => {}, detach: async () => {} },
    clock: () => time });
  controller.register(profile);
  return { controller, gates, source: stream('source'), setTime: value => { time = value; },
    output: (kind, sequence) => emit({ kind, sequence }) };
}
test('multiple profiles are retained independently and authorization is mandatory', () => {
  const f = fixture();
  f.controller.register({ ...profile, id: 'team-2' });
  profile.imageAssetIds.push('later');
  assert.equal(f.controller.profiles.size, 2);
  assert.equal(f.controller.profiles.get('team-1').imageAssetIds.length, 2);
  assert.throws(() => f.controller.register({ ...profile, voiceAuthorized: false }));
});
test('live gate requires newly produced audio and video', async () => {
  const f = fixture();
  try {
    await f.controller.start('team-1', f.source);
    await f.controller.check(); assert.equal(f.controller.state, 'READY');
    f.output('video', 0); await f.controller.check(); assert.equal(f.controller.state, 'READY');
    f.output('audio', 0); await f.controller.check(); assert.equal(f.controller.state, 'LIVE');
    assert.deepEqual(f.gates, [false, true]);
  } finally { await f.controller.stop(); }
});
test('frozen output cuts to slate and silence; does not resume automatically', async () => {
  const f = fixture();
  try {
    await f.controller.start('team-1', f.source);
    f.output('video', 0); f.output('audio', 0); await f.controller.check();
    f.setTime(800); await f.controller.check();
    assert.equal(f.controller.state, 'BLOCKED'); assert.equal(f.gates.at(-1), false);
    f.output('video', 1); f.output('audio', 1); await f.controller.check();
    assert.equal(f.controller.state, 'BLOCKED');
  } finally { await f.controller.stop(); }
});
test('replayed sequence cannot keep stale video alive', async () => {
  const f = fixture();
  try {
    await f.controller.start('team-1', f.source);
    f.output('video', 1); f.output('audio', 1); await f.controller.check();
    f.setTime(800); f.output('video', 1); f.output('audio', 2); await f.controller.check();
    assert.equal(f.controller.state, 'BLOCKED');
  } finally { await f.controller.stop(); }
});
test('face-only renderer is rejected before live output', async () => {
  const f = fixture({ capabilities: { fullBody: false } });
  await assert.rejects(f.controller.start('team-1', f.source));
  assert.equal(f.controller.state, 'BLOCKED'); assert.ok(!f.gates.includes(true));
  await f.controller.stop();
});
test('raw camera and microphone passthrough is rejected', async () => {
  const f = fixture({ stream: stream('source') });
  await assert.rejects(f.controller.start('team-1', f.source));
  assert.ok(!f.gates.includes(true)); await f.controller.stop();
});
test('source tracks must include live video and audio', async () => {
  const f = fixture();
  await assert.rejects(f.controller.start('team-1', { getTracks: () => [] }));
  assert.equal(f.controller.state, 'IDLE');
});
test('stop during renderer startup cannot publish a late session', async () => {
  const f = fixture(); let resolve, stopped = false;
  f.controller.renderer.start = () => new Promise(r => { resolve = r; });
  const pending = f.controller.start('team-1', f.source);
  await Promise.resolve(); await f.controller.stop();
  resolve({ stop: async () => { stopped = true; } }); await pending;
  assert.equal(stopped, true); assert.equal(f.controller.state, 'IDLE');
  assert.ok(!f.gates.includes(true));
});
