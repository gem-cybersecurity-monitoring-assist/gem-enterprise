export function isCablePlayback(device) {
  return device?.kind === "audiooutput" &&
    !["", "default", "communications"].includes(device.deviceId) &&
    /^(?:CABLE Input|Speakers) \(VB-Audio Virtual Cable\)$/i.test(device.label || "");
}

export class VoiceCallRouter {
  constructor({ mediaDevices = globalThis.navigator?.mediaDevices,
    createAudio = () => new Audio(), onStatus = () => {} } = {}) {
    this.mediaDevices = mediaDevices;
    this.createAudio = createAudio;
    this.onStatus = onStatus;
    this.generation = 0;
    this.state = "idle";
    this.deviceChanged = () => { void this.checkDevice(); };
    this.mediaDevices?.addEventListener("devicechange", this.deviceChanged);
  }

  async connect(stream) {
    this.stop();
    const generation = this.generation;
    const track = stream?.getAudioTracks().find(t => t.readyState === "live");
    if (!track) throw new Error("Start the processed voice first.");
    this.state = "connecting";
    let player;
    try {
      const devices = await this.mediaDevices.enumerateDevices();
      if (generation !== this.generation) return null;
      const sink = devices.find(isCablePlayback);
      if (!sink) throw new Error("VB-CABLE is not available. Its installation may need a Windows restart.");
      player = this.createAudio();
      player.muted = true;
      if (typeof player.setSinkId !== "function") throw new Error("Open Studio in Microsoft Edge or Chrome to route the voice.");
      this.player = player;
      await player.setSinkId(sink.deviceId);
      if (generation !== this.generation) return null;
      if (player.sinkId !== sink.deviceId) throw new Error("The selected audio output was not applied.");
      player.srcObject = stream;
      await player.play();
      if (generation !== this.generation) return null;
      if (track.readyState !== "live") throw new Error("The processed voice stopped before connection completed.");
      this.track = track;
      this.trackEnded = () => this.stop("Processed voice stopped. Call microphone is silent.");
      track.addEventListener("ended", this.trackEnded);
      this.sinkId = sink.deviceId;
      player.muted = false;
      this.state = "connected";
      const result = { deviceLabel: sink.label, callMicrophone: "CABLE Output (VB-Audio Virtual Cable)", actualCallVerified: false };
      this.onStatus({ state: this.state, ...result });
      return result;
    } catch (error) {
      if (generation === this.generation) this.stop(error.message);
      throw error;
    } finally {
      if (generation !== this.generation && player) {
        player.muted = true; player.pause(); player.srcObject = null;
      }
    }
  }

  async checkDevice() {
    if (this.state !== "connected") return;
    const generation = this.generation;
    try {
      const devices = await this.mediaDevices.enumerateDevices();
      if (generation !== this.generation) return;
      if (!devices.some(d => d.deviceId === this.sinkId && isCablePlayback(d)))
        this.stop("Call audio device disconnected. Start voice again after reconnecting it.");
    } catch {
      if (generation === this.generation) this.stop("Call audio device could not be checked.");
    }
  }

  stop(message) {
    ++this.generation;
    if (this.player) { this.player.muted = true; this.player.pause(); this.player.srcObject = null; }
    this.track?.removeEventListener("ended", this.trackEnded);
    this.track = null; this.trackEnded = null; this.player = null; this.sinkId = null;
    this.state = "idle";
    if (message) this.onStatus({ state: "idle", message, actualCallVerified: false });
  }

  dispose() {
    this.stop();
    this.mediaDevices?.removeEventListener("devicechange", this.deviceChanged);
  }
}
