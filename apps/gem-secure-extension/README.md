# GEM Secure — Chromium browser extension (preview)

This is an independent, minimal-permission Manifest V3 extension for Chrome and Edge. It introduces genuine read-only privacy setting checks and reads the active tab URL **only when the user opens its popup**. It never sends browsing data, passwords, emails, or privacy findings off-device.

## Developer installation
1. Clone/download this branch.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**, choose **Load unpacked**, and select `apps/gem-secure-extension`.
4. Open a normal HTTP/HTTPS webpage and click the GEM Secure extension icon.

## Implemented
- Read-only HTTPS vs HTTP URL classification. HTTPS is not a certificate or threat-intelligence audit.
- Read-only privacy checks where Chromium exposes a compatible setting; unsupported checks appear as such.
- Portal link to authenticated GEM Enterprise service.
- Honest VPN and breach-monitoring *not configured* states.

## Not implemented
- No actual VPN, proxy, encrypted tunnel, exit node, geo-unblocking, DNS protection, leak prevention, or kill switch.
- No automatic email breach scanner, breach API integration, credentials ingestion, dark-web crawl, notifications, or continuous browsing monitor.
- No browser-store submission, production release, or server integration.

## Engineering gates for next phases
1. Agree on an independently branded design; do not copy competitor logos, art, or proprietary code.
2. Obtain an authorized breach-data provider and consent-aware backend. Never put API tokens in extension source; require user-supplied/verified email and rate-limit checks.
3. Choose VPN infrastructure (a real WireGuard/OpenVPN native client, or browser-scoped authenticated proxy explicitly described as **proxy**, not VPN). Perform external-IP, DNS/WebRTC leak and disconnect tests before calling it protected.
4. Implement signed authentication and tenant-scoped GEM APIs, data retention policy, data deletion, and audit trail.
5. Add icon assets, tests, privacy disclosures, store listing, and security review before a public Chrome Web Store / Edge Add-ons submission.

Permissions: `activeTab` permits inspection of the page the user is viewing only when invoked; `privacy` reads selected privacy preferences; `storage` is reserved for future local settings and currently unused. No blanket host access.
