/**
 * Pure helpers for the workspace module directory: URL-driven filter/search
 * state (shareable, bookmarkable) and per-workspace pinned modules.
 *
 * Pinning is presentational only: it reorders the directory for the viewer and
 * never changes what the viewer is entitled to see. Server-side readiness and
 * entitlement gates remain authoritative.
 */

export type ModuleDirectoryFilter = "all" | "ready" | "attention";

const VALID_FILTERS: ModuleDirectoryFilter[] = ["all", "ready", "attention"];

export function parseModuleDirectoryFilter(value: string | null): ModuleDirectoryFilter {
  return VALID_FILTERS.includes(value as ModuleDirectoryFilter)
    ? (value as ModuleDirectoryFilter)
    : "all";
}

export function pinStorageKey(workspaceId: string): string {
  return `gem.workspace.module-pins.${workspaceId}`;
}

export function readPinnedIds(
  storage: { getItem(key: string): string | null } | null | undefined,
  workspaceId: string,
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(pinStorageKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

export function togglePinnedId(pinned: string[], id: string): string[] {
  return pinned.includes(id) ? pinned.filter((entry) => entry !== id) : [...pinned, id];
}

export function orderPinnedFirst<T extends { id: string }>(items: T[], pinned: string[]): T[] {
  if (pinned.length === 0) return items;
  const rank = new Map(pinned.map((id, index) => [id, index]));
  const pinnedItems = items
    .filter((item) => rank.has(item.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const rest = items.filter((item) => !rank.has(item.id));
  return [...pinnedItems, ...rest];
}

/**
 * Build the query string for the module directory view, preserving unrelated
 * params already on the URL (e.g. ?workspace=).
 */
export function buildModuleDirectorySearch(
  currentSearch: string,
  filter: ModuleDirectoryFilter,
  query: string,
): string {
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  if (filter === "all") {
    params.delete("mtab");
  } else {
    params.set("mtab", filter);
  }
  const normalized = query.trim();
  if (!normalized) {
    params.delete("mq");
  } else {
    params.set("mq", normalized);
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}
