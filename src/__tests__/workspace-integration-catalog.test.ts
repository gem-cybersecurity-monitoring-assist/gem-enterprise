import { describe, expect, it } from "vitest";
import {
  mergeWorkspaceIntegrations,
  workspaceIntegrationCatalog,
  type WorkspaceIntegrationItem,
} from "@/lib/workspaceIntegrationCatalog";

describe("Workspace OS integration catalogue", () => {
  it("provides at least 300 distinct, searchable provider applications", () => {
    expect(workspaceIntegrationCatalog.length).toBeGreaterThanOrEqual(300);
    expect(new Set(workspaceIntegrationCatalog.map((item) => item.id)).size).toBe(
      workspaceIntegrationCatalog.length,
    );
    expect(new Set(workspaceIntegrationCatalog.map((item) => item.title)).size).toBe(
      workspaceIntegrationCatalog.length,
    );
  });

  it("includes complete logo and governance metadata for every provider", () => {
    const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

    for (const item of workspaceIntegrationCatalog) {
      expect(item.logoDomain).toMatch(domainPattern);
      expect(item.href).toContain(encodeURIComponent(item.id));
      expect(item.kind).toBe("CATALOG");
      expect(item.readiness).toBe("AVAILABLE");
      expect(item.status).toMatch(/governed workspace connection/i);
    }
  });

  it("covers the company operating domains without flattening them into one category", () => {
    const categories = new Set(workspaceIntegrationCatalog.map((item) => item.category));
    expect(categories.size).toBeGreaterThanOrEqual(15);
    for (const category of [
      "Marketing & sales",
      "Development & delivery",
      "Security & identity",
      "AI & automation",
      "Crypto & Web3",
      "Wellbeing & health",
    ]) {
      expect(categories).toContain(category);
    }
  });

  it("prefers governed GEM surfaces over matching marketplace providers", () => {
    const githubSurface: WorkspaceIntegrationItem = {
      id: "github-governed-surface",
      href: "/app/command-center/development",
      title: "GitHub source control",
      description: "Governed source control.",
      category: "Development & delivery",
      status: "Human authorization required",
      readiness: "HUMAN_REQUIRED",
      logoDomain: "github.com",
      kind: "GEM_SURFACE",
    };

    const merged = mergeWorkspaceIntegrations([githubSurface]);
    expect(merged.filter((item) => item.logoDomain === "github.com")).toEqual([githubSurface]);
  });
});
