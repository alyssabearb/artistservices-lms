"use client";

/**
 * Assigned tracks grid (standalone: assignments + track course ids from parent).
 */
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ArrowRight, ArrowLeft, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { progressApiUrl } from "@/lib/progress";
import { persistTrackRecordId } from "@/lib/lms-track-nav";
import { assignmentDisplayTotalSections } from "@/lib/lms-assignment-section-total";
import { getLearningTrackImageUrlFromFields } from "@/lib/lms-fields";

const PAGE_SLUGS = {
  myLearning: "/my-learning",
  trackView: "/track-view",
};

const EMPTY_TRACK_IMAGE_MAP = new Map<string, string | null>();

type ProgressEntry = number | { lastViewedIndex?: number; completedAt?: string } | null | undefined;

/** Ensure we have a plain object with course-id keys (handle string response, wrapped { data }, or error). */
function normalizeProgressResponse(data: unknown): Record<string, ProgressEntry> {
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

function getLastViewedIndexFromEntry(raw: ProgressEntry): number {
  if (raw == null) return -1;
  return typeof raw === "number" ? raw : (typeof (raw as { lastViewedIndex?: number }).lastViewedIndex === "number" ? (raw as { lastViewedIndex: number }).lastViewedIndex : -1);
}

function hasCompletedAt(raw: ProgressEntry): boolean {
  if (raw == null || typeof raw === "number") return false;
  const completedAt = (raw as { completedAt?: string }).completedAt;
  return typeof completedAt === "string" && completedAt.length > 0;
}

/** Count how many of the track’s courses have completedAt in the API (for "X of N sections completed"). */
function getTrackSectionsCompletedFromApi(
  courseIds: string[],
  apiProgress: Record<string, ProgressEntry> | null
): number {
  if (!apiProgress) return 0;
  let count = 0;
  for (const courseId of courseIds) {
    if (hasCompletedAt(apiProgress[courseId])) count += 1;
  }
  if (count === 0 && courseIds.length > 0 && courseIds.length === Object.keys(apiProgress).length) {
    const apiKeys = Object.keys(apiProgress);
    for (let i = 0; i < courseIds.length && i < apiKeys.length; i++) {
      if (hasCompletedAt(apiProgress[apiKeys[i]])) count += 1;
    }
  }
  return count;
}

/** Count how many courses have any progress (lastViewedIndex >= 0), by id or by index. When courseIds is empty, use api keys with progress (capped by totalSections if provided). */
function getTrackSectionsWithProgressFromApi(
  courseIds: string[],
  apiProgress: Record<string, ProgressEntry> | null,
  totalSections?: number
): number {
  if (!apiProgress) return 0;
  const allKeys = Object.keys(apiProgress);
  const keysWithProgress = allKeys.filter((k) => getLastViewedIndexFromEntry(apiProgress[k]) >= 0);
  if (courseIds.length === 0) {
    if (totalSections != null && totalSections > 0) return Math.min(keysWithProgress.length, totalSections);
    return keysWithProgress.length;
  }
  let count = 0;
  for (let i = 0; i < courseIds.length; i++) {
    const byId = getLastViewedIndexFromEntry(apiProgress[courseIds[i]]) >= 0;
    const byIndex = i < allKeys.length && getLastViewedIndexFromEntry(apiProgress[allKeys[i]]) >= 0;
    if (byId || byIndex) count += 1;
  }
  return count;
}

function getTrackProgressFromApi(courseIds: string[], totalSections: number, apiProgress: Record<string, ProgressEntry> | null): number {
  if (!apiProgress) return 0;
  const apiKeys = Object.keys(apiProgress);
  const sectionsCompleted = getTrackSectionsCompletedFromApi(courseIds, apiProgress);
  if (totalSections > 0 && sectionsCompleted >= 0) {
    return Math.min(100, Math.round((sectionsCompleted / totalSections) * 100));
  }
  let viewedCount = 0;
  if (courseIds.length > 0) {
    for (const courseId of courseIds) {
      const idx = getLastViewedIndexFromEntry(apiProgress[courseId]);
      if (idx >= 0) viewedCount += idx + 1;
    }
  }
  if (viewedCount === 0 && courseIds.length > 0 && apiKeys.length > 0) {
    for (let i = 0; i < Math.min(courseIds.length, apiKeys.length); i++) {
      const idx = getLastViewedIndexFromEntry(apiProgress[apiKeys[i]]);
      if (idx >= 0) viewedCount += idx + 1;
    }
  }
  if (viewedCount === 0 && apiKeys.length >= 1 && totalSections > 0) {
    for (const key of apiKeys) {
      const idx = getLastViewedIndexFromEntry(apiProgress[key]);
      if (idx >= 0) viewedCount += idx + 1;
    }
  }
  const denom = totalSections > 0 ? totalSections : (viewedCount || 1);
  return Math.min(100, Math.round((viewedCount / denom) * 100));
}

/** Due / completion on cards: M/D/YY, no leading zeros (e.g. 4/20/26). */
function formatCardDateMDY(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yy = d.getFullYear() % 100;
  const yyStr = yy < 10 ? `0${yy}` : String(yy);
  return `${m}/${day}/${yyStr}`;
}

function getLinkedRecordId(linked: { id?: string; recordId?: string; label?: string } | string | null | undefined): string | null {
  if (linked == null) return null;
  if (typeof linked === "string") return linked;
  const id = linked.id ?? linked.recordId;
  if (id != null && typeof id === "string") return id;
  if (Array.isArray(linked)) {
    const first = linked[0];
    return first != null ? getLinkedRecordId(first as { id?: string }) : null;
  }
  return null;
}

/** Assignment row may link the assignee via Personnel (legacy) or Contact(s). */
function getAssigneeLinkedIds(f: Record<string, unknown> | undefined): string[] {
  if (!f) return [];
  const refs = [
    f.personnel,
    f.Personnel,
    f.contact,
    f.Contact,
    f.contacts,
    f.Contacts,
  ];
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

function getLearningTrackTitleFromFields(f: Record<string, unknown> | undefined, trackObj: Record<string, unknown> | null, trackFields: Record<string, unknown>): string | null {
  const fromAssignment = f?.learningTrackTitle ?? f?.["Learning Track Title"];
  const fromTrack = trackObj?.["Learning Track Title"] ?? trackFields?.["Learning Track Title"];
  const raw = fromAssignment ?? fromTrack;
  if (raw == null) return null;
  const val = Array.isArray(raw) ? raw[0] : raw;
  const s = typeof val === "string" ? val.trim() : val != null ? String(val).trim() : "";
  return s || null;
}

export type MyAssignedTracksGridProps = {
  personId: string;
  rawAssignments: { id?: string; fields?: Record<string, unknown> }[];
  assignmentsStatus: "pending" | "success" | "error";
  trackCourseIdsById: Map<string, string[]>;
  /** From `/api/tracks/:id` — assignments usually only include link ids, not track fields like Track Image. */
  trackImageUrlById?: Map<string, string | null>;
};

export function MyAssignedTracksGrid({
  personId,
  rawAssignments,
  assignmentsStatus: status,
  trackCourseIdsById,
  trackImageUrlById = EMPTY_TRACK_IMAGE_MAP,
}: MyAssignedTracksGridProps) {
  const [apiProgress, setApiProgress] = useState<Record<string, ProgressEntry> | null>(null);

  useEffect(() => {
    const base = progressApiUrl();
    if (!base || !personId) {
      setApiProgress(null);
      return;
    }
    const url = base + (base.includes("?") ? "&" : "?") + "personId=" + encodeURIComponent(personId);
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Progress fetch failed"))))
      .then((data) => setApiProgress(normalizeProgressResponse(data)))
      .catch(() => setApiProgress({}));
  }, [personId]);

  const assignmentRecords = useMemo(() => {
    if (!personId) return [];
    return rawAssignments.filter((rec) => {
      const f = rec.fields as Record<string, unknown> | undefined;
      return getAssigneeLinkedIds(f).includes(personId);
    });
  }, [personId, rawAssignments]);

  type TrackInfo = {
    trackId: string;
    label: string;
    imageUrl: string | null;
    dueDate: string | null;
    completionDate: string | null;
    totalSections: number;
    assignments: { status: string | null; completionDate: string | null }[];
    completedCount: number;
    progressPercent: number;
    sectionsViewed: number;
    isComplete: boolean;
  };

  const tracksForPerson = useMemo((): TrackInfo[] => {
    if (!personId) return [];
    const byTrackId = new Map<
      string,
      Omit<TrackInfo, "completedCount" | "progressPercent" | "sectionsViewed" | "isComplete"> & {
        assignments: { status: string | null; completionDate: string | null }[];
        totalSections: number;
        courseIds: string[];
        imageUrl: string | null;
      }
    >();
    for (const rec of assignmentRecords) {
      const f = rec.fields as Record<string, unknown> | undefined;
      const trackRef = f?.track ?? f?.Track;
      const trackId = trackRef != null ? getLinkedRecordId(trackRef as { id?: string }) : null;
      if (!trackId) continue;
      const rawTrack = Array.isArray(trackRef) ? trackRef[0] : trackRef;
      const trackObj = typeof rawTrack === "object" && rawTrack !== null ? (rawTrack as Record<string, unknown>) : null;
      const trackFields = (trackObj?.fields as Record<string, unknown>) ?? {};
      const label = getLearningTrackTitleFromFields(f, trackObj, trackFields) ?? "Untitled Track";
      const dueDate = f?.dueDate ?? f?.["Due Date"];
      const completionDate = f?.["Completion Date"] ?? f?.completionDate ?? f?.["Completed At"] ?? f?.completedAt;
      const status = f?.status ?? f?.["Status"];
      const st = status != null ? String(status) : null;
      const cd = completionDate != null ? String(completionDate) : null;
      const coursesFromTrack = trackObj?.courses ?? trackFields?.courses ?? trackObj?.Courses ?? trackFields?.Courses;
      const courseIdsFromExpansion = Array.isArray(coursesFromTrack)
        ? coursesFromTrack.map((c: unknown) => getLinkedRecordId(c as { id?: string })).filter((id): id is string => Boolean(id))
        : [];
      const assignmentCourseId = getLinkedRecordId((f?.course ?? f?.Course) as { id?: string } | string);
      const fromTrack = trackCourseIdsById.get(trackId) ?? courseIdsFromExpansion;
      const merged = fromTrack.length > 0 ? fromTrack : courseIdsFromExpansion;
      const thisAssignmentCourseIds = merged.length > 0 ? merged : (assignmentCourseId ? [assignmentCourseId] : []);
      const withAssignment = assignmentCourseId && !thisAssignmentCourseIds.includes(assignmentCourseId)
        ? [...thisAssignmentCourseIds, assignmentCourseId]
        : thisAssignmentCourseIds;
      const courseIds = [...new Set(withAssignment)];
      const totalSectionsForTrack = assignmentDisplayTotalSections(rec, courseIds.length);
      const imageUrl =
        trackImageUrlById.get(trackId) ?? getLearningTrackImageUrlFromFields(trackFields);
      const existing = byTrackId.get(trackId);
      if (existing) {
        existing.assignments.push({ status: st, completionDate: cd });
        if (totalSectionsForTrack > 0) existing.totalSections = Math.max(existing.totalSections || 0, totalSectionsForTrack);
        existing.courseIds = [...new Set([...(existing.courseIds || []), ...courseIds])];
        if (imageUrl && !existing.imageUrl) existing.imageUrl = imageUrl;
      } else {
        byTrackId.set(trackId, {
          trackId,
          label: typeof label === "string" && label ? label : "Untitled Track",
          imageUrl: imageUrl ?? null,
          dueDate: dueDate != null ? String(dueDate) : null,
          completionDate: cd,
          totalSections: totalSectionsForTrack,
          assignments: [{ status: st, completionDate: cd }],
          courseIds,
        });
      }
    }
    return Array.from(byTrackId.values()).map((t) => {
      const total = t.assignments.length;
      const sectionCount = t.totalSections > 0 ? t.totalSections : total;
      const completedCount = t.assignments.filter((a) => /completed/i.test(a.status ?? "")).length;
      const sectionsCompletedFromApi = getTrackSectionsCompletedFromApi(t.courseIds, apiProgress);
      const sectionsViewed = Math.min(sectionsCompletedFromApi, t.totalSections || 999);
      const fromApi = getTrackProgressFromApi(t.courseIds, t.totalSections, apiProgress);
      const progressPercent = fromApi > 0
        ? fromApi
        : sectionCount > 0 ? Math.round((completedCount / sectionCount) * 100) : (total > 0 ? Math.round((completedCount / total) * 100) : 0);
      const isComplete = total > 0 && completedCount === total;
      const displayCompletionDate = isComplete && t.assignments.some((a) => a.completionDate)
        ? t.assignments.find((a) => a.completionDate)?.completionDate ?? t.dueDate
        : null;
      return {
        ...t,
        totalSections: t.totalSections ?? 0,
        completedCount,
        progressPercent,
        sectionsViewed,
        isComplete,
        completionDate: displayCompletionDate,
      };
    });
  }, [personId, assignmentRecords, trackCourseIdsById, trackImageUrlById, apiProgress]);

  const goBack = () => {
    if (typeof window !== "undefined") window.location.href = PAGE_SLUGS.myLearning;
  };

  const goToTrack = (trackId: string) => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("lms_track_personId", personId ?? "");
      persistTrackRecordId(trackId);
      if (apiProgress && typeof apiProgress === "object" && Object.keys(apiProgress).length > 0) {
        sessionStorage.setItem("lms_progress_data", JSON.stringify(apiProgress));
      }
    } catch (_) {}
    const params = new URLSearchParams({
      recordId: trackId,
      personId: personId ?? "",
    });
    window.location.href = `${PAGE_SLUGS.trackView}?${params.toString()}`;
  };

  if (!personId) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center">
        <p className="text-muted-foreground mb-6">No profile selected. Please start from the entry page.</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Enter your email
        </Button>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12">
        <div className="w-full max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
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
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <div className="w-full max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Assigned Tracks</h2>
          <p className="text-muted-foreground">Start, continue, or review your assignments below.</p>
        </div>

        {tracksForPerson.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card/50">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">You have no assignments yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Reach out to your National Artist Services Team with any questions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tracksForPerson.map((t) => {
              const actionLabel = t.isComplete ? "Review" : t.progressPercent > 0 ? "Continue" : "Start";
              return (
                <Card key={t.trackId} className="group hover:shadow-lg transition-shadow duration-300 flex flex-col">
                  <div className="aspect-video bg-muted/50 rounded-t-lg overflow-hidden flex items-center justify-center relative">
                    {t.imageUrl ? (
                      <img src={t.imageUrl} alt={t.label} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="h-16 w-16 text-muted-foreground relative z-10" />
                    )}
                  </div>
                  <CardHeader className="flex-1">
                    <CardTitle className="text-xl leading-tight">{t.label}</CardTitle>
                    {t.isComplete && t.completionDate ? (
                      <CardDescription className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Completion Date: {formatCardDateMDY(t.completionDate)}
                      </CardDescription>
                    ) : t.dueDate ? (
                      <CardDescription className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        Due: {formatCardDateMDY(t.dueDate)}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div>
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>
                          {t.sectionsViewed} of {t.totalSections > 0 ? t.totalSections : t.assignments.length} section
                          {(t.totalSections > 0 ? t.totalSections : t.assignments.length) !== 1 ? "s" : ""} complete
                        </span>
                      </div>
                      <Progress value={t.progressPercent} className="h-2" />
                    </div>
                    <Button
                      variant={t.isComplete ? "secondary" : "default"}
                      size="sm"
                      className={cn("w-full", !t.isComplete && "group-hover:bg-primary group-hover:text-primary-foreground transition-colors")}
                      onClick={() => goToTrack(t.trackId)}
                    >
                      {actionLabel}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
