# Built-in live voice preview

Installed on GEM-ASSIST 2026-10-11. No Voicemod, paid API, cloud inference, or new dependency required. Provides eight preset choices (including custom), live granular pitch shifting, bass/brightness EQ, bounded gain and dynamics compression. It changes the operator's voice characteristics; it is not voice cloning or a guaranteed realistic new identity.

Explicit Start obtains microphone permission and builds an AudioWorklet audio graph. A processed MediaStream is emitted through gem-processed-voice-ready, marked callRoutingVerified=false. Physical listening is off by default and enabled only via the headphones checkbox. Stop closes the AudioContext and releases microphone/output tracks. Preset preferences persist in this browser. The browser request/permission policy still applies.

Verification: 28/28 installed app tests. DSP synthetic sample processing stays finite/bounded. Headless Edge with a synthetic microphone verified an actual live output audio track, selected deep pitch settings, muted monitoring by default, track release on Stop and preset restoration after reload. This is simulated-input pipeline verification; subjective human voice quality and actual customer calls are not tested.

External Zoom/Teams/WhatsApp microphone routing, realistic voice cloning and full-body rendering remain incomplete. Browser audio cannot be presented as a Windows virtual microphone without a separately configured bridge/driver. Integration must continue to fail closed until that route is verified. No preset style is presented as an authentic recording of another person.

Backup: C:\ProgramData\GEM Call Studio\backups\local-voice-20261011. Restore index.html and remove the new public voice files to roll back the UI; existing app/backend is preserved.
