"use client";
/**
 * Track detail / track-view (standalone: /api/tracks + /api/courses/list).
 */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  mergeProgressMaps,
  progressApiUrl,
  readProgressMapFromSessionStorage,
  type ProgressEntry as StoredProgressEntry,
} from "@/lib/progress";
import { getLinkedCoursesFromTrackFields } from "@/lib/lms-fields";
import { assignmentDisplayTotalSections } from "@/lib/lms-assignment-section-total";
import { LMS_STORAGE_TRACK_RECORD_ID, persistTrackRecordId } from "@/lib/lms-track-nav";
import { countReaderOutlineSlotsFromCourse } from "@/lib/lms-course-section-count";

const PAGE_SLUGS = {
  learningTracks: "/learning-tracks",
  myLearningTracks: "/my-learning-tracks",
  courseDetail: "/section-detail",
};

type ProgressEntry = number | { lastViewedIndex: number; startedAt?: string; completedAt?: string };
type ApiProgressMap = Record<string, ProgressEntry> | null;

/** Ensure we have a plain object with course-id keys (handle string response, wrapped { data }, or error). */
function normalizeProgressResponse(data: unknown): ApiProgressMap {
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
    return obj.data as ApiProgressMap;
  }
  return obj as ApiProgressMap;
}

function readProgressEntryFromRaw(raw: ProgressEntry | null | undefined): {
  lastViewedIndex: number;
  startedAt?: string;
  completedAt?: string;
} | null {
  if (raw == null) return null;
  const lastViewedIndex =
    typeof raw === "number"
      ? raw
      : typeof (raw as { lastViewedIndex?: number }).lastViewedIndex === "number"
        ? (raw as { lastViewedIndex: number }).lastViewedIndex
        : -1;
  const startedAt =
    typeof raw === "object" && raw !== null && "startedAt" in raw ? (raw as { startedAt?: string }).startedAt : undefined;
  const completedAt =
    typeof raw === "object" && raw !== null && "completedAt" in raw ? (raw as { completedAt?: string }).completedAt : undefined;
  return { lastViewedIndex: lastViewedIndex >= -1 ? lastViewedIndex : -1, startedAt, completedAt };
}

/** Prefer completion, then highest lastViewedIndex, across all id aliases (never use Object.keys order as course order). */
function compareProgressEntries(
  a: { lastViewedIndex: number; startedAt?: string; completedAt?: string },
  b: { lastViewedIndex: number; startedAt?: string; completedAt?: string }
): number {
  const ac = Boolean(a.completedAt);
  const bc = Boolean(b.completedAt);
  if (ac !== bc) return ac ? 1 : -1;
  if (a.lastViewedIndex !== b.lastViewedIndex) return a.lastViewedIndex - b.lastViewedIndex;
  return 0;
}

function getProgressEntryFromApi(
  apiProgress: ApiProgressMap,
  tryKey: string | undefined,
  ...possibleIds: (string | null | undefined)[]
): { lastViewedIndex: number; startedAt?: string; completedAt?: string } {
  if (!apiProgress) return { lastViewedIndex: -1 };
  const ids = new Set<string>();
  if (tryKey) ids.add(tryKey);
  for (const id of possibleIds) {
    if (id && typeof id === "string") ids.add(id);
  }
  let best: { lastViewedIndex: number; startedAt?: string; completedAt?: string } = { lastViewedIndex: -1 };
  for (const id of ids) {
    if (!(id in apiProgress)) continue;
    const entry = readProgressEntryFromRaw(apiProgress[id]);
    if (!entry) continue;
    if (compareProgressEntries(entry, best) > 0) best = entry;
  }
  return best;
}

function getLastViewedIndexFromApi(apiProgress: ApiProgressMap, tryKey: string | undefined, ...possibleIds: (string | null | undefined)[]): number {
  return getProgressEntryFromApi(apiProgress, tryKey, ...possibleIds).lastViewedIndex;
}

function getProgressFromApi(personId: string, totalSections: number, apiProgress: ApiProgressMap, tryKey: string | undefined, ...possibleCourseIds: (string | null | undefined)[]): number {
  if (!personId) return 0;
  const entry = getProgressEntryFromApi(apiProgress, tryKey, ...possibleCourseIds);
  if (entry.completedAt) return 100;
  const lastIdx = entry.lastViewedIndex;
  if (lastIdx < 0) return 0;
  if (totalSections === 0) return 100;
  const capped = Math.min(lastIdx, Math.max(0, totalSections - 1));
  return Math.min(100, Math.round(((capped + 1) / totalSections) * 100));
}

