import { NextResponse } from "next/server";
import { getRecordsByIds } from "@/lib/airtable";
import { getComprehensionQuestionMode, LMS_COMPREHENSION_MODE_FIELD } from "@/lib/lms-fields";
import { getTableNames } from "@/lib/tables";

function redactComprehensionAnswers<T extends { fields: Record<string, unknown> }>(rec: T): T {
  const mode = getComprehensionQuestionMode(rec.fields);
  if (!mode) return rec;
  const fields = { ...rec.fields } as Record<string, unknown>;
  delete fields["Correct"];
  delete fields["correct"];
  delete fields["Explanation"];
  delete fields["explanation"];
  fields[LMS_COMPREHENSION_MODE_FIELD] = mode;
  return { ...rec, fields };
}

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
    const records = (await getRecordsByIds(getTableNames().sections, ids)).map((r) => redactComprehensionAnswers(r));
    return NextResponse.json({ records });
  } catch (e) {
    console.error("[sections/list]", e);
    return NextResponse.json({ error: "Failed to load sections" }, { status: 500 });
  }
}
