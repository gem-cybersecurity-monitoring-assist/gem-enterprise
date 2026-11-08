# Scene and voice selection update

Installed on GEM-ASSIST, 2026-10-11. Added trusted HTTPS Notion page link, a local background library with home/office/bedroom/pool/custom categories, multiple image/video imports, preview/switch/delete and persistent selection. Presets are categories requiring uploaded media, not provided photorealistic scene assets. Imported video plays only in scene preview. Notion link is a navigation reference; no automatic import/OAuth sync is implemented.

Voice provider and audio-input selectors support a user-installed voice app. Detection asks for microphone access on explicit button click, enumerates devices, and releases its temporary capture. Common physical Realtek microphone choices are disabled; virtual devices require user choice and real voice verification. Studio does not control Voicemod's internal preset API. No recognized virtual voice device or Voicemod installation was detected during this update.

Profile voice/background uploads are optional because these can be selected independently. Existing profiles remain readable. Full-body motion/lip sync/custom voice/virtual microphone/call readiness gates remain closed until actual processing is implemented and verified.

Validation: 26/26 installed app tests; syntax and esbuild passed; actual headless Edge profile regression and pool-background persistence passed; synthetic test data removed. Backup: C:\ProgramData\GEM Call Studio\backups\scene-voice-20261011. Restore backed-up HTML, source files and bundle to roll back. No paid activation, actual customer call or provider preset automation performed.