function formatDateMMDDYYYY(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return "Duration not set";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`;
}

function getLinkedRecordId(
  linked: { id?: string; recordId?: string; label?: string; [k: string]: unknown } | string | unknown[] | null | undefined
): string | null {
  if (linked == null) return null;
  if (typeof linked === "string") return linked;
  if (Array.isArray(linked) && linked.length > 0) return getLinkedRecordId(linked[0] as { id?: string });
  const obj = linked as { id?: string; recordId?: string; [k: string]: unknown };
  const id = obj.id ?? obj.recordId ?? (obj as { RecordID?: string }).RecordID;
  if (id != null && typeof id === "string") return id;
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && /^rec[A-Za-z0-9]{14}$/.test(v)) return v;
  }
  return null;
}

function getRecordId(r: Record<string, unknown> | { id?: string; fields?: Record<string, unknown> } | undefined): string | null {
  if (!r || typeof r !== "object") return null;
  const rec = r as Record<string, unknown>;
  const id = rec.id ?? rec.recordId ?? rec.record_id ?? rec.RecordID ?? rec.RecordId;
  if (id != null && typeof id === "string") return id;
  const f = rec.fields as Record<string, unknown> | undefined;
  const fid = f && (f.recordId ?? f.RecordID ?? f.record_id);
  if (fid != null && typeof fid === "string") return fid;
  return null;
}

function findRecordById<T extends { id?: string; fields?: Record<string, unknown>; [k: string]: unknown }>(
  records: T[],
  id: string | null
): T | undefined {
  if (!id) return undefined;
  return records.find((r) => getRecordId(r as Record<string, unknown>) === id);
}

/** Index API course rows by every id shape Airtable may use so list lookup matches linked fields. */
function indexCoursesByRecordId(records: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    const top = getRecordId(r);
    if (top) m.set(top, r);
    const f = r.fields as Record<string, unknown> | undefined;
    if (f) {
      const fr = f.recordId ?? f.RecordID ?? f.record_id;
      if (fr != null && typeof fr === "string") m.set(String(fr), r);
    }
  }
  return m;
}

function extractCourseTitle(
  courseData: { fields?: Record<string, unknown> } | undefined,
  courseRef: unknown,
  courseLabel: string | undefined
): string {
  const fromFields = (f: Record<string, unknown> | undefined) => {
    if (!f) return "";
    const t =
      f["Course Title"] ??
      f.title ??
      f.Title ??
      f.Name ??
      f.name ??
      f["Name"] ??
      f.label ??
      f.Label ??
      f["Course name"];
    return t != null && String(t).trim() ? String(t).trim() : "";
  };
  if (courseRef && typeof courseRef === "object") {
    const o = courseRef as { fields?: Record<string, unknown> };
    const s = fromFields(o.fields);
    if (s) return s;
  }
  const s2 = fromFields(courseData?.fields);
  if (s2) return s2;
  if (courseLabel && String(courseLabel).trim()) return String(courseLabel).trim();
  return "Untitled Course";
}

function resolveCourseRow(
  allCoursesList: Record<string, unknown>[],
  courseRef: unknown,
  courseAirtableId: string | null,
  index: number,
  coursesLength?: number
): { id?: string; fields?: Record<string, unknown>; [k: string]: unknown } | undefined {
  let row = findRecordById(allCoursesList, courseAirtableId) as { id?: string; fields?: Record<string, unknown> } | undefined;
  const sameOrder =
    coursesLength != null &&
    coursesLength > 0 &&
    coursesLength === allCoursesList.length &&
    index >= 0 &&
    index < allCoursesList.length;
  if (!row && sameOrder) {
    row = allCoursesList[index] as { id?: string; fields?: Record<string, unknown> };
  }
  if (!row && courseRef && typeof courseRef === "object") {
    const o = courseRef as { id?: string; fields?: unknown };
    if (o.fields && typeof o.fields === "object") {
      row = { id: typeof o.id === "string" ? o.id : courseAirtableId ?? undefined, fields: o.fields as Record<string, unknown> };
    }
  }
  return row;
}

const REC_ID = /^rec[A-Za-z0-9]{14}$/;
function collectCourseIdsForProgress(
  courseRef: unknown,
  courseData: { id?: string; fields?: Record<string, unknown> } | undefined
): (string | undefined)[] {
  const ids: (string | undefined)[] = [];
  const linkedId = getLinkedRecordId(courseRef as { id?: string } | string);
  if (linkedId) ids.push(linkedId);
  if (courseData?.id) ids.push(courseData.id);
  const f = courseData?.fields as Record<string, unknown> | undefined;
  if (f) {
    const rId = f.recordId ?? f.RecordID;
    if (rId != null && typeof rId === "string" && REC_ID.test(rId)) ids.push(rId);
    for (const v of Object.values(f)) {
      if (typeof v === "string" && REC_ID.test(v)) ids.push(v);
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && REC_ID.test(v[0])) ids.push(v[0]);
    }
  }
  if (courseRef && typeof courseRef === "object" && "id" in courseRef && typeof (courseRef as { id: string }).id === "string") {
    ids.push((courseRef as { id: string }).id);
  }
  return ids;
}

function stripYearSuffix(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return s ?? "";
  return s.replace(/\s*-\s*20\d{2}\s*$/, "").trim() || s;
}

function parsePositiveInt(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x) && x > 0) return Math.floor(x);
  if (typeof x === "string") {
    const n = parseInt(x.trim(), 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

const LMS_STORAGE_PERSON_ID = "lms_track_personId";

function getUrlParams(): { recordId: string | null; personId: string | null } {
  if (typeof window === "undefined") return { recordId: null, personId: null };
  function fromSearch(search: string) {
    const params = new URLSearchParams(search || "");
    return { recordId: params.get("recordId"), personId: params.get("personId") };
  }
  try {
    let search = window.location.search || "";
    if (!search && typeof window.parent !== "undefined" && window.parent !== window) {
      try {
        search = window.parent.location.search || "";
      } catch (_) {}
    }
    if (!search && typeof window.top !== "undefined" && window.top !== window) {
      try {
        search = window.top!.location.search || "";
      } catch (_) {}
    }
    let { recordId, personId } = fromSearch(search);
    try {
      if (!recordId) recordId = sessionStorage.getItem(LMS_STORAGE_TRACK_RECORD_ID);
      if (!personId) personId = sessionStorage.getItem(LMS_STORAGE_PERSON_ID);
    } catch (_) {}
    return { recordId, personId };
  } catch {
    return { recordId: null, personId: null };
  }
}

class TrackDetailErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: unknown }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, maxWidth: 600, margin: "0 auto", fontFamily: "sans-serif" }}>
          <p style={{ marginBottom: 16, color: "#b91c1c" }}>Something went wrong loading this track.</p>
          <p style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>{String(this.state.error)}</p>
          <a href="/my-learning-tracks" style={{ display: "inline-block", padding: "8px 16px", background: "#f3f4f6", borderRadius: 6, color: "#111" }}>
            Back to My Learning Tracks
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

const LOG = (label: string, data?: unknown) => {
  if (typeof window !== "undefined") {
    if (data !== undefined) console.log("[TrackDetail]", label, data);
    else console.log("[TrackDetail]", label);
  }
};

function BlockInner() {
  const paramsFromUrl = useMemo(() => {
    const p = getUrlParams();
    LOG("1. paramsFromUrl (useMemo)", { recordId: p.recordId, personId: p.personId, hasPersonId: Boolean(p.personId) });
    return p;
  }, []);

  const [urlParams, setUrlParams] = useState<{ recordId: string | null; personId: string | null }>(getUrlParams);
  const [mounted, setMounted] = useState(false);
  const [apiProgress, setApiProgress] = useState<ApiProgressMap>(null);

  useEffect(() => {
    setMounted(true);
    setUrlParams(getUrlParams());
  }, []);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem("lms_progress_data");
      LOG("2. sessionStorage lms_progress_data", s ? `found, length=${s.length}` : "not set");
      if (s) {
        const p = JSON.parse(s) as unknown;
        if (p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length > 0) {
          const keys = Object.keys(p as object);
          LOG("2b. sessionStorage parsed keys", keys);
          setApiProgress((prev) => {
            LOG("2c. sessionStorage merge apiProgress", keys);
            return mergeProgressMaps(prev, p as ApiProgressMap) as ApiProgressMap;
          });
        }
      }
    } catch (e) {
      LOG("2. sessionStorage error", String(e));
    }
  }, []);

  const refetchProgressFromApi = useCallback(() => {
    const base = progressApiUrl();
    if (!base) {
      LOG("3. fetch skipped", "no progress API URL");
      return Promise.resolve();
    }
    const pid = urlParams.personId ?? paramsFromUrl.personId;
    if (!pid) {
      LOG("3. fetch skipped", "no personId");
      return Promise.resolve();
    }
    const url = base + (base.includes("?") ? "&" : "?") + "personId=" + encodeURIComponent(pid);
    LOG("3. fetch starting", { personId: pid, url: url.slice(0, 80) + "..." });
    return fetch(url, { cache: "no-store" })
      .then((r) => {
        LOG("3b. fetch response", { ok: r.ok, status: r.status });
        return r.ok ? r.json() : Promise.reject(new Error("Progress fetch failed " + r.status));
      })
      .then((data) => {
        const next = normalizeProgressResponse(data);
        const keyCount = next && typeof next === "object" ? Object.keys(next).length : 0;
        LOG("3c. fetch success", { keyCount, keys: next && typeof next === "object" ? Object.keys(next) : [] });
        setApiProgress((prev) => {
          let merged = mergeProgressMaps(prev, next);
          try {
            if (typeof window !== "undefined") {
              const s = sessionStorage.getItem("lms_progress_data");
              if (s) {
                const parsed = JSON.parse(s) as Record<string, StoredProgressEntry>;
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  merged = mergeProgressMaps(merged, parsed);
                }
              }
            }
            if (typeof window !== "undefined" && merged && typeof merged === "object" && Object.keys(merged).length > 0) {
              sessionStorage.setItem("lms_progress_data", JSON.stringify(merged));
            }
          } catch {
            /* ignore */
          }
          return merged as ApiProgressMap;
        });
      })
      .catch((err) => {
        LOG("3d. fetch error", String(err?.message || err));
      });
  }, [urlParams.personId, paramsFromUrl.personId]);

  /** After hydration, `urlParams` has the real query string (SSR first paint often had nulls). */
  useEffect(() => {
    if (!mounted) return;
    void refetchProgressFromApi();
  }, [mounted, refetchProgressFromApi]);

  useEffect(() => {
    if (!mounted) return;
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refetchProgressFromApi();
      }
    };
    const onPageShow = () => {
      void refetchProgressFromApi();
    };
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [mounted, refetchProgressFromApi]);

  const selectedTrackId = paramsFromUrl.recordId ?? urlParams.recordId ?? (typeof window !== "undefined" ? getUrlParams().recordId : null);
  const personId = paramsFromUrl.personId ?? urlParams.personId ?? (typeof window !== "undefined" ? getUrlParams().personId : null);
  LOG("4. resolved", { selectedTrackId, personId, hasPersonId: Boolean(personId) });

  useEffect(() => {
    const keys = apiProgress && typeof apiProgress === "object" ? Object.keys(apiProgress) : [];
    LOG("5. apiProgress state", { isNull: apiProgress == null, keyCount: keys.length, keys });
  }, [apiProgress]);

  const [trackRecord, setTrackRecord] = useState<{ id?: string; fields?: Record<string, unknown> } | null>(null);
  const [allCoursesList, setAllCoursesList] = useState<Record<string, unknown>[]>([]);
  const [trackDetailStatus, setTrackDetailStatus] = useState<"pending" | "success" | "error">("pending");
  const [coursesStatus, setCoursesStatus] = useState<"pending" | "success" | "error">("pending");
  /** Same “Total Sections” as My Assigned Tracks cards (assignment row), when this learner has an assignment for this track. */
  const [assignmentTotalSectionsForTrack, setAssignmentTotalSectionsForTrack] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedTrackId) {
      setTrackRecord(null);
      setAllCoursesList([]);
      setTrackDetailStatus("success");
      setCoursesStatus("success");
      return;
    }
    let cancelled = false;
    (async () => {
      setTrackDetailStatus("pending");
      setCoursesStatus("pending");
      try {
        const trRes = await fetch(`/api/tracks/${encodeURIComponent(selectedTrackId)}`);
        if (!trRes.ok) throw new Error("track");
        const tr = (await trRes.json()) as { id: string; fields: Record<string, unknown> };
        if (cancelled) return;
        setTrackRecord(tr);
        setTrackDetailStatus("success");
        const courseLinks = getLinkedCoursesFromTrackFields(tr.fields as Record<string, unknown> | undefined);
        const ids = courseLinks.map((c: unknown) => getLinkedRecordId(c as { id?: string })).filter((x): x is string => Boolean(x));
        const list: Record<string, unknown>[] = [];
        if (ids.length > 0) {
          const cr = await fetch(`/api/courses/list?ids=${encodeURIComponent(ids.join(","))}`);
          const d = (await cr.json()) as { records?: Record<string, unknown>[] };
          const byId = indexCoursesByRecordId(d.records ?? []);
          for (let i = 0; i < courseLinks.length; i++) {
            const ref = courseLinks[i];
            const id = getLinkedRecordId(ref as { id?: string });
            if (!id) continue;
            let row = byId.get(id) as Record<string, unknown> | undefined;
            if (!row && ref && typeof ref === "object") {
              const o = ref as { id?: string; fields?: unknown };
              if (o.fields && typeof o.fields === "object") {
                row = { id: typeof o.id === "string" ? o.id : id, fields: o.fields as Record<string, unknown> };
              }
            }
            if (!row) {
              try {
                const one = await fetch(`/api/courses/${encodeURIComponent(id)}`);
                if (one.ok) {
                  const jr = (await one.json()) as { id?: string; fields?: Record<string, unknown> };
                  if (jr?.fields) row = { id: jr.id ?? id, fields: jr.fields };
                }
              } catch {
                /* skip */
              }
            }
            if (row) list.push(row);
          }
        }
        if (!cancelled) {
          setAllCoursesList(list);
          setCoursesStatus("success");
          try {
            if (typeof window !== "undefined" && selectedTrackId) {
              persistTrackRecordId(selectedTrackId);
              if (personId) sessionStorage.setItem(LMS_STORAGE_PERSON_ID, personId);
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!cancelled) {
          setTrackRecord(null);
          setAllCoursesList([]);
          setTrackDetailStatus("error");
          setCoursesStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTrackId, personId]);

  const selectedTrack = trackRecord;
  const hasValidTrack = Boolean(
    selectedTrack && typeof selectedTrack === "object" && ("fields" in selectedTrack || "id" in selectedTrack)
  );

  const goBack = () => {
    if (typeof window !== "undefined") {
      const base = personId
        ? `${PAGE_SLUGS.myLearningTracks}?personId=${encodeURIComponent(personId)}`
        : PAGE_SLUGS.learningTracks;
      window.location.href = base;
    }
  };

  const goToCourse = (courseId: string) => {
    let url = `${PAGE_SLUGS.courseDetail}?recordId=${encodeURIComponent(courseId)}&trackId=${encodeURIComponent(selectedTrackId ?? "")}`;
    if (personId) url += `&personId=${encodeURIComponent(personId)}`;
    if (typeof window !== "undefined") window.location.href = url;
  };

  const trackFields = selectedTrack?.fields ?? {};
  const courses = getLinkedCoursesFromTrackFields(trackFields as Record<string, unknown>);
  useEffect(() => {
    if (!personId || !selectedTrackId) {
      setAssignmentTotalSectionsForTrack(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/assignments?personId=${encodeURIComponent(personId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { records?: { id?: string; fields?: Record<string, unknown> }[] }) => {
        if (cancelled) return;
        let best = 0;
        for (const rec of data.records ?? []) {
          const f = rec.fields;
          if (!f) continue;
          const tid = getLinkedRecordId((f.track ?? f.Track) as { id?: string } | string | undefined);
          if (tid !== selectedTrackId) continue;
          const n = assignmentDisplayTotalSections(rec, courses.length);
          if (n > best) best = n;
        }
        setAssignmentTotalSectionsForTrack(best > 0 ? best : null);
      })
      .catch(() => {
        if (!cancelled) setAssignmentTotalSectionsForTrack(null);
      });
    return () => {
      cancelled = true;
    };
  }, [personId, selectedTrackId, courses.length]);

  const tf = trackFields as Record<string, unknown>;
  /** Track-level “total sections” only — never use Course Count here (wrong semantics and often breaks rollups). */
  const trackTotalSectionsRaw =
    parsePositiveInt(tf?.totalSections) ??
    parsePositiveInt(tf?.["Total Sections"]) ??
    parsePositiveInt(tf?.["total sections"]) ??
    parsePositiveInt(tf?.total_sections);

  const sumOutlineFromCourses = useMemo(() => {
    let s = 0;
    courses.forEach((courseRef, i) => {
      const courseAirtableId = getLinkedRecordId(courseRef as { id?: string } | string);
      const courseData = resolveCourseRow(allCoursesList, courseRef, courseAirtableId, i, courses.length);
      let n = countReaderOutlineSlotsFromCourse(courseData);
      if (n === 0 && courseRef && typeof courseRef === "object") {
        n = countReaderOutlineSlotsFromCourse(courseRef as { fields?: Record<string, unknown> });
      }
      s += n;
    });
    return s;
  }, [courses, allCoursesList]);

  /** Assignment “Total Sections” (My Learning Tracks cards) wins over track-record rollups. */
  const trackCapForDefaults =
    assignmentTotalSectionsForTrack != null && assignmentTotalSectionsForTrack > 0
      ? assignmentTotalSectionsForTrack
      : trackTotalSectionsRaw != null && trackTotalSectionsRaw > 0
        ? sumOutlineFromCourses > 0
          ? Math.min(trackTotalSectionsRaw, sumOutlineFromCourses)
          : trackTotalSectionsRaw
        : null;

  /**
   * Section counts from each course’s Training Sections outline only (matches the course reader).
   * Do not inflate from assignment caps / rollups — that made track cards (e.g. 27%) disagree with in-course (100%).
   */
  const outlineSectionSlotsPerCourse = useMemo(() => {
    return courses.map((courseRef, i) => {
      const courseAirtableId = getLinkedRecordId(courseRef as { id?: string } | string);
      const courseData = resolveCourseRow(allCoursesList, courseRef, courseAirtableId, i, courses.length);
      let sectionCount = countReaderOutlineSlotsFromCourse(courseData);
      if (sectionCount === 0 && courseRef && typeof courseRef === "object") {
        sectionCount = countReaderOutlineSlotsFromCourse(courseRef as { fields?: Record<string, unknown> });
      }
      return sectionCount > 0 ? sectionCount : 1;
    });
  }, [courses, allCoursesList]);

  const courseProgressValues = useMemo(() => {
    if (!personId) {
      LOG("6. courseProgressValues", "no personId, returning all 0");
      return courses.map(() => 0);
    }
    if (courses.length > 0) {
      const firstRef = courses[0];
      const firstId = getLinkedRecordId(firstRef as { id?: string } | string);
      const firstResolved = resolveCourseRow(allCoursesList, firstRef, firstId, 0, courses.length);
      const sectionCountFirst = countReaderOutlineSlotsFromCourse(firstResolved as { fields?: Record<string, unknown> });
      const fromRef = countReaderOutlineSlotsFromCourse(firstRef as { fields?: Record<string, unknown> });
      const raw = firstResolved as Record<string, unknown> | undefined;
      const rawKeys = raw ? Object.keys(raw) : [];
      const rawFields = raw?.fields as Record<string, unknown> | undefined;
      const fieldKeys = rawFields ? Object.keys(rawFields) : [];
      LOG("6. debug first course", {
        allCoursesListLength: allCoursesList.length,
        slotsUsed: outlineSectionSlotsPerCourse[0],
        sectionCountFromResolved: sectionCountFirst,
        sectionCountFromRef: fromRef,
        topLevelKeys: rawKeys,
        fieldKeys,
        totalSectionsTop: raw?.["Total Sections"] ?? raw?.totalSections,
        totalSectionsInFields: rawFields?.["Total Sections"] ?? rawFields?.totalSections,
        trackCapForDefaults,
        sumOutlineFromCourses,
        assignmentTotalSectionsForTrack,
      });
    }
    const mapForCards = mergeProgressMaps(apiProgress, readProgressMapFromSessionStorage() ?? undefined) as ApiProgressMap;
    const values = courses.map((courseRef, i) => {
      const courseAirtableId = getLinkedRecordId(courseRef as { id?: string } | string);
      const courseData = resolveCourseRow(allCoursesList, courseRef, courseAirtableId, i, courses.length);
      const fields = courseData?.fields as Record<string, unknown> | undefined;
      const recordIdVal = fields && (fields.recordId ?? fields.RecordID);
      const idForNav = courseData?.id ?? (recordIdVal != null ? String(recordIdVal) : null) ?? courseAirtableId;
      const sectionCount = outlineSectionSlotsPerCourse[i] ?? 1;
      const collected = collectCourseIdsForProgress(courseRef, courseData);
      const possibleIds = [courseAirtableId ?? undefined, idForNav ?? undefined, ...collected].filter((x): x is string => Boolean(x && typeof x === "string"));
      const tryKey = (courseAirtableId ?? idForNav) as string | undefined;
      return getProgressFromApi(personId, sectionCount, mapForCards, tryKey, ...possibleIds);
    });
    LOG("6. courseProgressValues", {
      coursesCount: courses.length,
      progressKeyCount: apiProgress ? Object.keys(apiProgress).length : 0,
      values,
    });
    return values;
  }, [
    personId,
    courses,
    allCoursesList,
    apiProgress,
    outlineSectionSlotsPerCourse,
    sumOutlineFromCourses,
    trackCapForDefaults,
    assignmentTotalSectionsForTrack,
  ]);

  const trackRollup = useMemo(() => {
    const sumSlots = outlineSectionSlotsPerCourse.reduce((a, b) => a + b, 0) || courses.length;
    const canonical =
      assignmentTotalSectionsForTrack != null && assignmentTotalSectionsForTrack > 0
        ? assignmentTotalSectionsForTrack
        : null;

    if (!personId) {
      const denom = canonical ?? sumSlots;
      LOG("7. tally", { totalViewed: 0, totalSections: denom, reason: "no personId" });
      return { totalViewed: 0, totalSections: denom };
    }

    if (courses.length > 0 && allCoursesList.length > 0) {
      const firstResolved = resolveCourseRow(allCoursesList, courses[0], getLinkedRecordId(courses[0] as { id?: string } | string), 0, courses.length);
      const f = firstResolved?.fields as Record<string, unknown> | undefined;
      const fieldKeys = f ? Object.keys(f) : [];
      const sectionLike = f ? Object.fromEntries(Object.entries(f).filter(([k]) => /section|Section/.test(k))) : {};
      LOG("7. debug first course fields", { fieldKeys, sectionLike, trainingSections: f?.trainingSections, trainingSectionsType: typeof f?.trainingSections });
    }

    /** Slot-weighted sum of each course’s % (same numbers as the per-course cards), not “whole sections started”. */
    let weightedSlots = 0;
    courses.forEach((courseRef, i) => {
      const sectionCount = outlineSectionSlotsPerCourse[i] ?? 1;
      const progressPct = Math.min(100, Math.max(0, courseProgressValues[i] ?? 0));
      weightedSlots += (progressPct / 100) * sectionCount;
    });
    const totalSections = canonical ?? sumSlots;
    let totalViewed = weightedSlots;
    if (canonical != null && sumSlots > 0 && canonical !== sumSlots) {
      totalViewed = (weightedSlots / sumSlots) * canonical;
    }
    LOG("7. tally", {
      weightedSlots,
      totalViewed,
      totalSections,
      sumSlots,
      canonical,
      percent: totalSections ? Math.round((100 * totalViewed) / totalSections) : 0,
    });
    return { totalViewed, totalSections };
  }, [
    personId,
    courses,
    allCoursesList,
    apiProgress,
    outlineSectionSlotsPerCourse,
    courseProgressValues,
    assignmentTotalSectionsForTrack,
  ]);

  const courseDatesValues = useMemo(() => {
    const mapForDates = mergeProgressMaps(apiProgress, readProgressMapFromSessionStorage() ?? undefined) as ApiProgressMap;
    return courses.map((courseRef, i) => {
      const courseAirtableId = getLinkedRecordId(courseRef as { id?: string } | string);
      const courseData = resolveCourseRow(allCoursesList, courseRef, courseAirtableId, i, courses.length);
      const fields = courseData?.fields as Record<string, unknown> | undefined;
      const recordIdVal = fields && (fields.recordId ?? fields.RecordID);
      const idForNav = courseData?.id ?? (recordIdVal != null ? String(recordIdVal) : null) ?? courseAirtableId;
      const collected = collectCourseIdsForProgress(courseRef, courseData);
      const possibleIds = [courseAirtableId ?? undefined, idForNav ?? undefined, ...collected].filter((x): x is string => Boolean(x && typeof x === "string"));
      const tryKey = (courseAirtableId ?? idForNav) as string | undefined;
      return getProgressEntryFromApi(mapForDates, tryKey, ...possibleIds);
    });
  }, [courses, allCoursesList, apiProgress]);

  if (!mounted) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12" style={{ minHeight: 200 }}>
        <p className="text-muted-foreground mb-4">Loading track...</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  if (!selectedTrackId) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center" style={{ minHeight: 200 }}>
        <p className="text-muted-foreground mb-6">No track selected. Add ?recordId=... to the URL or go back to choose a track.</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tracks
        </Button>
      </div>
    );
  }

  const isLoading = trackDetailStatus === "pending" && !hasValidTrack;
  if (isLoading) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12" style={{ minHeight: 400 }}>
        <div className="w-full max-w-[1600px] mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-32" />
            <div className="h-12 bg-muted rounded w-2/3" />
            <div className="aspect-video bg-muted rounded-lg" />
            <div className="h-24 bg-muted rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <div className="aspect-video bg-muted" />
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (trackDetailStatus === "error" || !hasValidTrack) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center" style={{ minHeight: 200 }}>
        <p className="text-destructive mb-6">Could not load this track.</p>
        <p className="text-muted-foreground text-sm mb-4">Try opening it from Assigned Tracks on My Learning Tracks, or check that the link is correct.</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tracks
        </Button>
      </div>
    );
  }

  const imageArr = trackFields?.image ?? trackFields?.Image;
  const imageUrl =
    Array.isArray(imageArr) && imageArr.length > 0 && imageArr[0] && typeof imageArr[0] === "object" && "url" in imageArr[0]
      ? (imageArr[0] as { url: string }).url
      : null;

  const overallProgress = personId && trackRollup.totalSections > 0
    ? Math.round((trackRollup.totalViewed / trackRollup.totalSections) * 100)
    : 0;

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 py-8 md:py-12" style={{ minHeight: 400 }}>
      <div className="w-full max-w-[1600px] mx-auto">
        <Button variant="ghost" onClick={goBack} className="mb-6 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {personId ? "Back to My Learning Tracks" : "Back to Tracks"}
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {stripYearSuffix(
              String(
                trackFields?.title ??
                  trackFields?.["Learning Track Title"] ??
                  trackFields?.Name ??
                  trackFields?.name ??
                  trackFields?.["Track Title"] ??
                  trackFields?.label ??
                  trackFields?.Label ??
                  "Learning Track"
              )
            )}
          </h1>

          {imageUrl && (
            <div className="aspect-video overflow-hidden rounded-lg mb-6">
              <img
                src={imageUrl}
                alt={String(
                  trackFields?.title ??
                    trackFields?.["Learning Track Title"] ??
                    trackFields?.Name ??
                    trackFields?.name ??
                    "Learning Track"
                )}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {trackFields?.description != null && String(trackFields.description).trim() !== "" && (
            <div className="prose prose-lg max-w-none mb-6 text-muted-foreground">{String(trackFields.description)}</div>
          )}

          {trackFields?.estimatedDuration != null && (
            <div className="flex items-center gap-2 text-muted-foreground mb-6">
              <Clock className="h-5 w-5" />
              <span className="text-lg">{formatDuration(trackFields.estimatedDuration as number)}</span>
            </div>
          )}

          <Card className="bg-accent/50">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg">Overall Progress</CardTitle>
                <span
                  className={cn(
                    "text-2xl font-bold",
                    overallProgress <= 0 ? "text-[#E61C39]" : "text-[#228B22]"
                  )}
                >
                  {overallProgress}%
                </span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </CardHeader>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Sections ({courses.length})</h2>

          {coursesStatus === "pending" ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse p-6">
                  <div className="h-8 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-20 bg-muted rounded mb-4" />
                  <div className="h-10 bg-muted rounded w-32" />
                </Card>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No courses available in this track yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {courses.map((courseRef, index) => {
                const courseAirtableId = getLinkedRecordId(courseRef as { id?: string; recordId?: string; label?: string } | string);
                const courseData = resolveCourseRow(allCoursesList, courseRef, courseAirtableId, index, courses.length);
                const courseProgress = courseProgressValues[index] ?? 0;
                const courseLabel =
                  typeof courseRef === "object" && courseRef && "label" in courseRef ? (courseRef as { label?: string }).label : undefined;
                const fields = courseData?.fields as Record<string, unknown> | undefined;
                const rowTop = courseData as Record<string, unknown> | undefined;
                const courseTitle = stripYearSuffix(extractCourseTitle(courseData, courseRef, courseLabel));
                const recordIdVal = fields && (fields.recordId ?? fields.RecordID);
                const idForNav: string | null =
                  (typeof courseData?.id === "string" ? courseData.id : null) ??
                  (recordIdVal != null ? String(recordIdVal) : null) ??
                  courseAirtableId;
                const estRaw =
                  fields?.estimatedDuration ??
                  fields?.["Estimated Duration"] ??
                  fields?.["Estimated duration"] ??
                  rowTop?.estimatedDuration;
                const estMinutes =
                  typeof estRaw === "number" && Number.isFinite(estRaw)
                    ? estRaw
                    : typeof estRaw === "string"
                      ? (() => {
                          const n = parseInt(estRaw, 10);
                          return Number.isNaN(n) ? undefined : n;
                        })()
                      : undefined;
                const dates = courseDatesValues[index];
                const startedAt = dates?.startedAt;
                const completedAt = dates?.completedAt;
                const showStarted = courseProgress > 0 && courseProgress < 100 && startedAt;
                const showCompleted = courseProgress === 100 && completedAt;

                return (
                  <Card key={courseAirtableId ?? index} className="group hover:shadow-lg transition-shadow duration-300">
                    <div className="flex flex-col p-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-3">
                          {String(courseTitle)}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {formatDuration(estMinutes)}
                          </span>
                        </div>
                        {courseProgress > 0 && (showStarted || showCompleted) && (
                          <p className="text-sm text-muted-foreground mb-4">
                            {showCompleted ? <>Completed {formatDateMMDDYYYY(completedAt)}</> : showStarted ? <>Started {formatDateMMDDYYYY(startedAt)}</> : null}
                          </p>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Progress</span>
                          <span
                            className={cn(
                              "text-sm font-bold",
                              courseProgress <= 0 ? "text-[#E61C39]" : "text-[#228B22]"
                            )}
                          >
                            {courseProgress}%
                          </span>
                        </div>
                        <Progress value={courseProgress} className="h-2 w-full" />
                        <Button
                          className={cn(
                            "w-full mt-4 transition-colors !text-white",
                            courseProgress === 100
                              ? "hover:!bg-[#1a6b1a] hover:!border-[#1a6b1a]"
                              : "hover:!bg-[#c41832] hover:!border-[#c41832]"
                          )}
                          style={
                            courseProgress === 100
                              ? { borderColor: "#228B22", color: "#fff", backgroundColor: "#228B22" }
                              : { borderColor: "#E61C39", color: "#fff", backgroundColor: "#E61C39" }
                          }
                          variant="outline"
                          onClick={() => {
                            if (idForNav) goToCourse(idForNav);
                          }}
                          disabled={!idForNav}
                        >
                          {courseProgress === 0 ? "Start Section" : courseProgress === 100 ? "Review Section" : "Continue Section"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Block() {
  return (
    <TrackDetailErrorBoundary>
      <BlockInner />
    </TrackDetailErrorBoundary>
  );
}
