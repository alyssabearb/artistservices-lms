/** Snapshot shown after a learner passes (for review). */
export type ComprehensionViewSnapshot = {
  question: string;
  correctLines: string[];
  explanation: string | null;
  freeSubmitted?: string;
};

const STORAGE_V = 2;

/** localStorage key for passed comprehension checkpoints (per person + course + section). */
export function comprehensionPassStorageKey(
  personId: string,
  courseId: string | null | undefined,
  sectionId: string
): string {
  const c = courseId ?? "";
  return `lms_comp_v1:${personId}:${c}:${sectionId}`;
}

export type ReadComprehensionOpts = {
  bypassPersistence?: boolean;
};

export function readComprehensionProgress(
  personId: string | null | undefined,
  courseId: string | null | undefined,
  sectionId: string | null | undefined,
  opts?: ReadComprehensionOpts
): { passed: boolean; snapshot: ComprehensionViewSnapshot | null } {
  if (!personId || !sectionId || typeof window === "undefined" || opts?.bypassPersistence) {
    return { passed: false, snapshot: null };
  }
  try {
    const raw = window.localStorage.getItem(comprehensionPassStorageKey(personId, courseId ?? "", sectionId));
    if (!raw) return { passed: false, snapshot: null };
    if (raw === "1") return { passed: true, snapshot: null };
    const o = JSON.parse(raw) as {
      v?: number;
      passed?: boolean;
      question?: string;
      correctLines?: string[];
      explanation?: string | null;
      freeSubmitted?: string;
    };
    if (o && o.v === STORAGE_V && o.passed) {
      return {
        passed: true,
        snapshot: {
          question: String(o.question ?? ""),
          correctLines: Array.isArray(o.correctLines) ? o.correctLines.map(String) : [],
          explanation: o.explanation != null ? String(o.explanation) : null,
          freeSubmitted: o.freeSubmitted != null ? String(o.freeSubmitted) : undefined,
        },
      };
    }
    return { passed: true, snapshot: null };
  } catch {
    return { passed: false, snapshot: null };
  }
}

export function writeComprehensionProgress(
  personId: string,
  courseId: string | null | undefined,
  sectionId: string,
  snapshot: ComprehensionViewSnapshot,
  opts?: ReadComprehensionOpts
): void {
  if (typeof window === "undefined" || opts?.bypassPersistence) return;
  try {
    const payload = JSON.stringify({
      v: STORAGE_V,
      passed: true,
      question: snapshot.question,
      correctLines: snapshot.correctLines,
      explanation: snapshot.explanation,
      freeSubmitted: snapshot.freeSubmitted,
    });
    window.localStorage.setItem(comprehensionPassStorageKey(personId, courseId ?? "", sectionId), payload);
  } catch {
    /* ignore */
  }
}

/** @deprecated use readComprehensionProgress */
export function readComprehensionPassed(
  personId: string | null | undefined,
  courseId: string | null | undefined,
  sectionId: string | null | undefined,
  opts?: ReadComprehensionOpts
): boolean {
  return readComprehensionProgress(personId, courseId, sectionId, opts).passed;
}

/** @deprecated use writeComprehensionProgress with a snapshot */
export function writeComprehensionPassed(
  personId: string,
  courseId: string | null | undefined,
  sectionId: string,
  opts?: ReadComprehensionOpts
): void {
  if (typeof window === "undefined" || opts?.bypassPersistence) return;
  try {
    window.localStorage.setItem(comprehensionPassStorageKey(personId, courseId ?? "", sectionId), "1");
  } catch {
    /* ignore */
  }
}
