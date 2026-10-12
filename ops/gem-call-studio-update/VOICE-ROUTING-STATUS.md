# Voice routing — 12 October 2026

The browser can now send its processed voice stream to the exact VB-CABLE playback endpoint. The calling application must select `CABLE Output (VB-Audio Virtual Cable)` as its microphone. Speaker/default-device fallback is prohibited. Disconnecting the cable or ending the source mutes and detaches the route. A physical microphone is selected instead of a virtual default input to avoid feedback.

Eight focused automated checks pass: bounded presets, continuous finite worklet output, cable-only routing, rejected speaker/default fallbacks, failed sink cleanup, cancellation during startup, device removal, and ended source cleanup. These are simulated routing tests, not Windows loopback or customer-call evidence.

The browser regression image fixture was invalid and is replaced with a valid 20×40 PNG. Its earlier canvas-generated version was prone to stalls in a lingering headless browser. An old dedicated test browser process tree was closed; normal studio and OBS processes were preserved.

## Windows installation evidence

On GEM-ASSIST, the official VB-CABLE Pack45 archive was downloaded from VB-Audio. The installer Authenticode signature was valid and its signer was BUREL VINCENT. Installation was started through the signed installer. The host subsequently went offline, so its exit status and new audio endpoints remain unverified. Do not reinstall automatically without checking the existing installation. No reboot was initiated by this work.

The routing update in this commit is prepared but not yet installed on the host. Before installation, back up `app/public/index.html` and `app/public/voice-select.js`; add `voice-call-router.js`, replace the two updated files, and refresh the studio. The HTML uses a new voice script version to avoid stale cache. No browser bundle rebuild is required for the standalone voice module.

## Required live checks

1. Confirm the VB-CABLE playback and recording endpoints, installer completion, and whether Windows needs a restart.
2. With physical headphones selected for call playback, start a voice preset. Verify output through CABLE Output in a separate receiving client and confirm that changing pitch changes the received sound.
3. Stop voice and verify silence. Remove the output device and verify no speaker or physical-microphone fallback.
4. Rerun the profile/background browser checks using the corrected fixture and a single dedicated test browser.

Full-body image animation, expressive lip synchronization, independent live background compositing, and two-client video-call acceptance remain unfinished. The Intel HD Graphics 515 host has no verified real-time renderer meeting the requested image quality. A connected OBS virtual camera alone does not satisfy those requirements.
