/** Same default as SectionContentBlock — POST updates lastViewedIndex in the progress store. */
export function sectionViewWebhookUrl(): string {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_SECTION_VIEW_URL
    ? String(process.env.NEXT_PUBLIC_SECTION_VIEW_URL)
    : "https://softr-learning-tracks-webhook-proxy.netlify.app/api/section-view";
}

export type SectionViewProgressPayload = {
  personId: string;
  courseId: string;
  sectionIds: string[];
  viewedSectionId: string;
};

/** POST section-view payload (matches SectionContentBlock / Softr webhook shape). */
export async function postSectionViewProgress(payload: SectionViewProgressPayload): Promise<void> {
  const url = sectionViewWebhookUrl();
  if (!url || typeof fetch === "undefined") return;
  const ids = payload.sectionIds.length > 0 ? payload.sectionIds.slice() : [payload.viewedSectionId];
  let idx = ids.indexOf(payload.viewedSectionId);
  if (idx === -1) idx = 0;
  const body = {
    personId: payload.personId,
    sectionId: payload.viewedSectionId,
    courseId: payload.courseId,
    viewedAt: new Date().toISOString(),
    lastViewedIndex: idx,
    personnelRecordIds: [payload.personId],
    contactRecordIds: [payload.personId],
    sectionRecordIds: [payload.viewedSectionId],
    courseRecordIds: [payload.courseId],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Do not throw — callers must not block navigation on webhook failures (CORS, 4xx, localhost).
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[section-view]", res.status, res.statusText);
    }
  }
}
