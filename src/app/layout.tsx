import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ProductionDisclosure } from "@/components/ProductionDisclosure";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const impactSiteVerificationMeta = {
  name: "impact-site-verification",
  value: "c7d5673c-3b23-42e6-ab9c-d88520cf7525",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.gemcybersecurityassist.com",
  ),
  title: {
    default: "GEM Enterprise | Defend. Protect. Prevail.",
    template: "%s | GEM Enterprise",
  },
  description:
    "Access-controlled cybersecurity, compliance, financial-security coordination, and property-risk services subject to eligibility, scope, and signed agreements.",
  keywords: [
    "GEM Enterprise",
    "cybersecurity",
    "enterprise security",
    "threat intelligence",
    "financial security",
    "asset protection",
    "SOC",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "GEM Enterprise",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d121b" },
    { media: "(prefers-color-scheme: light)", color: "#f9f7f4" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const isPortal = headersList.get("x-is-portal") === "1";

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className="bg-[#0d121b]">
      <head>
        <meta {...impactSiteVerificationMeta} />
      </head>
      <body className="bg-[#0d121b] text-white antialiased">
        <Providers>
          {!isPortal && (
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-cyan-300 focus:px-4 focus:py-2 focus:font-bold focus:text-[#071019]"
            >
              Skip to main content
            </a>
          )}
          {!isPortal && <Navigation />}
          {!isPortal && <ProductionDisclosure />}
          <main id="main-content" className={isPortal ? undefined : "min-h-screen"}>
            {children}
          </main>
          {!isPortal && <Footer />}
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
