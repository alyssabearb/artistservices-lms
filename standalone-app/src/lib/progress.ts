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
