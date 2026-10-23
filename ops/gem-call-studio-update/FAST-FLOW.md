# Installed startup and connector responsiveness update

2026-10-11, GEM-ASSIST.

- Independent bridge/OBS diagnostic checks: bridge status is no longer delayed by Windows device enumeration.
- Single-flight GET requests share one in-flight read; POST mutations are never deduplicated or retried automatically.
- Read responses are cloned per consumer so shared reads remain usable.
- Polls schedule their next run only after completion; hidden windows back off.
- Requests have bounded waits (10 seconds normally, 20 for OBS diagnostics). Failure remains failure.
- The project bootstrap no longer requires an optional Decart credential for local backend health or opens its credential prompt during local startup.
- Optional cloud warmup stays in the background; Lucy still requires its protected token endpoint and preflight.
- Browser singleton discovery queries only Edge processes rather than every Windows process.

Verified: 23/23 installed app tests, JavaScript syntax, PowerShell parsing, esbuild, isolated Healthy() test with keyConfigured=false. Live full-body synthesis and voice conversion are still not implemented. These changes do not establish any end-to-end latency SLA, cold-start timing or two-client live-call result.

Backup before this update: C:\ProgramData\GEM Call Studio\backups\fast-flow-20261011. Restore studio.js, studio.bundle.js and GEM-Project-Start.ps1 to their original installed paths to roll back. This isolated source snapshot is not an auto-installer. Rebuild the existing studio package after reviewing/merging future installation changes.
