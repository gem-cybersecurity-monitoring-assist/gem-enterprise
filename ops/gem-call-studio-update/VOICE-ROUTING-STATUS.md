# Verified voice routing — 12 October 2026

Installed on GEM-ASSIST. Select a voice style and press Start voice. The checked Send selected voice to calls option routes processed audio to VB-CABLE. The calling application must select CABLE Output (VB-Audio Virtual Cable) for its microphone and physical headphones for playback. Voicemod is not required.

## Evidence

- Official VB-CABLE Pack45 installer: valid Authenticode signature, BUREL VINCENT signer, exit code 0. Windows playback/recording endpoints healthy. No reboot initiated.
- Complete profile/background browser check passed, including save, selected-profile restoration, scene restoration, fixture deletion, layout, blocked missing renderer, and automatic OBS status.
- Windows suite: 35 tests passed. The additional pitch-frequency check passed in the focused three-test voice suite. All 10 focused voice/router checks passed in the development runtime.
- Real Windows loopback between two separate browser clients: synthetic 440 Hz source through the processor and VB-CABLE measured 439.45 Hz at the receiver; lowering pitch five semitones measured 328.125 Hz; stopping produced silence. Both contexts ran at 48 kHz.
- Actual UI: Deep preset, Start voice, connected route and live output; Stop ended output and released controls.
- Simulated tests cover physical/default sink rejection, cancellation, failed connection cleanup, device removal, and source ending.

An initial loopback attempt with two full studio pages failed the frequency assertion. The isolated retest measured both processor and receiver and passed. This is a short functional check; sustained performance remains unverified.

## Remaining limits

Actual Zoom, Teams and WhatsApp calls, human speech quality, long-duration stability and delay remain untested. The built-in effect changes pitch and tone, not uploaded-voice cloning. Full-body photo animation, lip synchronization and independent live background compositing remain unfinished.

The host has Intel HD Graphics 515 and Core m7-6Y75. About 1.3 GB free memory and 88% CPU load were observed during testing. No installed renderer meets the requested full-body quality and latency with verified evidence. Tencent MimicMotion is an offline GPU-generation workflow, not a live substitute: https://github.com/Tencent/MimicMotion.

## Recovery and checks

Host backup: C:/ProgramData/GEM Call Studio/backups/voice-routing-install-20261012. Restore index.html and voice-select.js to app/public to revert the UI integration. The new router is inactive when the old voice module is restored. Verify installed endpoints before considering driver reinstallation.

The loopback test generates a synthetic tone and captures only the virtual cable. The UI test briefly opens the authorized physical microphone without recording. Test streams and dedicated browser clients are closed afterward.
