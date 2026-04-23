import { NextResponse } from "next/server";
import { listRecordsByFormula } from "@/lib/airtable";
import { getTableNames } from "@/lib/tables";

function formulaSafe(value: string): string {
  return value.replace(/'/g, "\\'");
}

function linkedContains(fieldName: string, recordId: string): string {
  const safeId = formulaSafe(recordId);
  // Works for linked-record fields by flattening ids into a comma-separated string.
  return `FIND('${safeId}', ARRAYJOIN({${fieldName}}&''))>0`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const personId = (url.searchParams.get("personId") ?? "").trim();
    const sectionId = (url.searchParams.get("sectionId") ?? "").trim();
    if (!personId || !sectionId) {
      return NextResponse.json({ error: "personId and sectionId are required" }, { status: 400 });
    }

    const personField = process.env.AIRTABLE_SURVEY_SUBMITTED_BY_FIELD ?? "Submitted by";
    const sectionField = process.env.AIRTABLE_SURVEY_SECTION_FIELD ?? "Training Section";
    const submittedAtField = process.env.AIRTABLE_SURVEY_SUBMITTED_AT_FIELD ?? "Created";

    const formula = `AND(${linkedContains(personField, personId)},${linkedContains(sectionField, sectionId)})`;
    const rows = await listRecordsByFormula(getTableNames().surveySubmissions, formula);
    const first = rows[0];
    const fields = first?.fields as Record<string, unknown> | undefined;
    const submittedAtRaw = fields?.[submittedAtField] ?? fields?.createdTime ?? fields?.["Created time"];

    return NextResponse.json({
      submitted: rows.length > 0,
      submittedAt: submittedAtRaw != null ? String(submittedAtRaw) : null,
      submissionRecordId: first?.id ?? null,
    });
  } catch (e) {
    console.error("[surveys/status]", e);
    return NextResponse.json({ error: "Failed to verify survey status" }, { status: 500 });
  }
}
