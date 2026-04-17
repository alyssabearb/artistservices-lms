/** Shared field / link helpers aligned with Softr LMS blocks. */

export function getLinkedRecordId(
  linked: { id?: string; recordId?: string; label?: string; RecordID?: string } | string | unknown[] | null | undefined
): string | null {
  if (linked == null) return null;
  if (typeof linked === "string") return linked;
  if (Array.isArray(linked) && linked.length > 0) return getLinkedRecordId(linked[0] as { id?: string });
  const obj = linked as { id?: string; recordId?: string; RecordID?: string };
  const id = obj.id ?? obj.recordId ?? obj.RecordID;
  if (id != null && typeof id === "string") return id;
  for (const v of Object.values(linked as object)) {
    if (typeof v === "string" && /^rec[A-Za-z0-9]{14}$/.test(v)) return v;
  }
  return null;
}

/** Linked-record fields that point at Learning Tracks, not Courses (avoid treating a track as a “section”). */
function fieldNameLooksLikeLearningTrackLinks(fieldKey: string): boolean {
  const kl = fieldKey.toLowerCase();
  if (kl.includes("course")) return false;
  if (kl.includes("learning") && (kl.includes("track") || kl.includes("tracks"))) return true;
  if (/^tracks?$/.test(kl.trim())) return true;
  if (kl.includes("subtrack") || kl.includes("nested track")) return true;
  if (kl.includes("parent") && kl.includes("track")) return true;
  if (kl.includes("training") && kl.includes("track") && !kl.includes("course")) return true;
  return false;
}

