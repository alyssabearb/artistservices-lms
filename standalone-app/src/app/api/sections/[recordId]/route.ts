import { NextResponse } from "next/server";
import { getRecord } from "@/lib/airtable";
import { getComprehensionQuestionMode, LMS_COMPREHENSION_MODE_FIELD } from "@/lib/lms-fields";
import { getTableNames } from "@/lib/tables";

export async function GET(_req: Request, ctx: { params: Promise<{ recordId: string }> }) {
  try {
    const { recordId } = await ctx.params;
    const rec = await getRecord(getTableNames().sections, recordId);
    if (!rec) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const mode = getComprehensionQuestionMode(rec.fields);
    if (mode) {
      const fields = { ...rec.fields } as Record<string, unknown>;
      delete fields["Correct"];
      delete fields["correct"];
      delete fields["Explanation"];
      delete fields["explanation"];
      fields[LMS_COMPREHENSION_MODE_FIELD] = mode;
      return NextResponse.json({ id: rec.id, fields });
    }
    return NextResponse.json(rec);
  } catch (e) {
    console.error("[sections/id]", e);
    return NextResponse.json({ error: "Failed to load section" }, { status: 500 });
  }
}
