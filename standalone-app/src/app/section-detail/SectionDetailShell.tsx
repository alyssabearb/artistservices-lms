"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import SectionContentBlock from "@/components/lms/SectionContentBlock";
import ResourceLibrarySection from "@/components/lms/ResourceLibrarySection";
import { getLinkedLearningTrackIdsFromCourseFields } from "@/lib/lms-fields";

export default function SectionDetailShell() {
  const sp = useSearchParams();
  const recordId = sp.get("recordId");
  const courseId = sp.get("courseId");
  const trackId = sp.get("trackId");
  const personId = sp.get("personId");
  const sectionIdsParam = sp.get("sectionIds");
  const resourceIdsParam = sp.get("resourceIds");
  const sectionIds = sectionIdsParam
    ? sectionIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const resourceIds = resourceIdsParam
    ? resourceIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const [linkedLearningTrackIds, setLinkedLearningTrackIds] = useState<string[]>([]);

  useEffect(() => {
    if (!courseId) {
      setLinkedLearningTrackIds([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/courses/${encodeURIComponent(courseId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rec: { fields?: Record<string, unknown> }) => {
        if (cancelled) return;
        setLinkedLearningTrackIds(getLinkedLearningTrackIdsFromCourseFields(rec.fields));
      })
      .catch(() => {
        if (!cancelled) setLinkedLearningTrackIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <>
      <SectionContentBlock
        recordId={recordId}
        courseId={courseId}
        trackId={trackId}
        sectionIds={sectionIds}
        personId={personId}
        linkedLearningTrackIds={linkedLearningTrackIds}
      />
      <ResourceLibrarySection
        recordId={recordId}
        courseId={courseId}
        trackId={trackId}
        sectionIds={sectionIds}
        resourceIds={resourceIds}
        personId={personId}
      />
    </>
  );
}