function isLikelyNonCourseLinkArray(arr: unknown[]): boolean {
  if (arr.length === 0) return true;
  const first = arr[0];
  if (first == null) return true;
  if (typeof first === "number" || typeof first === "boolean") return true;
  if (typeof first === "string") return false;
  if (typeof first === "object" && first !== null) {
    const o = first as Record<string, unknown>;
    const rid = o.id;
    const hasRecId = typeof rid === "string" && /^rec[a-zA-Z0-9]{14,}$/.test(rid);
    if (typeof o.url === "string" && /^https?:\/\//i.test(o.url) && !hasRecId) return true;
  }
  return false;
}

/** Count how many entries look like Airtable linked record refs. */
function scoreArrayAsLinkedRecordIds(arr: unknown[]): number {
  let n = 0;
  for (const item of arr) {
    const id = getLinkedRecordId(item as { id?: string });
    if (id && /^rec[a-zA-Z0-9]{14,}$/.test(id)) n++;
  }
  return n;
}

/**
 * Linked course rows on a Learning Track (field names vary widely by base).
 * If no known field matches, scans other arrays of linked-record ids (avoids empty track UI when links live under a custom name).
 */
export function getLinkedCoursesFromTrackFields(fields: Record<string, unknown> | undefined): unknown[] {
  if (!fields) return [];
  const named = [
    "Courses",
    "courses",
    "Course",
    "course",
    "Training Courses",
    "trainingCourses",
    "Linked Courses",
    "linkedCourses",
    "Assigned Courses",
    "assignedCourses",
    "Course list",
    "course list",
    "Program Courses",
    "programCourses",
    "Curriculum",
    "curriculum",
    "Path Courses",
    "pathCourses",
  ] as const;
  for (const name of named) {
    const v = fields[name];
    if (Array.isArray(v) && v.length > 0 && scoreArrayAsLinkedRecordIds(v) > 0) return v;
  }
  for (const [k, v] of Object.entries(fields)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    if (fieldNameLooksLikeLearningTrackLinks(k)) continue;
    const kl = k.toLowerCase().replace(/\s/g, "");
    if (kl.includes("material") || kl.includes("resource") || kl.includes("section") || kl.includes("session")) continue;
    if (kl.includes("personnel") || kl.includes("contact") || kl.includes("assignee") || kl.includes("person")) continue;
    if (kl.includes("image") || kl.includes("photo") || kl.includes("file") || kl.includes("attachment")) continue;
    if (kl.includes("count") || kl.includes("total") || kl.includes("number") || kl.includes("rollup")) continue;
    if (kl.includes("course") || kl === "courses" || kl.includes("training") || kl.includes("curriculum") || kl.includes("program")) {
      if (fieldNameLooksLikeLearningTrackLinks(k)) continue;
      if (scoreArrayAsLinkedRecordIds(v) > 0) return v;
    }
  }

  type Cand = { key: string; arr: unknown[]; score: number; keyBonus: number };
  const cands: Cand[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (fieldNameLooksLikeLearningTrackLinks(k)) continue;
    if (!Array.isArray(v) || v.length === 0 || isLikelyNonCourseLinkArray(v)) continue;
    const kl = k.toLowerCase();
    if (kl.includes("personnel") || kl.includes("contact") || kl.includes("assignee")) continue;
    if (kl.includes("image") || kl.includes("photo") || kl.includes("attachment") || kl.includes("resource")) continue;
    if (kl.includes("section") && !kl.includes("course")) continue;
    const score = scoreArrayAsLinkedRecordIds(v);
    if (score === 0) continue;
    const keyBonus =
      (kl.includes("course") ? 4 : 0) +
      (kl.includes("training") ? 2 : 0) +
      (kl.includes("program") || kl.includes("curriculum") || kl.includes("path") ? 1 : 0);
    cands.push({ key: k, arr: v, score, keyBonus });
  }
  if (cands.length === 0) {
    for (const [k, v] of Object.entries(fields)) {
      if (fieldNameLooksLikeLearningTrackLinks(k)) continue;
      if (!Array.isArray(v) || v.length === 0 || isLikelyNonCourseLinkArray(v)) continue;
      const kl = k.toLowerCase();
      if (kl.includes("personnel") || kl.includes("contact") || kl.includes("assignee") || kl.includes("person")) continue;
      if (kl.includes("image") || kl.includes("photo") || kl.includes("attachment") || kl.includes("resource") || kl.includes("file")) continue;
      if (kl.includes("rollup") || kl.includes("count") || kl.includes("formula")) continue;
      const score = scoreArrayAsLinkedRecordIds(v);
      if (score === 0) continue;
      const minOk = v.length === 1 ? 1 : Math.max(2, Math.ceil(v.length * 0.45));
      if (score < minOk) continue;
      cands.push({ key: k, arr: v, score, keyBonus: 0 });
    }
  }
  if (cands.length === 0) {
    for (const [k, v] of Object.entries(fields)) {
      if (v == null || typeof v !== "object" || Array.isArray(v)) continue;
      if (fieldNameLooksLikeLearningTrackLinks(k)) continue;
      const kl = k.toLowerCase();
      if (!kl.includes("course") && !kl.includes("training") && !kl.includes("program")) continue;
      const id = getLinkedRecordId(v as { id?: string });
      if (id) return [v];
    }
    return [];
  }

  cands.sort((a, b) => {
    const d = b.score - a.score;
    if (d !== 0) return d;
    return b.keyBonus - a.keyBonus;
  });
  return cands[0].arr;
}

/** Plain course record ids linked on a Learning Track (for membership checks). */
export function getLinkedCourseIdsFromTrackFields(fields: Record<string, unknown> | undefined): string[] {
  const links = getLinkedCoursesFromTrackFields(fields);
  const ids = links.map((c: unknown) => getLinkedRecordId(c as { id?: string })).filter((x): x is string => Boolean(x));
  return [...new Set(ids)];
}

/** All Airtable ids for a course record when matching track ↔ course link fields. */
export function getCourseRecordIdVariants(course: Record<string, unknown> | { id?: string; fields?: Record<string, unknown> } | null | undefined): string[] {
  const out: string[] = [];
  const add = (x: unknown) => {
    if (x == null || typeof x !== "string") return;
    const s = x.trim();
    if (!/^rec[a-zA-Z0-9]{14,}$/.test(s) || out.includes(s)) return;
    out.push(s);
  };
  if (!course || typeof course !== "object") return out;
  const c = course as Record<string, unknown>;
  add(c.id);
  add(c.recordId);
  add(c.RecordID);
  add(c.record_id);
  const f = c.fields as Record<string, unknown> | undefined;
  if (f) {
    add(f.recordId);
    add(f.RecordID);
    add(f.record_id);
  }
  return out;
}

/** Learning Track record ids linked from a Course (field names vary by base). */
export function getLinkedLearningTrackIdsFromCourseFields(fields: Record<string, unknown> | undefined): string[] {
  if (!fields) return [];
  const candidates: unknown[] = [
    fields.learningTracks,
    fields["Learning Tracks"],
    fields.learningTrack,
    fields["Learning Track"],
    fields["Learning track"],
    fields["Assigned Learning Track"],
    fields.assignedLearningTrack,
    fields.parentTrack,
    fields["Parent Track"],
    fields.parentLearningTrack,
    fields["Parent Learning Track"],
    fields.tracks,
    fields.Tracks,
    fields.track,
    fields.Track,
  ];
  const ids: string[] = [];
  for (const ref of candidates) {
    if (ref == null) continue;
    if (Array.isArray(ref)) {
      for (const x of ref) {
        const id = getLinkedRecordId(x as { id?: string });
        if (id) ids.push(id);
      }
    } else {
      const id = getLinkedRecordId(ref as { id?: string });
      if (id) ids.push(id);
    }
  }
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    const kl = k.toLowerCase();
    const trackish =
      (kl.includes("learning") && kl.includes("track")) ||
      (kl.includes("learning") && kl.includes("tracks")) ||
      (kl === "tracks" && !kl.includes("course")) ||
      (kl === "track" && !kl.includes("course")) ||
      (kl.includes("parent") && kl.includes("track"));
    if (!trackish) continue;
    if (kl.includes("section") || kl.includes("session") || kl.includes("resource") || kl.includes("course")) continue;
    const arr = Array.isArray(v) ? v : [v];
    for (const x of arr) {
      const id = getLinkedRecordId(x as { id?: string });
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

export function getAssigneeLinkedIds(f: Record<string, unknown> | undefined): string[] {
  if (!f) return [];
  const refs = [f.personnel, f.Personnel, f.contact, f.Contact, f.contacts, f.Contacts];
  const ids: string[] = [];
  for (const ref of refs) {
    if (ref == null) continue;
    if (Array.isArray(ref)) {
      for (const x of ref) {
        const id = getLinkedRecordId(x as { id?: string });
        if (id) ids.push(id);
      }
    } else {
      const id = getLinkedRecordId(ref as { id?: string });
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

/** Titles from Training Sections / session records (Airtable field names vary). */
export function extractSectionTitleFromFields(fields: Record<string, unknown> | undefined): string | null {
  if (!fields) return null;
  const exact = fields["Section Title"];
  if (exact != null && String(exact).trim()) return String(exact).trim();
  const sessionName = fields["Session Name"] ?? fields["Session name"];
  if (sessionName != null && String(sessionName).trim()) return String(sessionName).trim();
  for (const k of Object.keys(fields)) {
    const lower = k.toLowerCase();
    if (lower.includes("section") && lower.includes("title")) {
      const v = fields[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  if (fields["Title"] != null && String(fields["Title"]).trim()) return String(fields["Title"]).trim();
  if (fields.label != null && String(fields.label).trim()) return String(fields.label).trim();
  if (fields.name != null && String(fields.name).trim()) return String(fields.name).trim();
  if (fields.title != null && String(fields.title).trim()) return String(fields.title).trim();
  for (const k of Object.keys(fields)) {
    if (k.toLowerCase().endsWith("title")) {
      const v = fields[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return null;
}

/** Linked Resource Library rows on a section (field names vary by base). */
export function getLinkedResourceIdsFromSectionFields(fields: Record<string, unknown> | undefined): string[] {
  if (!fields) return [];
  const tryArrays = [
    fields.linkedResources,
    fields["Linked Resources"],
    fields.resources,
    fields["Resources"],
    fields.resource,
    fields["Resource"],
  ];
  for (const ref of tryArrays) {
    if (!Array.isArray(ref) || ref.length === 0) continue;
    const ids = ref
      .map((r: unknown) => getLinkedRecordId(r as { id?: string }))
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) return [...new Set(ids)];
  }
  for (const [k, v] of Object.entries(fields)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const kl = k.toLowerCase().replace(/\s/g, "");
    if (
      (kl.includes("linked") && kl.includes("resource")) ||
      kl === "resources" ||
      (kl.includes("resource") && (kl.includes("link") || kl.includes("library")))
    ) {
      const ids = v
        .map((r: unknown) => getLinkedRecordId(r as { id?: string }))
        .filter((id): id is string => Boolean(id));
      if (ids.length > 0) return [...new Set(ids)];
    }
  }
  return [];
}

/** First displayable URL from an Airtable attachment / image field (array or single object; uses `url` or thumbnails). */
export function extractFirstAttachmentUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (/^https?:\/\//i.test(t)) return t;
    return null;
  }
  if (Array.isArray(value) && value.length > 0) {
    for (const item of value) {
      const u = attachmentItemUrl(item);
      if (u) return u;
    }
    return null;
  }
  return attachmentItemUrl(value);
}

function attachmentItemUrl(item: unknown): string | null {
  if (item == null || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.url === "string" && o.url.trim()) return o.url.trim();
  const th = o.thumbnails;
  if (th && typeof th === "object") {
    const t = th as Record<string, unknown>;
    for (const key of ["large", "full", "small"] as const) {
      const slot = t[key];
      if (slot && typeof slot === "object" && "url" in (slot as object)) {
        const u = (slot as { url?: string }).url;
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
  }
  return null;
}

/** Learning track card / header image from linked track fields (Learning Tracks table). */
export function getLearningTrackImageUrlFromFields(trackFields: Record<string, unknown> | undefined): string | null {
  if (!trackFields) return null;
  const candidates = [
    trackFields["Track Image"],
    trackFields.trackImage,
    trackFields.Image,
    trackFields.image,
  ];
  for (const v of candidates) {
    const u = extractFirstAttachmentUrl(v);
    if (u) return u;
  }
  return null;
}

export function getRecordId(r: Record<string, unknown> | { id?: string; fields?: Record<string, unknown> } | undefined): string | null {
  if (!r || typeof r !== "object") return null;
  const rec = r as Record<string, unknown>;
  const id = rec.id ?? rec.recordId ?? rec.record_id ?? rec.RecordID ?? rec.RecordId;
  if (id != null && typeof id === "string") return id;
  const f = rec.fields as Record<string, unknown> | undefined;
  const fid = f && (f.recordId ?? f.RecordID ?? f.record_id);
  if (fid != null && typeof fid === "string") return fid;
  return null;
}
