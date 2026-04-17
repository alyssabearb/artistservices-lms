import { NextResponse } from "next/server";
import { getRecordsByIds } from "@/lib/airtable";
import { getTableNames } from "@/lib/tables";

/** Batch-fetch Training Sections by record id (for course TOC titles and linked resources). */
export async function GET(req: Request) {
  try {
    const idsParam = new URL(req.url).searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ records: [] });
    }
    const ids = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const records = await getRecordsByIds(getTableNames().sections, ids);
    return NextResponse.json({ records });
  } catch (e) {
    console.error("[sections/list]", e);
    return NextResponse.json({ error: "Failed to load sections" }, { status: 500 });
  }
}
