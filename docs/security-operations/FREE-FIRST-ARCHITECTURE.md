# GEM Security Operations: free-first implementation policy

Status: **foundation code only; no external sensors, response actions, or production monitoring enabled.**

## Non-negotiable constraints
- No mandatory paid license, trial expiry, premium API, or billing-linked critical path.
- Prefer self-hosted, independently reviewed open-source components. Free software still incurs hardware, bandwidth, storage, backup and operational costs.
- Keep production fail-closed. Do not silently enable new agent enrollment, admin access, network capture, device isolation, or scans.
- One client tenant per authorized scope; tenant identity must be taken from trusted GEM authentication and never from uploaded alerts.
- Verify user/organization ownership before scanning or ingesting private telemetry. Keep events minimized and retention-limited.
- Separate raw alert ingestion, normalization, deduplication, evidence storage, investigations and response execution.
- AI agents provide recommendations; never autonomously approve their own high-risk actions.
- No unsupported guarantees: **browser checks are not a VPN**, a detection alert is not proof of compromise, and an account notice is not an API-authorized bank freeze.
- Commercial use and redistribution of each upstream component is subject to its specific license and trademark terms; preserve attribution and review copyleft requirements.

## Free-first component candidates (not yet deployed)
| Domain | Candidate | Activation gate |
| --- | --- | --- |
| Endpoint and SIEM | Wazuh self-hosted | Host capacity, authorization, encryption, retention, operator |
| Network detection | Suricata | Approved network tap and alert tuning |
| Device inventory | osquery | Explicit enrollment and machine ownership |
| Cloud posture | Prowler | Read-only cloud role scoped to customer |
| Artifact/container scan | Trivy | Approved repositories and images |
| Exposure validation | Greenbone Community Edition | Written authorized target list |
| Secure tunnel | WireGuard | Verified endpoint, keys, routing and kill-switch tests |
| Breached passwords | HIBP Pwned Passwords range API | Privacy-preserving k-anonymity flow; never send plaintext credentials |
| Threat intelligence | OpenCTI community | Hardware and feed licensing assessed |
| Automation | GEM-owned response policy | Human approval, audit log, per-tenant RBAC and rollback |

## Excluded until independently approved
- Paid HIBP email/domain account lookup, vendor stealer logs and MSP plans.
- Paid Defender XDR, commercial security services and advanced SASE tiers.
- Any simulated banking control, financial access, silent surveillance, mass-target scanning, or false federal authorization claims.

## First technical implementation
- `src/lib/security-operations/events.ts`: vendor-neutral, read-only normalization for a bounded alert summary.
- `src/lib/security-operations/response-policy.ts`: fail-closed prerequisite evaluation. A positive policy decision is **not** execution authorization; any eventual response endpoint must enforce tenant scope, authentication, signed approvals, replay prevention, and integration-specific permission checks again.
- `src/__tests__/security-operations-foundation.test.ts`: representative normalization and denial tests.

## Next implementation gates
1. Review tenant identity, threat-model, audit and retention primitives already present on main.
2. Add authenticated ingestion with payload schema validation, idempotency, rate limits and confidential evidence storage.
3. Enroll one explicitly authorized lab device in a self-hosted Wazuh pilot without touching customer production devices.
4. Capture observed metrics: ingestion latency, coverage, false positives and alert-to-case linkage.
5. Add evidence-backed dashboards; no fabricated security events, customer metrics, or federal compliance seals.
6. Only then wire approved Telegram notifications and verified action integrations behind operator approvals.

No merge, deploy, production enrollment or paid-service activation is implied by this change.
