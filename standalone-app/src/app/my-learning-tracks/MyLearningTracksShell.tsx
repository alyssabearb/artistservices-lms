"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MyLearningProfileStrip } from "@/components/lms/MyLearningProfileStrip";
import { MyAssignedTracksGrid } from "@/components/lms/MyAssignedTracksGrid";
import { getLearningTrackImageUrlFromFields, getLinkedRecordId } from "@/lib/lms-fields";

type AssignmentRow = { id?: string; fields?: Record<string, unknown> };
type ContactRow = { id: string; fields: Record<string, unknown> };

export default function MyLearningTracksShell() {
  const sp = useSearchParams();
  const personId = sp.get("personId");

  const [contact, setContact] = useState<ContactRow | null>(null);
  const [cStatus, setCStatus] = useState<"pending" | "success" | "error">("pending");
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [aStatus, setAStatus] = useState<"pending" | "success" | "error">("pending");
  const [trackCourseIdsById, setTrackCourseIdsById] = useState<Map<string, string[]>>(new Map());
  /** Full track rows are fetched per id (assignments only store link ids, not expanded fields like Track Image). */
  const [trackImageUrlById, setTrackImageUrlById] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!personId) {
      setContact(null);
      setCStatus("success");
      return;
    }
    setCStatus("pending");
    fetch(`/api/contacts/${encodeURIComponent(personId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ContactRow) => {
        setContact(d);
        setCStatus("success");
      })
      .catch(() => {
        setContact(null);
        setCStatus("error");
      });
  }, [personId]);

  useEffect(() => {
    if (!personId) {
      setAssignments([]);
      setAStatus("success");
      return;
    }
    setAStatus("pending");
    fetch(`/api/assignments?personId=${encodeURIComponent(personId)}`)
      .then((r) => r.json())
      .then((d: { records?: AssignmentRow[] }) => {
        setAssignments(d.records ?? []);
        setAStatus("success");
      })
      .catch(() => {
        setAssignments([]);
        setAStatus("error");
      });
  }, [personId]);

  const uniqueTrackIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const rec of assignments) {
      const f = rec.fields;
      if (!f) continue;
      const trackRef = f.track ?? f.Track;
      const id = trackRef != null ? getLinkedRecordId(trackRef as { id?: string }) : null;
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [assignments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, string[]>();
      const images = new Map<string, string | null>();
      await Promise.all(
        uniqueTrackIds.map(async (tid) => {
          try {
            const r = await fetch(`/api/tracks/${encodeURIComponent(tid)}`).then((x) => x.json());
            const fields = r.fields as Record<string, unknown> | undefined;
            const courses = fields?.Courses ?? fields?.courses;
            const courseIds = Array.isArray(courses)
              ? courses
                  .map((c: unknown) => getLinkedRecordId(c as { id?: string }))
                  .filter((x): x is string => Boolean(x))
              : [];
            map.set(tid, courseIds);
            images.set(tid, getLearningTrackImageUrlFromFields(fields));
          } catch {
            map.set(tid, []);
            images.set(tid, null);
          }
        })
      );
      if (!cancelled) {
        setTrackCourseIdsById(map);
        setTrackImageUrlById(images);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignments, uniqueTrackIds]);

  if (!personId) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center">
        <p className="text-muted-foreground mb-6">No profile selected. Please start from the entry page.</p>
        <a
          href="/my-learning"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Enter your email
        </a>
      </div>
    );
  }

  return (
    <>
      <MyLearningProfileStrip personId={personId} person={contact} status={cStatus} />
      <MyAssignedTracksGrid
        personId={personId}
        rawAssignments={assignments}
        assignmentsStatus={aStatus}
        trackCourseIdsById={trackCourseIdsById}
        trackImageUrlById={trackImageUrlById}
      />
    </>
  );
}
