import { describe, expect, it } from "vitest";
import {
  buildModuleDirectorySearch,
  orderPinnedFirst,
  parseModuleDirectoryFilter,
  pinStorageKey,
  readPinnedIds,
  togglePinnedId,
} from "@/lib/workspaceModulePreferences";

describe("workspace module directory preferences", () => {
  describe("parseModuleDirectoryFilter", () => {
    it("accepts the known filter values", () => {
      expect(parseModuleDirectoryFilter("all")).toBe("all");
      expect(parseModuleDirectoryFilter("ready")).toBe("ready");
      expect(parseModuleDirectoryFilter("attention")).toBe("attention");
    });

    it("falls back to 'all' for unknown, empty, or missing values", () => {
      expect(parseModuleDirectoryFilter(null)).toBe("all");
      expect(parseModuleDirectoryFilter("")).toBe("all");
      expect(parseModuleDirectoryFilter("live")).toBe("all");
      expect(parseModuleDirectoryFilter("READY")).toBe("all");
    });
  });

  describe("buildModuleDirectorySearch", () => {
    it("encodes the tab and query into the search string", () => {
      expect(buildModuleDirectorySearch("", "ready", "finance")).toBe("?mtab=ready&mq=finance");
    });

    it("omits default tab and blank query so the URL stays clean", () => {
      expect(buildModuleDirectorySearch("", "all", "   ")).toBe("");
      expect(buildModuleDirectorySearch("?mtab=ready&mq=x", "all", "")).toBe("");
    });

    it("preserves unrelated params such as the workspace selector", () => {
      const result = buildModuleDirectorySearch("?workspace=ws_123&foo=bar", "attention", "tax");
      expect(result).toContain("workspace=ws_123");
      expect(result).toContain("foo=bar");
      expect(result).toContain("mtab=attention");
      expect(result).toContain("mq=tax");
    });

    it("handles a leading question mark in the current search", () => {
      expect(buildModuleDirectorySearch("?workspace=ws_1", "ready", "")).toBe("?workspace=ws_1&mtab=ready");
    });
  });

  describe("pinned modules", () => {
    it("scopes the storage key per workspace", () => {
      expect(pinStorageKey("ws_abc")).toBe("gem.workspace.module-pins.ws_abc");
      expect(pinStorageKey("ws_abc")).not.toBe(pinStorageKey("ws_xyz"));
    });

    it("reads persisted pins and rejects malformed payloads", () => {
      const storage = {
        getItem: (key: string) =>
          key === pinStorageKey("ws_1") ? JSON.stringify(["finance", "documents"]) : null,
      };
      expect(readPinnedIds(storage, "ws_1")).toEqual(["finance", "documents"]);
      expect(readPinnedIds(storage, "ws_other")).toEqual([]);
      expect(readPinnedIds(null, "ws_1")).toEqual([]);
      expect(readPinnedIds({ getItem: () => "not json" }, "ws_1")).toEqual([]);
      expect(readPinnedIds({ getItem: () => JSON.stringify({ a: 1 }) }, "ws_1")).toEqual([]);
      expect(readPinnedIds({ getItem: () => JSON.stringify(["ok", 42, null]) }, "ws_1")).toEqual(["ok"]);
    });

    it("toggles a pin id on and off", () => {
      expect(togglePinnedId([], "finance")).toEqual(["finance"]);
      expect(togglePinnedId(["finance"], "documents")).toEqual(["finance", "documents"]);
      expect(togglePinnedId(["finance", "documents"], "finance")).toEqual(["documents"]);
    });

    it("orders pinned modules first, in pin order, without dropping anything", () => {
      const items = [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ];
      expect(orderPinnedFirst(items, ["c", "a"]).map((i) => i.id)).toEqual(["c", "a", "b"]);
      expect(orderPinnedFirst(items, [])).toEqual(items);
      // Unknown pin ids are ignored, never fabricated.
      expect(orderPinnedFirst(items, ["zzz"]).map((i) => i.id)).toEqual(["a", "b", "c"]);
    });
  });
});
