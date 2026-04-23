export type ProgressEntry = number | { lastViewedIndex?: number; completedAt?: string } | null | undefined;

/** Match Softr blocks: plain object with course-id keys (string response, wrapped { data }, or error). */
export function normalizeProgressResponse(data: unknown): Record<string, ProgressEntry> {
  if (data == null) return {};
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return {};
    }
  }
  if (typeof data !== "object" || Array.isArray(data)) return {};
  const obj = data as Record<string, unknown>;
  if (obj.error != null) return {};
  if (obj.data != null && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, ProgressEntry>;
  }
  return obj as Record<string, ProgressEntry>;
}

/** Base URL for GET progress (no trailing slash). Uses NEXT_PUBLIC_PROGRESS_API_URL when set. */
export function progressApiUrl(): string {
  const u =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_PROGRESS_API_URL
      ? process.env.NEXT_PUBLIC_PROGRESS_API_URL
      : "https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress";
  return String(u).replace(/\/$/, "");
}

function progressEntryLastIndex(v: ProgressEntry): number {
  if (v == null) return -1;
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof (v as { lastViewedIndex?: number }).lastViewedIndex === "number") {
    return (v as { lastViewedIndex: number }).lastViewedIndex;
  }
  return -1;
}

function progressEntryCompletedAt(v: ProgressEntry): string | undefined {
  if (v && typeof v === "object" && typeof (v as { completedAt?: string }).completedAt === "string") {
    return (v as { completedAt: string }).completedAt;
  }
  return undefined;
}

/**
 * Merge two progress maps by course id: higher lastViewedIndex wins; completedAt kept if present on either side.
 * Used so optimistic sessionStorage survives a slightly stale GET right after Finish.
 */
export function mergeProgressMaps(
  base: Record<string, ProgressEntry> | null | undefined,
  incoming: Record<string, ProgressEntry> | null | undefined
): Record<string, ProgressEntry> {
  const out: Record<string, ProgressEntry> =
    base && typeof base === "object" && !Array.isArray(base) ? { ...base } : {};
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return out;
  for (const [k, inc] of Object.entries(incoming)) {
    const prev = out[k];
    const pi = progressEntryLastIndex(prev);
    const ii = progressEntryLastIndex(inc);
    const pc = progressEntryCompletedAt(prev);
    const ic = progressEntryCompletedAt(inc);
    const lastViewedIndex = Math.max(pi, ii);
    const completedAt = ic || pc;
    if (completedAt) {
      out[k] = { lastViewedIndex, completedAt };
    } else if (lastViewedIndex >= 0) {
      out[k] = lastViewedIndex;
    }
  }
  return out;
}

/** Read merged course progress map from `lms_progress_data` (client only). */
export function readProgressMapFromSessionStorage(): Record<string, ProgressEntry> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("lms_progress_data");
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, ProgressEntry>;
  } catch {
    /* ignore */
  }
  return null;
}

export function lastViewedIndexFromEntry(v: ProgressEntry): number {
  return progressEntryLastIndex(v);
}
