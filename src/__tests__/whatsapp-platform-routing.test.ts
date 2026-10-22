import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("WhatsApp platform integration", () => {
  it("publishes the canonical production WhatsApp route and number", () => {
    const config = source("src/lib/whatsapp.ts");
    const page = source("src/app/whatsapp/page.tsx");

    expect(config).toContain('displayNumber: "+1 (860) 234-9394"');
    expect(config).toContain('digits: "18602349394"');
    expect(page).toContain("Connected Business Channel");
    expect(page).toContain("Start WhatsApp chat");
  });

  it("adds public discovery and a site-wide quick contact entry point", () => {
    const navigation = source("src/components/Navigation.tsx");
    const layout = source("src/app/layout.tsx");
    const contact = source("src/app/contact/page.tsx");
    const sitemap = source("src/app/sitemap.xml/route.ts");
    const routes = source("src/lib/siteRoutes.ts");

    expect(navigation).toContain('path: "/whatsapp"');
    expect(layout).toContain("<WhatsAppQuickContact />");
    expect(contact).toContain('href="/whatsapp"');
    expect(sitemap).toContain('"/whatsapp"');
    expect(routes).toContain('path: "/whatsapp"');
  });

  it("connects the authenticated portal to WhatsApp operations", () => {
    const portal = source("src/app/app/whatsapp/page.tsx");
    const platformNavigation = source("src/lib/platformNavigation.ts");
    const messages = source("src/app/app/messages/page.tsx");

    expect(portal).toContain("WhatsApp Operations");
    expect(portal).toContain("Mobile operator console");
    expect(platformNavigation).toContain('href: "/app/whatsapp"');
    expect(messages).toContain('title: "WhatsApp Operations"');
  });

  it("keeps sensitive material out of ordinary WhatsApp chat", () => {
    const page = source("src/app/whatsapp/page.tsx");

    expect(page).toContain("Do not send passwords, authentication codes, private keys");
    expect(page).toContain("Use the secure GEM portal");
    expect(page).toContain("human escalation");
  });
});
