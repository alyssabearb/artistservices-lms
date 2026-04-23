import { getLinkedRecordId } from "@/lib/lms-fields";

/**
 * Same Training Sections → linked record ids as `CourseDetailClient` uses for `sectionIdsInOrder`.
 * Counts only entries that resolve to a section id (excludes blanks / malformed links).
 */
export function countReaderOutlineSlotsFromCourse(courseData: { fields?: Record<string, unknown> } | undefined): number {
  const fields = courseData?.fields as Record<string, unknown> | undefined;
  const raw: unknown[] = Array.isArray(fields?.trainingSections)
    ? (fields.trainingSections as unknown[])
    : Array.isArray(fields?.["Training Sections"])
      ? (fields["Training Sections"] as unknown[])
      : [];
  return raw
    .map((s) => (typeof s === "string" ? s : getLinkedRecordId(s as { id?: string; recordId?: string })))
    .filter((id): id is string => Boolean(id)).length;
}

/**
 * Section count from a course Airtable row (outline arrays preferred over rollups).
 * Kept in sync with track-view / course reader semantics.
 */
export function getSectionCountFromCourse(courseData: { fields?: Record<string, unknown>; [k: string]: unknown } | undefined): number {
  function fromObj(obj: Record<string, unknown> | undefined): number {
    if (!obj) return 0;
    const explicit =
      Array.isArray(obj.trainingSections) ? obj.trainingSections
      : Array.isArray(obj["Training Sections"]) ? obj["Training Sections"]
      : Array.isArray(obj["Training sections"]) ? obj["Training sections"]
      : Array.isArray(obj.training_sections) ? obj.training_sections
      : Array.isArray(obj.Sections) ? obj.Sections
      : Array.isArray(obj["Course Sections"]) ? obj["Course Sections"]
      : Array.isArray(obj["Ordered Sections"]) ? obj["Ordered Sections"]
      : undefined;
    if (explicit && explicit.length > 0) return (explicit as unknown[]).length;
    const totalNum = obj.totalSections ?? obj["Total Sections"] ?? obj["Total sections"] ?? obj["total sections"] ?? obj.total_sections;
    if (typeof totalNum === "number" && totalNum >= 0) return totalNum;
    const totalParsed = typeof totalNum === "string" ? parseInt(totalNum, 10) : NaN;
    if (!Number.isNaN(totalParsed) && totalParsed >= 0) return totalParsed;
    for (const [key, val] of Object.entries(obj)) {
      if (/total.*section|section.*total/i.test(key) && (typeof val === "number" || (typeof val === "string" && /^\d+$/.test(val)))) {
        const n = typeof val === "number" ? val : parseInt(val, 10);
        if (!Number.isNaN(n) && n >= 0) return n;
      }
    }
    return 0;
  }
  const fromFields = fromObj(courseData?.fields as Record<string, unknown> | undefined);
  if (fromFields > 0) return fromFields;
  const asRecord = courseData as Record<string, unknown> | undefined;
  if (asRecord && typeof asRecord === "object" && !Array.isArray(asRecord) && asRecord.fields !== asRecord) {
    return fromObj(asRecord);
  }
  return 0;
}
