"use client";
/**
 * Course detail (standalone: /api/courses + progress API + optional inline section reader via ?section=).
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getEmailFromRecord } from "@/lib/contact-email";
import { shouldBypassComprehensionPersistence } from "@/lib/comprehension-demo";
import {
  readComprehensionProgress,
  writeComprehensionProgress,
  type ComprehensionViewSnapshot,
} from "@/lib/comprehension-storage";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  mergeProgressMaps,
  normalizeProgressResponse,
  progressApiUrl,
  readProgressMapFromSessionStorage,
  lastViewedIndexFromEntry,
  type ProgressEntry,
} from "@/lib/progress";
import { postSectionViewProgress } from "@/lib/section-view-webhook";
import {
  extractSectionTitleFromFields,
  getComprehensionQuestionMode,
  getLinkedLearningTrackIdsFromCourseFields,
  getLinkedRecordId,
  getLinkedResourceIdsFromSectionFields,
  isSurveySectionFields,
} from "@/lib/lms-fields";
import {
  buildTrackViewHref,
  persistTrackRecordId,
  resolveFinishTrackRecordId,
} from "@/lib/lms-track-nav";
import SectionContentBlock from "@/components/lms/SectionContentBlock";
import ResourceLibrarySection from "@/components/lms/ResourceLibrarySection";

const COMPLETE_API_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_COMPLETE_API_URL
    ? process.env.NEXT_PUBLIC_COMPLETE_API_URL
    : "https://softr-learning-tracks-webhook-proxy.netlify.app/api/complete";

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return "Duration not set";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`;
}

function stripYearSuffix(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return s ?? "";
  return s.replace(/\s*-\s*20\d{2}\s*$/, "").trim() || s;
}

function getLastViewedIndexFromApi(courseId: string, sectionIds: string[], apiProgress: Record<string, number | { lastViewedIndex: number }> | null): number {
  if (!apiProgress || !(courseId in apiProgress)) return -1;
  const raw = apiProgress[courseId];
  const idx = typeof raw === "number" ? raw : (typeof raw === "object" && raw && "lastViewedIndex" in raw ? (raw as { lastViewedIndex: number }).lastViewedIndex : -1);
  return Math.min(Math.max(-1, idx), sectionIds.length - 1);
}

type SectionRow = {
  id: string;
  title: string;
  resourceIds: string[];
  comprehensionMode: ReturnType<typeof getComprehensionQuestionMode>;
  surveyRequired: boolean;
};

export default function Block() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const courseIdFromUrl = sp.get("recordId");
  const trackIdFromUrl = sp.get("trackId");
  const personId = sp.get("personId");
  const sectionFromUrl = sp.get("section");

  useEffect(() => {
    if (trackIdFromUrl) persistTrackRecordId(trackIdFromUrl);
  }, [trackIdFromUrl]);

  const [apiProgress, setApiProgress] = useState<Record<string, number | { lastViewedIndex: number }> | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{ id?: string; fields?: Record<string, unknown> } | null>(null);
  const [courseStatus, setCourseStatus] = useState<"pending" | "success" | "error">("pending");
  const [sectionMetaById, setSectionMetaById] = useState<
    Record<
      string,
      {
        title: string;
        resourceIds: string[];
        comprehensionMode: ReturnType<typeof getComprehensionQuestionMode>;
        surveyRequired: boolean;
      }
    >
  >({});
  const [comprehensionPassBySection, setComprehensionPassBySection] = useState<Record<string, boolean>>({});
  const [comprehensionSnapshotBySection, setComprehensionSnapshotBySection] = useState<
    Record<string, ComprehensionViewSnapshot | null>
  >({});
  const [surveyPassBySection, setSurveyPassBySection] = useState<Record<string, boolean>>({});
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const readerAnchorRef = useRef<HTMLDivElement | null>(null);

  const demoComprehensionBypass = useMemo(() => shouldBypassComprehensionPersistence(viewerEmail), [viewerEmail]);

  useEffect(() => {
    if (!personId) {
      setViewerEmail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/contacts/${encodeURIComponent(personId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rec: { fields?: Record<string, unknown> }) => {
        if (cancelled || !rec?.fields) return;
        const em = getEmailFromRecord(rec as { fields: Record<string, unknown> });
        setViewerEmail(em || null);
      })
      .catch(() => {
        if (!cancelled) setViewerEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [personId]);
  const userChoseOutlineOnly = useRef(false);

  const fetchProgressForPerson = useCallback((person: string) => {
    const base = progressApiUrl();
    if (!base) return Promise.resolve();
    const url = base + (base.includes("?") ? "&" : "?") + "personId=" + encodeURIComponent(person);
    return fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Progress fetch failed"))))
      .then((data) => {
        const next = normalizeProgressResponse(data) as Record<string, ProgressEntry>;
        setApiProgress((prev) => {
          let merged = mergeProgressMaps(prev, next);
          try {
            const s = typeof window !== "undefined" ? window.sessionStorage.getItem("lms_progress_data") : null;
            if (s) {
              const parsed = JSON.parse(s) as Record<string, ProgressEntry>;
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                merged = mergeProgressMaps(merged, parsed);
              }
            }
          } catch {
            /* ignore */
          }
          return merged as Record<string, number | { lastViewedIndex: number }>;
        });
      })
      .catch(() => setApiProgress({}));
  }, []);

  useEffect(() => {
    if (!personId) {
      setApiProgress(null);
      return;
    }
    if (!progressApiUrl()) {
      setApiProgress(null);
      return;
    }
    void fetchProgressForPerson(personId);
  }, [personId, fetchProgressForPerson]);

  /** Remote progress can lag behind section-view webhooks; refetch after navigating pages. */
  useEffect(() => {
    if (!personId || !sectionFromUrl || !courseIdFromUrl || !progressApiUrl()) return;
    const t = window.setTimeout(() => {
      void fetchProgressForPerson(personId);
    }, 800);
    return () => window.clearTimeout(t);
  }, [personId, sectionFromUrl, courseIdFromUrl, fetchProgressForPerson]);

  useEffect(() => {
    if (!courseIdFromUrl) {
      setSelectedCourse(null);
      setCourseStatus("success");
      return;
    }
    setCourseStatus("pending");
    fetch(`/api/courses/${encodeURIComponent(courseIdFromUrl)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rec: { id: string; fields: Record<string, unknown> }) => {
        setSelectedCourse(rec);
        setCourseStatus("success");
      })
      .catch(() => {
        setSelectedCourse(null);
        setCourseStatus("error");
      });
  }, [courseIdFromUrl]);

  const linkedLearningTrackIds = useMemo(
    () => getLinkedLearningTrackIdsFromCourseFields(selectedCourse?.fields as Record<string, unknown> | undefined),
    [selectedCourse]
  );

  useEffect(() => {
    if (trackIdFromUrl) return;
    if (linkedLearningTrackIds.length === 1 && linkedLearningTrackIds[0]) {
      persistTrackRecordId(linkedLearningTrackIds[0]);
    }
  }, [trackIdFromUrl, linkedLearningTrackIds]);

  const rawSections: unknown[] = Array.isArray(selectedCourse?.fields?.trainingSections)
    ? (selectedCourse!.fields!.trainingSections as unknown[])
    : Array.isArray((selectedCourse?.fields as Record<string, unknown>)?.["Training Sections"])
      ? ((selectedCourse?.fields as Record<string, unknown>)["Training Sections"] as unknown[])
      : [];
  const rawCourseMaterials = Array.isArray((selectedCourse?.fields as Record<string, unknown>)?.courseMaterials)
    ? ((selectedCourse?.fields as Record<string, unknown>).courseMaterials as unknown[])
    : Array.isArray((selectedCourse?.fields as Record<string, unknown>)?.["Course Materials"])
      ? ((selectedCourse?.fields as Record<string, unknown>)["Course Materials"] as unknown[])
      : [];
  const getFirstUrl = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v) && v[0] && typeof v[0] === "object" && (v[0] as { url?: string }).url) return (v[0] as { url: string }).url;
    if (typeof v === "object" && (v as { url?: string }).url) return (v as { url: string }).url;
    return null;
  };
  const courseMaterialItems = rawCourseMaterials
    .map((item: unknown) => {
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
    })
    .filter(Boolean) as { id: string | null; title: string; link: string | null; photoUrl: string | null; docUrl: string | null; typeRaw: string; description: string | null }[];

  const sectionIdsInOrder = rawSections
    .map((s: unknown) => (typeof s === "string" ? s : getLinkedRecordId(s as { id?: string; recordId?: string })))
    .filter((id): id is string => Boolean(id));

  useEffect(() => {
    if (!courseIdFromUrl || sectionIdsInOrder.length === 0) {
      setSectionMetaById({});
      return;
    }
    let cancelled = false;
    fetch(`/api/sections/list?ids=${encodeURIComponent(sectionIdsInOrder.join(","))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { records?: { id: string; fields: Record<string, unknown> }[] }) => {
        if (cancelled) return;
        const map: Record<
          string,
          {
            title: string;
            resourceIds: string[];
            comprehensionMode: ReturnType<typeof getComprehensionQuestionMode>;
            surveyRequired: boolean;
          }
        > = {};
        for (const rec of data.records ?? []) {
          const t = extractSectionTitleFromFields(rec.fields);
          map[rec.id] = {
            title: stripYearSuffix(t ?? "Session"),
            resourceIds: getLinkedResourceIdsFromSectionFields(rec.fields),
            comprehensionMode: getComprehensionQuestionMode(rec.fields),
            surveyRequired: isSurveySectionFields(rec.fields),
          };
        }
        setSectionMetaById(map);
      })
      .catch(() => {
        if (!cancelled) setSectionMetaById({});
      });
    return () => {
      cancelled = true;
    };
  }, [courseIdFromUrl, sectionIdsInOrder.join(",")]);

  useEffect(() => {
    if (!personId || !courseIdFromUrl || sectionIdsInOrder.length === 0) {
      setComprehensionPassBySection({});
      setComprehensionSnapshotBySection({});
      return;
    }
    const nextPass: Record<string, boolean> = {};
    const nextSnap: Record<string, ComprehensionViewSnapshot | null> = {};
    for (const sid of sectionIdsInOrder) {
      const { passed, snapshot } = readComprehensionProgress(personId, courseIdFromUrl, sid, {
        bypassPersistence: demoComprehensionBypass,
      });
      if (passed) nextPass[sid] = true;
      if (snapshot) nextSnap[sid] = snapshot;
    }
    setComprehensionPassBySection(nextPass);
    setComprehensionSnapshotBySection(nextSnap);
  }, [personId, courseIdFromUrl, sectionIdsInOrder.join(","), demoComprehensionBypass]);

  const fetchSurveySubmitted = useCallback(
    async (sid: string): Promise<boolean> => {
      if (!personId) return false;
      const res = await fetch(
        `/api/surveys/status?personId=${encodeURIComponent(personId)}&sectionId=${encodeURIComponent(sid)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { submitted?: boolean };
      return Boolean(data.submitted);
    },
    [personId]
  );

  useEffect(() => {
    if (!personId || !courseIdFromUrl || sectionIdsInOrder.length === 0) {
      setSurveyPassBySection({});
      return;
    }
    const surveyIds = sectionIdsInOrder.filter((sid) => Boolean(sectionMetaById[sid]?.surveyRequired));
    if (surveyIds.length === 0) {
      setSurveyPassBySection({});
      return;
    }
    let cancelled = false;
    Promise.all(
      surveyIds.map(async (sid) => ({ sid, submitted: await fetchSurveySubmitted(sid).catch(() => false) }))
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, boolean> = {};
      for (const r of rows) {
        if (r.submitted) next[r.sid] = true;
      }
      setSurveyPassBySection(next);
    });
    return () => {
      cancelled = true;
    };
  }, [personId, courseIdFromUrl, sectionIdsInOrder.join(","), sectionMetaById, fetchSurveySubmitted]);

  useEffect(() => {
    const sid = sectionFromUrl && sectionIdsInOrder.includes(sectionFromUrl) ? sectionFromUrl : null;
    if (!sid || !sectionMetaById[sid]?.surveyRequired) return;
    if (surveyPassBySection[sid]) return;
    let cancelled = false;
    const run = async () => {
      const ok = await fetchSurveySubmitted(sid).catch(() => false);
      if (!cancelled && ok) {
        setSurveyPassBySection((p) => ({ ...p, [sid]: true }));
      }
    };
    void run();
    const t = window.setInterval(() => void run(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [sectionFromUrl, sectionIdsInOrder.join(","), sectionMetaById, surveyPassBySection, fetchSurveySubmitted]);

  useEffect(() => {
    userChoseOutlineOnly.current = false;
  }, [courseIdFromUrl]);

  function getResourceIdsFromSection(s: unknown): string[] {
    if (s == null) return [];
    const o = typeof s === "object" ? (s as Record<string, unknown>) : null;
    if (!o) return [];
    const fields = (o.fields as Record<string, unknown>) ?? o;
    return getLinkedResourceIdsFromSectionFields(fields);
  }

  const sectionList: SectionRow[] = rawSections.map((s: unknown, idx: number) => {
    const id = typeof s === "string" ? s : getLinkedRecordId(s as { id?: string; recordId?: string; label?: string });
    const o = typeof s === "object" && s != null ? (s as Record<string, unknown>) : null;
    const fields = (o && (o.fields as Record<string, unknown>)) ?? o ?? {};
    const sid = id ?? `sec-${idx}`;
    const meta = sectionMetaById[sid];
    const compMode = meta?.comprehensionMode ?? getComprehensionQuestionMode(fields as Record<string, unknown>);
    const surveyRequired = meta?.surveyRequired ?? isSurveySectionFields(fields as Record<string, unknown>);
    const fallbackTitle = extractSectionTitleFromFields(fields as Record<string, unknown>) ?? `Page ${idx + 1}`;
    return {
      id: sid,
      title: meta?.title ?? stripYearSuffix(String(fallbackTitle)),
      resourceIds: meta?.resourceIds?.length ? meta.resourceIds : getResourceIdsFromSection(s),
      comprehensionMode: compMode,
      surveyRequired,
    };
  });

  const tocSections = useMemo(() => sectionList.filter((s) => !s.comprehensionMode), [sectionList]);

  const courseMaterialIds = courseMaterialItems.map((m) => m.id).filter(Boolean) as string[];
  useEffect(() => {
    if (courseMaterialIds.length === 0) return;
    const next = courseMaterialIds.join(",");
    if (sp.get("resourceIds") === next) return;
    const p = new URLSearchParams(sp.toString());
    p.set("resourceIds", next);
    router.replace(`${pathname}?${p.toString()}`);
  }, [courseMaterialIds.join(","), pathname, router, sp]);

  const goBack = () => {
    if (typeof window === "undefined") return;
    const rid = resolveFinishTrackRecordId({ trackIdFromUrl, linkedLearningTrackIds });
    window.location.href = buildTrackViewHref(personId, rid);
  };

  const idSet = useMemo(() => new Set(sectionIdsInOrder), [sectionIdsInOrder.join(",")]);

  /** Open reader only when `section` is present (so “Back to outline” can hide it). */
  const activeReaderSectionId =
    sectionFromUrl && idSet.has(sectionFromUrl) ? sectionFromUrl : null;

  const apiProgressLastIdx =
    personId && courseIdFromUrl ? getLastViewedIndexFromApi(courseIdFromUrl, sectionIdsInOrder, apiProgress) : -1;
  const progressMapLocal = typeof window !== "undefined" ? readProgressMapFromSessionStorage() : null;
  const sessionLastIdx =
    courseIdFromUrl && progressMapLocal ? lastViewedIndexFromEntry(progressMapLocal[courseIdFromUrl]) : -1;
  const readerSlotIndex =
    activeReaderSectionId != null ? sectionIdsInOrder.indexOf(activeReaderSectionId) : -1;
  /** Furthest slot: API, monotonic session bumps (see useEffect below), and current page when in the reader. */
  const rawProgressSectionIndex = Math.max(
    apiProgressLastIdx,
    sessionLastIdx,
    readerSlotIndex >= 0 ? readerSlotIndex : -1
  );
  const firstBlockedGateIndex = useMemo(() => {
    if (rawProgressSectionIndex < 0 || sectionIdsInOrder.length === 0) return -1;
    const upper = Math.min(rawProgressSectionIndex, sectionIdsInOrder.length - 1);
    for (let i = 0; i <= upper; i++) {
      const sid = sectionIdsInOrder[i];
      const isCompBlocked = Boolean(sectionMetaById[sid]?.comprehensionMode && !comprehensionPassBySection[sid]);
      const isSurveyBlocked = Boolean(sectionMetaById[sid]?.surveyRequired && !surveyPassBySection[sid]);
      if (isCompBlocked || isSurveyBlocked) return i;
    }
    return -1;
  }, [rawProgressSectionIndex, sectionIdsInOrder, sectionMetaById, comprehensionPassBySection, surveyPassBySection]);
  const progressSectionIndex =
    firstBlockedGateIndex >= 0 ? Math.min(rawProgressSectionIndex, firstBlockedGateIndex - 1) : rawProgressSectionIndex;
  const courseProgress =
    personId && courseIdFromUrl && sectionIdsInOrder.length > 0
      ? progressSectionIndex < 0
        ? 0
        : Math.round(((progressSectionIndex + 1) / sectionIdsInOrder.length) * 100)
      : 0;
  const isFullyComplete = sectionIdsInOrder.length > 0 && progressSectionIndex >= sectionIdsInOrder.length - 1;

  const defaultSectionIdForBootstrap = useMemo(() => {
    if (sectionIdsInOrder.length === 0) return null;
    if (isFullyComplete) return sectionIdsInOrder[sectionIdsInOrder.length - 1] ?? null;
    const idx = progressSectionIndex >= 0 ? Math.min(progressSectionIndex, sectionIdsInOrder.length - 1) : 0;
    return sectionIdsInOrder[idx] ?? sectionIdsInOrder[0] ?? null;
  }, [sectionIdsInOrder, progressSectionIndex, isFullyComplete]);

  const buildCourseHref = useCallback(
    (overrides?: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams();
      if (courseIdFromUrl) p.set("recordId", courseIdFromUrl);
      if (trackIdFromUrl) p.set("trackId", trackIdFromUrl);
      if (personId) p.set("personId", personId);
      const r = sp.get("resourceIds");
      if (r) p.set("resourceIds", r);
      if (overrides) {
        for (const [k, v] of Object.entries(overrides)) {
          if (v === null || v === undefined || v === "") p.delete(k);
          else p.set(k, v);
        }
      }
      return `${pathname}?${p.toString()}`;
    },
    [courseIdFromUrl, trackIdFromUrl, personId, pathname, sp]
  );

  useEffect(() => {
    if (!courseIdFromUrl || sectionIdsInOrder.length === 0 || sectionFromUrl || userChoseOutlineOnly.current) return;
    const def = defaultSectionIdForBootstrap;
    if (!def) return;
    router.replace(buildCourseHref({ section: def }));
  }, [courseIdFromUrl, sectionIdsInOrder.length, sectionFromUrl, defaultSectionIdForBootstrap, router, buildCourseHref]);

  const openSection = useCallback(
    (sectionId: string) => {
      userChoseOutlineOnly.current = false;
      router.push(buildCourseHref({ section: sectionId }));
    },
    [router, buildCourseHref]
  );

  const backToOutlineOnly = useCallback(() => {
    userChoseOutlineOnly.current = true;
    router.push(buildCourseHref({ section: null }));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router, buildCourseHref]);

  useEffect(() => {
    if (!activeReaderSectionId || !readerAnchorRef.current) return;
    readerAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeReaderSectionId]);

  /** Monotonic furthest page: merging into session never lowers lastViewedIndex when reviewing earlier pages. */
  useEffect(() => {
    if (!personId || !courseIdFromUrl || !activeReaderSectionId || sectionIdsInOrder.length === 0) return;
    const blockedByComp = Boolean(
      sectionMetaById[activeReaderSectionId]?.comprehensionMode && !comprehensionPassBySection[activeReaderSectionId]
    );
    const blockedBySurvey = Boolean(
      sectionMetaById[activeReaderSectionId]?.surveyRequired && !surveyPassBySection[activeReaderSectionId]
    );
    if (blockedByComp || blockedBySurvey) return;
    const slot = sectionIdsInOrder.indexOf(activeReaderSectionId);
    if (slot < 0) return;
    try {
      const raw = window.sessionStorage.getItem("lms_progress_data");
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const safe = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const merged = mergeProgressMaps(safe as Record<string, ProgressEntry>, {
        [courseIdFromUrl]: { lastViewedIndex: slot },
      });
      window.sessionStorage.setItem("lms_progress_data", JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }, [
    personId,
    courseIdFromUrl,
    activeReaderSectionId,
    sectionIdsInOrder.join(","),
    sectionMetaById,
    comprehensionPassBySection,
    surveyPassBySection,
  ]);

  const getResourceIdsForSection = useCallback(
    (sid: string) => sectionMetaById[sid]?.resourceIds ?? sectionList.find((r) => r.id === sid)?.resourceIds ?? [],
    [sectionMetaById, sectionList]
  );

  const handleNavigateEmbedSection = useCallback(
    (id: string) => {
      userChoseOutlineOnly.current = false;
      router.push(buildCourseHref({ section: id }));
    },
    [router, buildCourseHref]
  );

  const handleComprehensionPassed = useCallback(
    (snapshot?: ComprehensionViewSnapshot) => {
      if (!activeReaderSectionId) return;
      setComprehensionPassBySection((p) => ({ ...p, [activeReaderSectionId]: true }));
      if (snapshot) {
        setComprehensionSnapshotBySection((p) => ({ ...p, [activeReaderSectionId]: snapshot }));
        if (!demoComprehensionBypass && personId && courseIdFromUrl) {
          writeComprehensionProgress(personId, courseIdFromUrl, activeReaderSectionId, snapshot);
        }
      }
    },
    [activeReaderSectionId, personId, courseIdFromUrl, demoComprehensionBypass]
  );

  const sectionAdvanceBlocked = Boolean(
    activeReaderSectionId &&
      ((sectionMetaById[activeReaderSectionId]?.comprehensionMode &&
        !comprehensionPassBySection[activeReaderSectionId]) ||
        (sectionMetaById[activeReaderSectionId]?.surveyRequired &&
          !surveyPassBySection[activeReaderSectionId]))
  );

  const comprehensionHydratedPass = Boolean(
    activeReaderSectionId && comprehensionPassBySection[activeReaderSectionId]
  );
  const surveyHydratedPass = Boolean(activeReaderSectionId && surveyPassBySection[activeReaderSectionId]);

  const activeComprehensionSnapshot =
    activeReaderSectionId != null ? comprehensionSnapshotBySection[activeReaderSectionId] ?? null : null;

  const handleFinishCourse = useCallback(() => {
    if (typeof window === "undefined") return;
    const rid = resolveFinishTrackRecordId({ trackIdFromUrl, linkedLearningTrackIds });
    const href = buildTrackViewHref(personId, rid);
    const pid = personId ?? undefined;
    const courseId = courseIdFromUrl ?? undefined;
    const lastIdx = sectionIdsInOrder.length > 0 ? sectionIdsInOrder.length - 1 : -1;
    const lastSectionId =
      lastIdx >= 0
        ? activeReaderSectionId && sectionIdsInOrder.includes(activeReaderSectionId)
          ? activeReaderSectionId
          : sectionIdsInOrder[lastIdx]
        : null;

    const networkMs = 4500;
    const abortableFetch = (url: string, init: RequestInit) => {
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), networkMs);
      return fetch(url, { ...init, signal: ac.signal }).finally(() => window.clearTimeout(t));
    };

    if (pid && courseId) {
      const freeResponses = Object.entries(comprehensionSnapshotBySection)
        .map(([sid, snap]) => {
          const question = snap?.question != null ? String(snap.question).trim() : "";
          const answer = snap?.freeSubmitted != null ? String(snap.freeSubmitted).trim() : "";
          if (!question || !answer) return null;
          return { sectionId: sid, question, answer };
        })
        .filter((x): x is { sectionId: string; question: string; answer: string } => Boolean(x));
      if (rid && freeResponses.length > 0) {
        void fetch("/api/assignments/complete-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: pid,
            trackId: rid,
            courseId,
            freeResponses,
          }),
        }).catch(() => {});
      }
      void abortableFetch(COMPLETE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: pid, courseId }),
      }).catch(() => {});
      if (lastSectionId != null && lastIdx >= 0) {
        void postSectionViewProgress({
          personId: pid,
          courseId,
          sectionIds: sectionIdsInOrder,
          viewedSectionId: lastSectionId,
        }).catch(() => {});
      }
      try {
        const raw = window.sessionStorage.getItem("lms_progress_data");
        const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const safe = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        const merged = mergeProgressMaps(safe as Record<string, ProgressEntry>, {
          [courseId]: { lastViewedIndex: lastIdx, completedAt: new Date().toISOString() },
        });
        window.sessionStorage.setItem("lms_progress_data", JSON.stringify(merged));
      } catch {
        /* ignore */
      }
    }
    window.location.href = href;
  }, [
    personId,
    courseIdFromUrl,
    trackIdFromUrl,
    linkedLearningTrackIds,
    activeReaderSectionId,
    comprehensionSnapshotBySection,
    sectionIdsInOrder.join(","),
  ]);

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
          <p className="text-lg font-semibold text-foreground">Loading Course...</p>
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

  const showReader = Boolean(activeReaderSectionId && sectionIdsInOrder.length > 0);

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 py-4 md:py-6">
      <div className="w-full max-w-[1600px] mx-auto">
        <Button variant="ghost" onClick={goBack} className="mb-3 -ml-2 text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {personId ? "Back to My Track" : "Back to Track"}
        </Button>

        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-2">
            {stripYearSuffix(String(selectedCourse.fields?.title ?? selectedCourse.fields?.["Course Title"] ?? "Course"))}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm mb-3">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              {formatDuration(selectedCourse.fields?.estimatedDuration as number | null | undefined)}
            </span>
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 shrink-0" />
              {tocSections.length} {tocSections.length === 1 ? "page" : "pages"}
            </span>
          </div>
          <Card className="bg-accent/50 mb-5">
            <CardHeader className="py-4">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-base font-semibold">Section Progress</CardTitle>
                <span
                  className={cn(
                    "text-lg font-bold",
                    courseProgress <= 0 ? "text-[#E61C39]" : "text-[#228B22]"
                  )}
                >
                  {courseProgress}%
                </span>
              </div>
              <Progress value={courseProgress} className="h-3 w-full" />
            </CardHeader>
          </Card>

          {tocSections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pages in this course yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <h2 className="text-base font-semibold mb-2">Table of Contents</h2>
              <div className="relative mb-0">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" aria-hidden />
                <ul className="space-y-0">
                  {tocSections.map((section, idx) => {
                    const fullIdx = sectionIdsInOrder.indexOf(section.id);
                    const isCurrent = Boolean(activeReaderSectionId === section.id);
                    const isLastToc = idx === tocSections.length - 1;
                    const isViewed =
                      (progressSectionIndex >= 0 && fullIdx >= 0 && fullIdx < progressSectionIndex) ||
                      (isFullyComplete && isLastToc);
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
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left font-medium text-foreground hover:text-primary hover:underline cursor-pointer"
                          onClick={() => openSection(section.id)}
                        >
                          {section.title}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>

        {showReader && courseIdFromUrl && activeReaderSectionId && (
          <div ref={readerAnchorRef} id="course-session-reader" className="mt-5 pt-5 border-t border-border w-full">
            <div className="mx-auto max-w-2xl px-3 md:px-4">
              <SectionContentBlock
                recordId={activeReaderSectionId}
                courseId={courseIdFromUrl}
                trackId={trackIdFromUrl ?? undefined}
                linkedLearningTrackIds={linkedLearningTrackIds}
                sectionIds={sectionIdsInOrder}
                personId={personId ?? undefined}
                embedInCourseDetail
                comprehensionHydratedPass={comprehensionHydratedPass}
                surveyHydratedPass={surveyHydratedPass}
                comprehensionSnapshot={activeComprehensionSnapshot}
                comprehensionPersistenceDisabled={demoComprehensionBypass}
                onComprehensionPassed={handleComprehensionPassed}
                getResourceIdsForSection={getResourceIdsForSection}
                onBackToOutline={backToOutlineOnly}
                onNavigateEmbedSection={handleNavigateEmbedSection}
              />
            </div>
            <ResourceLibrarySection
              recordId={activeReaderSectionId}
              courseId={courseIdFromUrl}
              trackId={trackIdFromUrl ?? undefined}
              sectionIds={sectionIdsInOrder}
              resourceIds={getResourceIdsForSection(activeReaderSectionId)}
              personId={personId}
              embedInCourseDetail
              sectionAdvanceBlocked={sectionAdvanceBlocked}
              comprehensionPersistenceDisabled={demoComprehensionBypass}
              getResourceIdsForSection={getResourceIdsForSection}
              onNavigateEmbedSection={handleNavigateEmbedSection}
              onFinishCourse={handleFinishCourse}
            />
          </div>
        )}

        {courseMaterialIds.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border mb-2">
            <h2 className="text-lg font-semibold mb-2">Course Materials</h2>
          </div>
        )}
      </div>
    </div>
  );
}
