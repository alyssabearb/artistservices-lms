import { NextResponse } from "next/server";
import { getRecordsByIds, listAllRecords } from "@/lib/airtable";
import { getTableNames } from "@/lib/tables";

/** Returns all courses (paginated) or a subset by ids query for track detail filtering. */
export async function GET(req: Request) {
  try {
    const idsParam = new URL(req.url).searchParams.get("ids");
    const tables = getTableNames();
    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const records = await getRecordsByIds(tables.courses, ids);
      return NextResponse.json({ records });
    }
    const records = await listAllRecords(tables.courses);
    return NextResponse.json({ records });
  } catch (e) {
    console.error("[courses/list]", e);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
