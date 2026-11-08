# GEM Virtual Team Studio — local 2D motion preview (experimental)

This optional free, on-device preview lets the operator choose a saved, authorized team member, pick a separately uploaded background, and drive a **2D full-body photo cutout** using local shoulder, hip, arm and leg pose estimates. The operator's physical camera frames are never supplied as the OBS outgoing video.

**It is NOT** a photorealistic full-body identity transfer system and does not lip-sync a face or clone a voice. The voice path remains the separate VB-CABLE processor. The main **Virtual Team · Full-body live performance** mode stays fail-closed until a realistic renderer and two-way customer-call acceptance test are complete.

## Windows preparation

- Model: MediaPipe Pose Landmarker Lite, downloadable without a paid plan from Google's official model storage URL. Use `scripts/Prepare-Body-Demo.ps1` for pinned branch-code staging, model download, backup, rebuild and local checks. This script does not require or enable cloud inference.
- App source: `app/src/pose-puppet.js`. UI/controller integration is in `app/src/studio.js` and `app/public/index.html`.
- Launch from your existing **GEM Virtual Team Studio** desktop shortcut once installed. The browser may require a reload to fetch the versioned bundle.
- Select a saved team profile that includes a *head-to-feet* authorized image. The camera must see the operator's shoulders and hips, ideally knees and feet. Select a background, then choose **Try free 2D body demo**.

## Verification gates

The following checks must pass **on GEM-ASSIST** before any functional claim:
1. Installer model, source syntax and esbuild rebuild.
2. Webcam tracking of a real moving person, including dropped-target behavior.
3. Output video shows only the selected virtual cutout and background (not the physical camera).
4. OBS Browser Source frame freshness and OBS Virtual Camera connection.
5. VB-CABLE processed audio read as a virtual microphone in a second client.
6. A consented two-client test call on the actual chosen calling application, documenting video and voice latency, drops and recovery.

Call-readiness status must remain partial/blocked until these checks pass. Even after a successful 2D demo call, the **photorealistic full-body customer presenter** remains a separate unmet requirement. Do not label untested components green. Do not merge/deploy PR #429 without authorization.

## Resource limitations

GEM-ASSIST's previously observed Intel HD Graphics 515 and limited free RAM are not adequate evidence of real-time high-fidelity avatar inference capability. The Lite pose tracker and 2D draw pipeline are intended as an economical prototype, not a performance guarantee. User-provided image quality and input framing affect its behavior.

## Privacy

Use only owned/authorized images and voices. Identify the character to customers as a virtual team member. When tracking fails the renderer paints a neutral non-camera frame. It never silently falls back to raw camera or raw microphone audio.
