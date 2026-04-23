import { NextResponse } from "next/server";
import { listAllRecords, updateRecordFields } from "@/lib/airtable";
import { getAssigneeLinkedIds, getLinkedRecordId } from "@/lib/lms-fields";
import { getTableNames } from "@/lib/tables";

type FreeResponseItem = {
  sectionId?: string;
  question?: string;
  answer?: string;
};

function getAssignmentTrackId(fields: Record<string, unknown> | undefined): string | null {
  if (!fields) return null;
  const ref = fields.track ?? fields.Track;
  return getLinkedRecordId(ref as { id?: string } | string);
}

function getAssignmentCourseId(fields: Record<string, unknown> | undefined): string | null {
  if (!fields) return null;
  const ref = fields.course ?? fields.Course;
  return getLinkedRecordId(ref as { id?: string } | string);
}

function toFreeResponseBlock(items: FreeResponseItem[]): string {
  const lines: string[] = [];
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  lines.push(`[${stamp}]`);
  let qn = 1;
  for (const item of items) {
    const q = (item.question ?? "").trim();
    const a = (item.answer ?? "").trim();
    if (!q || !a) continue;
    lines.push(`Question ${qn} ${q}: ${a}`);
    qn += 1;
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      personId?: string;
      trackId?: string;
      courseId?: string;
      freeResponses?: FreeResponseItem[];
      timeSummaryJson?: unknown;
    };
    const personId = String(body.personId ?? "").trim();
    const trackId = String(body.trackId ?? "").trim();
    const courseId = String(body.courseId ?? "").trim();
    const freeResponses = Array.isArray(body.freeResponses) ? body.freeResponses : [];
    if (!personId || !trackId || !courseId) {
      return NextResponse.json({ error: "personId, trackId, and courseId are required" }, { status: 400 });
    }

    const rows = await listAllRecords(getTableNames().assignments);
    const match = rows.find((rec) => {
      const f = rec.fields as Record<string, unknown> | undefined;
      if (!f) return false;
      if (!getAssigneeLinkedIds(f).includes(personId)) return false;
      if (getAssignmentTrackId(f) !== trackId) return false;
      if (getAssignmentCourseId(f) !== courseId) return false;
      return true;
    });
    if (!match) {
      return NextResponse.json({ ok: false, reason: "assignment_not_found" }, { status: 404 });
    }

    const fields = match.fields as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    const nextBlock = toFreeResponseBlock(freeResponses);
    if (nextBlock) {
      const prev = fields["Free Responses"];
      const prevText = prev != null ? String(prev).trim() : "";
      updates["Free Responses"] = prevText ? `${prevText}\n\n${nextBlock}` : nextBlock;
    }

    if (body.timeSummaryJson != null) {
      updates["Time Summary JSON"] =
        typeof body.timeSummaryJson === "string"
          ? body.timeSummaryJson
          : JSON.stringify(body.timeSummaryJson);
    }
    updates["Last LMS Completion At"] = new Date().toISOString();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, assignmentId: match.id, skipped: true });
    }
    await updateRecordFields(getTableNames().assignments, match.id, updates);
    return NextResponse.json({ ok: true, assignmentId: match.id });
  } catch (e) {
    console.error("[assignments/complete-summary]", e);
    return NextResponse.json({ error: "Failed to write assignment summary" }, { status: 500 });
  }
}
