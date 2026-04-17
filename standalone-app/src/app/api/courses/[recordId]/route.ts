import { NextResponse } from "next/server";
import { getRecord } from "@/lib/airtable";
import { getTableNames } from "@/lib/tables";

export async function GET(_req: Request, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const rec = await getRecord(getTableNames().courses, recordId);
    if (!rec) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rec);
  } catch (e) {
    console.error("[courses/id]", e);
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}
