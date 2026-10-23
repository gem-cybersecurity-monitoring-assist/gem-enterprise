# Automatic OBS readiness display

2026-10-12 installed update. The server's OBS diagnostics reported installed=true, running=true, virtualCameraDetected=true and virtualCameraActive=true, while the previous UI left the camera gate at Not checked. Refresh now promotes the gate only when virtualCameraActive is explicitly true, and clears that state for stopped/unknown/unavailable diagnostics.

The bridge gate requires streaming viewer state and an active, validated transformed stream. Idle or unavailable bridges remain waiting. No full-body renderer or advanced voice-call adapter is installed by this change. Main's configuration/readiness checks are not bypassed. Green indicates observed readiness, not desired readiness.

Syntax and esbuild passed; actual Windows diagnostics confirmed OBS Virtual Camera was already active. Browser regression contains an automatic gate assertion. Full transformed call acceptance remains blocked by missing motion renderer.

Backup: C:\ProgramData\GEM Call Studio\backups\auto-gates-20261012. Restore source/bundle to roll back; the HTML cache revision may also be reverted. No secrets or OBS config values changed.
