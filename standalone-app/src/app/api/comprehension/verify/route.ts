import { NextResponse } from "next/server";
import { getRecord } from "@/lib/airtable";
import {
  parseChoicesJson,
  parseCorrectIdsFromField,
  verifyComprehensionAttempt,
  type ComprehensionMode,
  type VerifyBody,
} from "@/lib/comprehension";
import { getComprehensionChoicesRaw, getComprehensionQuestionMode, getComprehensionQuestionText } from "@/lib/lms-fields";
import { getTableNames } from "@/lib/tables";

function buildPassReferenceSnapshot(
  rec: { fields: Record<string, unknown> },
  mode: ComprehensionMode,
  body: VerifyBody
): {
  referenceQuestion: string;
  referenceCorrectLines: string[];
  referenceFreeSubmitted?: string;
} {
  const question = getComprehensionQuestionText(rec.fields);
  if (mode === "free") {
    const freeSubmitted = body.freeText != null ? String(body.freeText).trim() : "";
    return { referenceQuestion: question, referenceCorrectLines: [], referenceFreeSubmitted: freeSubmitted };
  }
  const correct = parseCorrectIdsFromField(rec.fields["Correct"] ?? rec.fields["correct"]);
  const choices = parseChoicesJson(getComprehensionChoicesRaw(rec.fields));
  const referenceCorrectLines = correct.map((id) => {
    const c = choices.find((x) => x.id === id);
    return c ? c.label : `Option (${id})`;
  });
  return { referenceQuestion: question, referenceCorrectLines };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerifyBody;
    const recordId = body?.recordId != null ? String(body.recordId).trim() : "";
    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }
    const rec = await getRecord(getTableNames().sections, recordId);
    if (!rec) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const mode = getComprehensionQuestionMode(rec.fields);
    if (!mode) {
      return NextResponse.json({ error: "Not a comprehension section" }, { status: 400 });
    }
    const result = verifyComprehensionAttempt(rec, body, mode);
    if (!result.pass) {
      return NextResponse.json(result);
    }
    const ref = buildPassReferenceSnapshot(rec, mode, body);
    return NextResponse.json({
      pass: true,
      explanation: result.explanation,
      referenceQuestion: ref.referenceQuestion,
      referenceCorrectLines: ref.referenceCorrectLines,
      referenceFreeSubmitted: ref.referenceFreeSubmitted,
    });
  } catch (e) {
    console.error("[comprehension/verify]", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
