import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { publicDigitalHubCatalog } from "@/lib/digital-hub/catalog";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WalletConnector } from "@/app/digital-hub/DigitalHubClient";

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const hasWalletSecretField = (tsxSource: string) => {
  const fields = tsxSource.match(/<(?:input|textarea)\b[^>]*>/gi) ?? [];
  const labels = Array.from(
    tsxSource.matchAll(/<(label|FormLabel)\b[^>]*>[\s\S]*?<\/\1>/gi),
    (match) => match[0],
  );
  const secretName = /\b(?:seed[\s_-]*phrase|recovery[\s_-]*phrase|backup[\s_-]*phrase|private[\s_-]*key|mnemonic)\b/i;
  return [...fields, ...labels].some((field) => secretName.test(field));
};

describe("Digital Hub full-stack rebuild", () => {
  it("exposes only validated public catalog data", () => {
    const hub = publicDigitalHubCatalog();
    expect(hub.referral.code).toBe("7PSOT6");
    expect(hub.referral.href).toContain("inviteCode=7PSOT6");
    expect(hub.connections.every((connection) => connection.href.startsWith("https://"))).toBe(true);
  });

  it("keeps custody and live trading disabled from the public hub", () => {
    const api = source("src/app/api/digital-hub/route.ts");
    expect(api).toContain("walletCustody: false");
    expect(api).toContain("privateKeyCollection: false");
    expect(api).toContain("liveTradingFromPublicHub: false");
  });

  it("does not carry the obsolete paper-trading service lane", () => {
    const catalog = source("src/lib/digital-hub/catalog.ts");
    expect(catalog.toLowerCase()).not.toContain("paper-trading");
    expect(catalog).toContain("Crypto market intelligence");
  });

  it("provides the rebuilt frontend and non-custodial wallet connectors", () => {
    const page = source("src/app/digital-hub/page.tsx");
    const client = source("src/app/digital-hub/DigitalHubClient.tsx");
    expect(page).toContain('href="/api/digital-hub"');
    expect(client).toContain('method: "eth_requestAccounts"');
    expect(client).toContain("window.phantom?.solana");
    expect(hasWalletSecretField(client)).toBe(false);
    const markup = renderToStaticMarkup(createElement(WalletConnector));
    expect(markup).toContain("GEM does not request a seed phrase, private key");
    expect(markup).not.toMatch(/<(?:input|textarea)\b/i);
  });

  it("rejects recovery fields and associated JSX labels without flagging safety disclaimers", () => {
    expect(hasWalletSecretField('<label htmlFor="wallet-seed">Seed phrase</label><input id="wallet-seed" />')).toBe(true);
    expect(hasWalletSecretField('<FormLabel>Recovery phrase</FormLabel><textarea />')).toBe(true);
    expect(hasWalletSecretField('<textarea name="privateKey"></textarea>')).toBe(true);
    expect(hasWalletSecretField('<input aria-label="Mnemonic" />')).toBe(true);
    expect(hasWalletSecretField('<p>GEM does not request a seed phrase or private key.</p>')).toBe(false);
  });
});
