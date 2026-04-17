/**
 * Where “Finish” / back-to-track should send the learner (shared across readers).
 */

export const LMS_STORAGE_TRACK_RECORD_ID = "lms_track_recordId";

export function getFinishFallbackTrackRecordId(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FINISH_FALLBACK_TRACK_RECORD_ID) {
    return process.env.NEXT_PUBLIC_FINISH_FALLBACK_TRACK_RECORD_ID;
  }
  return "recpWuXPzsryX0TTP";
}

export function readStoredTrackRecordId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LMS_STORAGE_TRACK_RECORD_ID);
  } catch {
    return null;
  }
}

export function persistTrackRecordId(recordId: string): void {
  if (typeof window === "undefined" || !recordId) return;
  try {
    sessionStorage.setItem(LMS_STORAGE_TRACK_RECORD_ID, recordId);
  } catch {
    /* ignore */
  }
}

export type ResolveFinishTrackArgs = {
  trackIdFromUrl?: string | null;
  /** From course record when Airtable links one learning track (authoritative if URL/storage missing). */
  linkedLearningTrackIds?: string[];
};

/**
 * Prefer explicit track in URL, then a single Learning Track linked from the course (authoritative),
 * then last track-view / grid stamp, then env default. Linked track beats storage so a stale session
 * (e.g. after visiting a fallback Welcome track) cannot override the course’s real parent track.
 */
export function resolveFinishTrackRecordId(args: ResolveFinishTrackArgs): string {
  const u = args.trackIdFromUrl?.trim();
  if (u) return u;
  const links = args.linkedLearningTrackIds ?? [];
  if (links.length === 1 && links[0]?.trim()) return links[0].trim();
  const stored = readStoredTrackRecordId()?.trim();
  if (stored) return stored;
  return getFinishFallbackTrackRecordId();
}

export function buildTrackViewHref(personId: string | null | undefined, recordId: string): string {
  let u = `/track-view?recordId=${encodeURIComponent(recordId)}`;
  const p = personId?.trim();
  if (p) u += `&personId=${encodeURIComponent(p)}`;
  return u;
}
