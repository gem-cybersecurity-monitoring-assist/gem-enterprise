# GEM live presenter controller

This is a tested lifecycle controller, not a motion renderer or a finished video
call service. No default renderer, voice conversion engine or virtual-device
driver is installed. No network service or platform route is added.

Run focused tests with Node 24:

```bash
node --test ops/gem-live-presenter/controller.test.mjs
```

Renderer adapter contract:
- `start({profile, source})` returns a session with `stream`, `capabilities`,
  `observeOutput(callback)` and async `stop()`.
- Stream contains independent live transformed audio and video tracks.
- Capability flags must reflect measured support, not advertised model features.
- `observeOutput` returns an unsubscribe function and emits `{kind, sequence}`
  after producing each new audio block/video frame, including silence blocks.
  Use strictly increasing safe integer sequences per kind. Clock time is recorded
  locally; producer timestamps cannot artificially extend output freshness.
- Asset IDs resolve only inside the authorized local profile store; this module
  stores profile metadata in memory only. Do not send images in telemetry.

Sink adapter contract:
- `gate(false)` must immediately mute converted audio and replace video with a
  neutral slate. It must never fall back to raw source or freeze a talking pose.
- `attach(stream)` connects processed output to preview and virtual devices while
  the gate is closed. `gate(true)` releases it. `detach()` releases resources.
- Commands must serialize and enforce gate state independently. This JavaScript
  timer is a secondary watchdog; the device sink needs its own expiry lease so
  an application crash cannot leave output running unattended.

Use `register` repeatedly for multiple virtual team members, `start` for the
selected profile and `stop` before switching. A BLOCKED session requires stop
and an explicit restart. The controller does not own source capture tracks;
the calling application must stop those during teardown.

See docs/agent-control/tasks/LIVE-PRESENTER.md for full-body, privacy, actual-call
and hardware acceptance. Current verification is simulated adapter testing only.
Do not call this production ready or represent the quality targets as achieved.
