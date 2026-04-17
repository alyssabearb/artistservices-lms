import { NextResponse } from "next/server";
import { listAllRecords } from "@/lib/airtable";
import { getTableNames } from "@/lib/tables";

export async function GET() {
  try {
    const records = await listAllRecords(getTableNames().tracks);
    return NextResponse.json({ records });
  } catch (e) {
    console.error("[tracks/list]", e);
    return NextResponse.json({ error: "Failed to load tracks" }, { status: 500 });
  }
}
