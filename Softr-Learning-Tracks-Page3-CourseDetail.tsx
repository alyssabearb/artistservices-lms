/**
 * Page 3: Course Detail.
 * Paste this into the Custom Code block on your Course Detail page.
 * Block data source: Courses table.
 * URL: ?recordId={courseId}&trackId={trackId}&personId={personId}.
 * Progress: set PROGRESS_API_URL to your GET progress API (returns { [courseId]: lastViewedIndex } or { [courseId]: { lastViewedIndex } }).
 */
import React, { useMemo, useEffect, useState } from "react";
import { useRecord, q } from "@/lib/datasource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowLeft, Clock, ArrowRight, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
const PAGE_SLUGS = {
  trackDetail: "/track-detail",
  sectionDetail: "/section-detail",
};

const coursesSelect = q.select({
  title: "Course Title",
  image: "Course Image",
  description: "Description",
  estimatedDuration: "Estimated Duration",
  recordId: "RecordID",
  trainingSections: "Training Sections",
  courseMaterials: "Course Materials",
});

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return "Duration not set";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`;
}

function getLinkedRecordId(
  linked: { id?: string; recordId?: string; label?: string; [k: string]: unknown } | string | null | undefined
): string | null {
  if (linked == null) return null;
  if (typeof linked === "string") return linked;
  const id = linked.id ?? linked.recordId ?? (linked as Record<string, unknown>).RecordID;
  if (id != null && typeof id === "string") return id;
  for (const v of Object.values(linked)) {
    if (typeof v === "string" && /^rec[A-Za-z0-9]{14}$/.test(v)) return v;
  }
  return null;
}

function stripYearSuffix(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return s ?? "";
  return s.replace(/\s*-\s*20\d{2}\s*$/, "").trim() || s;
}

function getParamsFromUrl(): { recordId: string | null; trackId: string | null; personId: string | null } {
  if (typeof window === "undefined") return { recordId: null, trackId: null, personId: null };
  const params = new URLSearchParams(window.location.search);
  return { recordId: params.get("recordId"), trackId: params.get("trackId"), personId: params.get("personId") };
}

const PROGRESS_API_URL = "https://softr-learning-tracks-webhook-proxy.netlify.app/api/progress";

function getLastViewedIndexFromApi(courseId: string, sectionIds: string[], apiProgress: Record<string, number | { lastViewedIndex: number }> | null): number {
  if (!apiProgress || !(courseId in apiProgress)) return -1;
  const raw = apiProgress[courseId];
  const idx = typeof raw === "number" ? raw : (typeof raw === "object" && raw && "lastViewedIndex" in raw ? (raw as { lastViewedIndex: number }).lastViewedIndex : -1);
  return Math.min(Math.max(-1, idx), sectionIds.length - 1);
}

function getCourseProgressPercentFromApi(courseId: string, sectionIds: string[], apiProgress: Record<string, number | { lastViewedIndex: number }> | null): number {
  const total = sectionIds.length;
  if (total <= 0) return 0;
  const lastIdx = getLastViewedIndexFromApi(courseId, sectionIds, apiProgress);
  if (lastIdx < 0) return 0;
  return Math.round(((lastIdx + 1) / total) * 100);
}

export default function Block() {
  const { recordId: courseIdFromUrl, trackId: trackIdFromUrl, personId } = useMemo(getParamsFromUrl, []);
  const [apiProgress, setApiProgress] = useState<Record<string, number | { lastViewedIndex: number }> | null>(null);

  useEffect(() => {
    if (!PROGRESS_API_URL || !personId) {
      setApiProgress(null);
      return;
    }
    const url = PROGRESS_API_URL + (PROGRESS_API_URL.includes("?") ? "&" : "?") + "personId=" + encodeURIComponent(personId);
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Progress fetch failed")))
      .then((data) => setApiProgress(typeof data === "object" && data !== null ? (data as Record<string, number | { lastViewedIndex: number }>) : {}))
      .catch(() => setApiProgress({}));
  }, [personId]);

  const { data: selectedCourse, status: courseStatus } = useRecord({
    recordId: courseIdFromUrl ?? undefined,
    select: coursesSelect,
  });

  const rawSections = Array.isArray(selectedCourse?.fields?.trainingSections)
    ? selectedCourse.fields.trainingSections
    : Array.isArray((selectedCourse?.fields as Record<string, unknown>)?.["Training Sections"])
      ? (selectedCourse?.fields as Record<string, unknown>)["Training Sections"]
      : [];
  const rawCourseMaterials = Array.isArray((selectedCourse?.fields as Record<string, unknown>)?.courseMaterials)
    ? (selectedCourse?.fields as Record<string, unknown>).courseMaterials as unknown[]
    : Array.isArray((selectedCourse?.fields as Record<string, unknown>)?.["Course Materials"])
      ? (selectedCourse?.fields as Record<string, unknown>)["Course Materials"] as unknown[]
      : [];
  const getFirstUrl = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v) && v[0] && typeof v[0] === "object" && (v[0] as { url?: string }).url) return (v[0] as { url: string }).url;
    if (typeof v === "object" && (v as { url?: string }).url) return (v as { url: string }).url;
    return null;
  };
  const courseMaterialItems = rawCourseMaterials.map((item: unknown) => {
    if (item == null) return null;
    const o = typeof item === "object" ? (item as Record<string, unknown>) : null;
    const fields = (o && (o.fields as Record<string, unknown>)) ?? o ?? {};
    const all = { ...o, ...fields } as Record<string, unknown>;
    const title = stripYearSuffix(String(all.title ?? all["Resource Title"] ?? all.name ?? all.label ?? "").trim() || "Resource");
    const link = typeof all.link === "string" ? all.link : typeof all["Resource Link"] === "string" ? all["Resource Link"] : (all.url != null ? String(all.url) : null);
    const id = all.id ?? all.recordId ?? (all as { RecordID?: string }).RecordID;
    const typeRaw = String(all.type ?? all["Resource Type"] ?? "").trim().toLowerCase();
    const photoUrl = getFirstUrl(all.photo ?? all["Resource Photo"] ?? all["Photo"] ?? all["Image"]) ?? null;
    const docUrl = getFirstUrl(all.documentation ?? all["Resource Documentation"]) ?? null;
    const description = all.description ?? all["Resource Description"] ?? all["Description"];
    const descStr = description != null ? String(description).trim() : null;
    return { id: id != null ? String(id) : null, title, link, photoUrl, docUrl, typeRaw, description: descStr || null };
  }).filter(Boolean) as { id: string | null; title: string; link: string | null; photoUrl: string | null; docUrl: string | null; typeRaw: string; description: string | null }[];

  const sectionIdsInOrder = rawSections
    .map((s: unknown) => (typeof s === "string" ? s : getLinkedRecordId(s as { id?: string; recordId?: string })))
    .filter((id): id is string => Boolean(id));

  const getSectionTitleFrom = (fields: Record<string, unknown>, o: Record<string, unknown> | null) => {
    const all = { ...fields, ...(o || {}) };
    const exact = all["Section Title"];
    if (exact != null && String(exact).trim()) return String(exact).trim();
    for (const k of Object.keys(all)) {
      const lower = k.toLowerCase();
      if (lower.includes("section") && lower.includes("title")) {
        const v = all[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
    if (all["Title"] != null && String(all["Title"]).trim()) return String(all["Title"]).trim();
    if (all.label != null && String(all.label).trim()) return String(all.label).trim();
    if (all.name != null && String(all.name).trim()) return String(all.name).trim();
    if (all.title != null && String(all.title).trim()) return String(all.title).trim();
    for (const k of Object.keys(all)) {
      if (k.toLowerCase().endsWith("title")) {
        const v = all[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
    return null;
  };
  function getResourceIdsFromSection(s: unknown): string[] {
    if (s == null) return [];
    const o = typeof s === "object" ? (s as Record<string, unknown>) : null;
    if (!o) return [];
    const arr = Array.isArray(o.linkedResources) ? o.linkedResources : Array.isArray(o["Linked Resources"]) ? o["Linked Resources"] : [];
    return arr
      .map((r: unknown) => (r == null ? null : typeof r === "string" ? r : (r as { id?: string; recordId?: string; RecordID?: string }).id ?? (r as { recordId?: string }).recordId ?? (r as { RecordID?: string }).RecordID))
      .filter((id): id is string => Boolean(id));
  }

  const sectionList = rawSections.map((s: unknown, idx: number) => {
    const id = typeof s === "string" ? s : getLinkedRecordId(s as { id?: string; recordId?: string; label?: string });
    const o = typeof s === "object" && s != null ? (s as Record<string, unknown>) : null;
    const fields = (o && (o.fields as Record<string, unknown>)) ?? o ?? {};
    const sectionTitle = getSectionTitleFrom(fields, o) ?? `Page ${idx + 1}`;
    const resourceIds = getResourceIdsFromSection(s);
    return { id: id ?? `sec-${idx}`, title: stripYearSuffix(String(sectionTitle)), resourceIds };
  });

  const courseMaterialIds = courseMaterialItems.map((m) => m.id).filter(Boolean) as string[];
  useEffect(() => {
    if (typeof window === "undefined" || courseMaterialIds.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get("resourceIds");
    const next = courseMaterialIds.join(",");
    if (current === next) return;
    params.set("resourceIds", next);
    window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
    window.location.reload();
  }, [courseMaterialIds.join(",")]);

  const goBack = () => {
    let url = trackIdFromUrl
      ? `${PAGE_SLUGS.trackDetail}?recordId=${encodeURIComponent(trackIdFromUrl)}`
      : PAGE_SLUGS.trackDetail;
    if (personId) url += (url.includes("?") ? "&" : "?") + `personId=${encodeURIComponent(personId)}`;
    if (typeof window !== "undefined") window.location.href = url;
  };

  const courseProgress = personId && courseIdFromUrl
    ? getCourseProgressPercentFromApi(courseIdFromUrl, sectionIdsInOrder, apiProgress)
    : 0;
  const progressSectionIndex = personId && courseIdFromUrl
    ? getLastViewedIndexFromApi(courseIdFromUrl, sectionIdsInOrder, apiProgress)
    : -1;
  const isFullyComplete = sectionList.length > 0 && progressSectionIndex >= sectionList.length - 1;
  const progressSection = sectionList.length > 0
    ? sectionList[isFullyComplete ? 0 : Math.min(progressSectionIndex >= 0 ? progressSectionIndex : 0, sectionList.length - 1)]
    : null;
  const sectionIdsParam = sectionIdsInOrder.length > 0 ? `&sectionIds=${encodeURIComponent(sectionIdsInOrder.join(","))}` : "";
  const personIdParam = personId ? `&personId=${encodeURIComponent(personId)}` : "";

  if (!courseIdFromUrl) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12">
        <div className="text-center">
          <p className="text-muted-foreground mb-6">No course selected. Add ?recordId=... to the URL or go back to the track.</p>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Track
          </Button>
        </div>
      </div>
    );
  }

  if (courseStatus === "pending") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
          <p className="text-xl font-semibold text-foreground">Loading Course...</p>
        </div>
      </div>
    );
  }

  if (courseStatus === "error" || !selectedCourse) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center">
        <p className="text-destructive mb-6">Could not load this course. Make sure this block is connected to the Courses table.</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Track
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 py-8 md:py-12">
      <div className="w-full max-w-[1600px] mx-auto">
        <Button variant="ghost" onClick={goBack} className="mb-6 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {personId ? "Back to My Track" : "Back to Track"}
        </Button>

        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-4">{stripYearSuffix(String(selectedCourse.fields?.title ?? selectedCourse.fields?.["Course Title"] ?? "Course"))}</h1>
          <div className="flex items-center gap-6 text-muted-foreground mb-4">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {formatDuration(selectedCourse.fields?.estimatedDuration as number | null | undefined)}
            </span>
            <span className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {sectionList.length} {sectionList.length === 1 ? "Page" : "Pages"}
            </span>
          </div>
          <Card className="bg-accent/50 mb-6">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg">Course Progress</CardTitle>
                <span className="text-2xl font-bold text-primary">{courseProgress}%</span>
              </div>
              <div className="w-full [&>div]:first:!bg-muted [&>div]:last:!bg-[#E61C39] [&>div>*]:!bg-[#E61C39]">
                <Progress value={courseProgress} className="h-3 w-full" />
              </div>
            </CardHeader>
          </Card>

          {sectionList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pages in this course yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-3">Table of Contents</h2>
              <div className="relative mb-0">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />
                <ul className="space-y-0">
                  {sectionList.map((section, idx) => {
                    const resourceIdsParam = section.resourceIds && section.resourceIds.length > 0 ? `&resourceIds=${encodeURIComponent(section.resourceIds.join(","))}` : "";
                    const sectionUrl = `${PAGE_SLUGS.sectionDetail}?recordId=${encodeURIComponent(section.id)}&courseId=${encodeURIComponent(courseIdFromUrl ?? "")}&trackId=${encodeURIComponent(trackIdFromUrl ?? "")}${sectionIdsParam}${resourceIdsParam}${personIdParam}`;
                    const isCurrent = !isFullyComplete && progressSectionIndex >= 0 && idx === progressSectionIndex;
                    const isViewed = progressSectionIndex >= 0 && idx < progressSectionIndex || (isFullyComplete && idx === sectionList.length - 1);
                    const circleStyle = isCurrent
                      ? { borderColor: "#000", backgroundColor: "#E61C39", color: "#fff" }
                      : isViewed
                        ? { borderColor: "#000", backgroundColor: "#228B22", color: "#000" }
                        : { borderColor: "#000", backgroundColor: "#fff", color: "#000" };
                    return (
                      <li key={section.id} className="relative flex items-center gap-4 py-2.5">
                        <div
                          className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium"
                          style={circleStyle}
                        >
                          {idx + 1}
                        </div>
                        <a
                          href={sectionUrl}
                          className="flex-1 min-w-0 font-medium text-foreground hover:text-primary hover:underline cursor-pointer"
                          onClick={(e) => { e.preventDefault(); if (typeof window !== "undefined") window.location.href = sectionUrl; }}
                        >
                          {section.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {progressSection && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={progressSectionIndex <= 0 && !isFullyComplete ? "default" : "outline"}
                    size="sm"
                    style={progressSectionIndex > 0 && !isFullyComplete ? { borderColor: "#E61C39", color: "#fff", backgroundColor: "#E61C39" } : undefined}
                    className={progressSectionIndex > 0 && !isFullyComplete ? "hover:!bg-[#c41832] hover:!text-white hover:!border-[#c41832]" : undefined}
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      const targetSection = isFullyComplete ? sectionList[0] : progressSection;
                      const resourceIdsParam = targetSection.resourceIds && targetSection.resourceIds.length > 0 ? `&resourceIds=${encodeURIComponent(targetSection.resourceIds.join(","))}` : "";
                      const url = `${PAGE_SLUGS.sectionDetail}?recordId=${encodeURIComponent(targetSection.id)}&courseId=${encodeURIComponent(courseIdFromUrl ?? "")}&trackId=${encodeURIComponent(trackIdFromUrl ?? "")}${sectionIdsParam}${resourceIdsParam}${personIdParam}`;
                      window.location.href = url;
                    }}
                  >
                    {progressSectionIndex < 0 ? "Start" : isFullyComplete ? "Review" : "Continue"}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                  {progressSectionIndex > 0 && !isFullyComplete && (
                    <span className="text-sm text-muted-foreground">
                      Continue from "{progressSection.title}"
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {courseMaterialIds.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border mb-2">
            <h2 className="text-xl font-semibold mb-2">Course Materials</h2>
          </div>
        )}
      </div>
    </div>
  );
}
