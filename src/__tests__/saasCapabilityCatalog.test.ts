import { describe, expect, it } from "vitest";
import { listSaaSCapabilities, saasCapabilityCatalog } from "@/lib/saasCapabilityCatalog";

describe("prelaunch SaaS capability catalog", () => {
  it("uses unique stable IDs", () => {
    expect(new Set(saasCapabilityCatalog.map((item) => item.id)).size).toBe(saasCapabilityCatalog.length);
  });
  it("never claims a module is live", () => {
    expect(saasCapabilityCatalog.every((item) => ["existing-surface", "preview-only", "request-only", "planned"].includes(item.readiness))).toBe(true);
  });
  it("requires an activation gate for each module", () => {
    expect(saasCapabilityCatalog.every((item) => item.activationGate.trim().length > 0)).toBe(true);
  });
  it("filters capability areas without granting access", () => {
    const owner = listSaaSCapabilities("owner");
    expect(owner.length).toBeGreaterThan(0);
    expect(owner.every((item) => item.area === "owner")).toBe(true);
  });
  it("does not advertise payment activation or a public community", () => {
    expect(saasCapabilityCatalog.find((item) => item.id === "subscriptions")?.readiness).toBe("planned");
    expect(saasCapabilityCatalog.find((item) => item.id === "community")?.readiness).toBe("preview-only");
  });
});
