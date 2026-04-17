/**
 * Progress storage (localStorage) for section views.
 * Key: learningTracksProgress
 * Value: { [personId]: { [courseId]: { sectionIds: string[], lastViewedIndex: number } } }
 * Section "viewed" = section id is in sectionIds up to lastViewedIndex (0-based), or we record by section id.
 * We store the highest section index viewed per course so we can compute progress and "Continue".
 */

const STORAGE_KEY = "learningTracksProgress";

export type ProgressData = {
  [personId: string]: {
    [courseId: string]: {
      sectionIds: string[];
      lastViewedIndex: number;
    };
  };
};

function load(): ProgressData {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressData;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function save(data: ProgressData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function recordSectionView(
  personId: string,
  courseId: string,
  sectionIds: string[],
  viewedSectionId: string
): void {
  const data = load();
  if (!data[personId]) data[personId] = {};
  if (!data[personId][courseId]) data[personId][courseId] = { sectionIds: sectionIds.slice(), lastViewedIndex: -1 };
  const rec = data[personId][courseId];
  rec.sectionIds = sectionIds.slice();
  const idx = sectionIds.indexOf(viewedSectionId);
  if (idx !== -1 && idx > rec.lastViewedIndex) rec.lastViewedIndex = idx;
  save(data);
}

export function getLastViewedIndex(personId: string, courseId: string, sectionIds: string[]): number {
  const data = load();
  const rec = data[personId]?.[courseId];
  if (!rec || !Array.isArray(rec.sectionIds)) return -1;
  const maxIndex = Math.min(rec.lastViewedIndex, sectionIds.length - 1);
  if (maxIndex < 0) return -1;
  return maxIndex;
}

export function getCourseProgressPercent(personId: string, courseId: string, totalSections: number): number {
  if (totalSections <= 0) return 0;
  const data = load();
  const rec = data[personId]?.[courseId];
  if (!rec) return 0;
  const last = rec.lastViewedIndex;
  if (last < 0) return 0;
  const viewedCount = last + 1;
  return Math.round((viewedCount / totalSections) * 100);
}

export function getContinueSectionIndex(personId: string, courseId: string, sectionIds: string[]): number {
  return getLastViewedIndex(personId, courseId, sectionIds);
}
