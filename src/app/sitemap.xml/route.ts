const DEFAULT_APP_URL = "https://www.gemcybersecurityassist.com";

const routes = [
  "/",
  "/services",
  "/services/threat-monitoring",
  "/services/incident-response",
  "/services/dark-web",
  "/services/red-team",
  "/services/asset-recovery",
  "/services/federal-compliance",
  "/business-review",
  "/enterprise-solutions",
  "/intel",
  "/intel/news",
  "/newsletter",
  "/store",
  "/store/main",
  "/store/campaign-hub",
  "/store/tiktok",
  "/store/shopify",
  "/store/google",
  "/store/wix",
  "/resources",
  "/resources/business-readiness-checklist",
  "/company",
  "/about",
  "/contact",
  "/get-started",
  "/eligibility/status",
  "/privacy",
  "/terms",
  "/compliance-notice",
  "/cookie-policy",
  "/trust-center",
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const urls = routes
    .map((route) => `<url><loc>${escapeXml(`${baseUrl}${route}`)}</loc></url>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
