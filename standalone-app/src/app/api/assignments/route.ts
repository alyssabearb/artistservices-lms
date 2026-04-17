import { NextResponse } from "next/server";
import { listAllRecords } from "@/lib/airtable";
import { getAssigneeLinkedIds } from "@/lib/lms-fields";
import { getTableNames } from "@/lib/tables";

export async function GET(req: Request) {
  try {
    const personId = new URL(req.url).searchParams.get("personId");
    if (!personId) {
      return NextResponse.json({ records: [] });
    }
    const all = await listAllRecords(getTableNames().assignments);
    const filtered = all.filter((rec) => getAssigneeLinkedIds(rec.fields).includes(personId));
    return NextResponse.json({ records: filtered });
  } catch (e) {
    console.error("[assignments]", e);
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
  }
}
