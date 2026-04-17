/**
 * “Total sections” on assignment rows — same rules as My Assigned Tracks cards
 * (explicit field names only; no generic *total*section* rollups).
 */

export function parsePositiveIntKnownTotalSections(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x) && x > 0) return Math.floor(x);
  if (typeof x === "string") {
    const n = parseInt(x.trim(), 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

/** Read Total Sections from one assignment record (top-level + fields), matching MyAssignedTracksGrid. */
export function readTotalSectionsFromAssignmentLikeRecord(rec: {
  id?: string;
  fields?: Record<string, unknown>;
  [k: string]: unknown;
}): number {
  const f = rec.fields as Record<string, unknown> | undefined;
  const recAny = rec as Record<string, unknown>;
  const parsed =
    parsePositiveIntKnownTotalSections(recAny?.["Total Sections"]) ??
    parsePositiveIntKnownTotalSections(recAny?.totalSections) ??
    parsePositiveIntKnownTotalSections(f?.["Total Sections"]) ??
    parsePositiveIntKnownTotalSections(f?.totalSections) ??
    parsePositiveIntKnownTotalSections(f?.["totalSections"]) ??
    parsePositiveIntKnownTotalSections(f?.["Total Section"]) ??
    parsePositiveIntKnownTotalSections(f?.["total_sections"]) ??
    parsePositiveIntKnownTotalSections(f?.["TotalSections"]);
  return parsed ?? 0;
}

/**
 * Grid rule: use parsed total, or if still zero use number of linked courses on that assignment
 * (same as MyAssignedTracksGrid when totalSectionsForTrack === 0 && courseIds.length > 0).
 */
export function assignmentDisplayTotalSections(
  rec: { id?: string; fields?: Record<string, unknown> },
  courseIdsLength: number
): number {
  let n = readTotalSectionsFromAssignmentLikeRecord(rec);
  if (n === 0 && courseIdsLength > 0) return courseIdsLength;
  return n;
}
