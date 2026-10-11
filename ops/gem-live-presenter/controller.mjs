/** Live presenter lifecycle. Inject a real renderer and a virtual-device sink.
 * Never send source camera/microphone tracks directly to the sink.
 */
export class PresenterController {
  constructor({ renderer, sink, clock = () => performance.now(), timeoutMs = 750 }) {
    if (!renderer || !sink || !Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 2000) {
      throw new Error('Invalid presenter controller configuration');
    }
    this.renderer = renderer; this.sink = sink; this.clock = clock;
    this.timeoutMs = timeoutMs; this.state = 'IDLE'; this.generation = 0;
    this.session = null; this.profiles = new Map(); this.timer = null;
  }

  register(profile) {
    if (this.state !== 'IDLE') throw new Error('Stop the session before editing profiles');
    if (!profile?.id || !profile.imageAssetIds?.length ||
        !profile.imageAssetIds.every(id => typeof id === 'string' && id.length > 0) ||
        !profile.voiceAssetId || !profile.backgroundAssetId ||
        profile.likenessAuthorized !== true || profile.voiceAuthorized !== true ||
        profile.presentation !== 'disclosed-virtual-team-member') {
      throw new Error('Incomplete or unauthorized presenter profile');
    }
    this.profiles.set(profile.id, structuredClone(profile));
  }

  async start(profileId, source) {
    if (this.state !== 'IDLE') throw new Error('Session already active');
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error('Unknown presenter');
    const sourceTracks = source?.getTracks?.() ?? [];
    if (!['audio', 'video'].every(kind => sourceTracks.some(t => t.kind === kind && t.readyState === 'live'))) {
      throw new Error('Live camera and microphone required');
    }
    const generation = ++this.generation;
    this.state = 'PREPARING';
    try {
      // Sink contract: gate(false) must immediately replace video with a neutral
      // virtual-presenter slate and audio with silence, not freeze the last frame.
      await this.sink.gate(false);
      const session = await this.renderer.start({ profile: structuredClone(profile), source });
      if (generation !== this.generation) { await session.stop(); return; }
      this.session = session;
      const caps = session.capabilities;
      if (caps?.fullBody !== true || caps?.liveMotion !== true || caps?.liveVoice !== true ||
          caps?.backgroundReplacement !== true) throw new Error('Required renderer capabilities unavailable');
      const outputTracks = session.stream?.getTracks?.() ?? [];
      if (!['audio', 'video'].every(kind => outputTracks.some(t => t.kind === kind && t.readyState === 'live')) ||
          outputTracks.some(t => sourceTracks.includes(t) || sourceTracks.some(s => s.id === t.id))) {
        throw new Error('Independent transformed video and audio required');
      }
      await this.sink.attach(session.stream);
      if (generation !== this.generation) return;
      this.last = { video: -Infinity, audio: -Infinity };
      this.startedAt = this.clock(); this.sequence = { video: -1, audio: -1 };
      this.state = 'READY';
      // Renderer invokes these only after producing new frames/audio blocks.
      this.unsubscribe = session.observeOutput(event => {
        if (generation !== this.generation || !['audio', 'video'].includes(event.kind) ||
            !Number.isSafeInteger(event.sequence) || event.sequence <= this.sequence[event.kind]) return;
        this.sequence[event.kind] = event.sequence;
        this.last[event.kind] = this.clock();
      });
      this.timer = setInterval(() => { void this.check().catch(() => { this.state = 'BLOCKED'; }); }, 100);
    } catch (error) {
      if (generation === this.generation) await this.fail();
      throw error;
    }
  }

  async check() {
    if (this.checking || !['READY', 'LIVE'].includes(this.state)) return;
    this.checking = true;
    try {
    const now = this.clock();
    const fresh = ['video', 'audio'].every(kind => now - this.last[kind] <= this.timeoutMs);
    const tracksLive = this.session.stream.getTracks().every(t => t.readyState === 'live');
    if (!fresh || !tracksLive) {
      if (this.state === 'LIVE' || now - this.startedAt > this.timeoutMs || !tracksLive) await this.fail();
      return;
    }
    if (this.state === 'READY') {
      const generation = this.generation;
      await this.sink.gate(true);
      if (generation !== this.generation) { await this.sink.gate(false); return; }
      this.state = 'LIVE';
    }
    } catch (error) { await this.fail(); throw error; }
    finally { this.checking = false; }
  }

  async fail() {
    this.state = 'BLOCKED';
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.sink.gate(false);
  }

  async stop() {
    ++this.generation;
    this.state = 'STOPPING';
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      await this.sink.gate(false);
      this.unsubscribe?.(); this.unsubscribe = null;
      await this.session?.stop();
      await this.sink.detach();
      this.session = null; this.state = 'IDLE';
    } catch (error) { this.state = 'BLOCKED'; throw error; }
  }
}
