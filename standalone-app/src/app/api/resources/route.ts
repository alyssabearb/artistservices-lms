import { NextResponse } from "next/server";
import { getRecordsByIds } from "@/lib/airtable";
import { getTableNames } from "@/lib/tables";

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
    const records = await getRecordsByIds(getTableNames().resources, ids);
    return NextResponse.json({ records });
  } catch (e) {
    console.error("[resources]", e);
    return NextResponse.json({ error: "Failed to load resources" }, { status: 500 });
  }
}
