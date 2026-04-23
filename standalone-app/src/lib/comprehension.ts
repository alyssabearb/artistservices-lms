import type { AirtableRecord } from "@/lib/airtable";

export type ComprehensionMode = "single" | "multi" | "free";

export type ChoiceItem = { id: string; label: string };

function choicesFromParsedArray(parsed: unknown[]): ChoiceItem[] {
  const out: ChoiceItem[] = [];
  for (const item of parsed) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = o.id != null ? String(o.id).trim() : "";
    const label = o.label != null ? String(o.label).trim() : id;
    if (id) out.push({ id, label: label || id });
  }
  return out;
}

/** Parse Airtable "Choices" long text JSON or an already-parsed array: `[{ "id": "a", "label": "..." }]` */
export function parseChoicesJson(raw: unknown): ChoiceItem[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return choicesFromParsedArray(raw);
  const s = typeof raw === "string" ? raw.replace(/^\uFEFF/, "").trim() : "";
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) return choicesFromParsedArray(parsed);
    return [];
  } catch {
    return [];
  }
}

/** "Correct" field: one id, comma-separated ids, or JSON string array. */
export function parseCorrectIdsFromField(raw: unknown): string[] {
  if (raw == null) return [];
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const a = JSON.parse(s) as unknown;
      if (!Array.isArray(a)) return [];
      return a.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  return [s];
}

/** Free response: at least two sentence-like segments (punctuation heuristic) + minimum length. */
export function freeTextPassesHeuristic(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;
  const parts = t.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length >= 2) return true;
  const byNewline = t.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 12);
  return byNewline.length >= 2;
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export type VerifyBody = {
  recordId: string;
  singleChoiceId?: string;
  multiChoiceIds?: string[];
  freeText?: string;
};

export function verifyComprehensionAttempt(
  rec: AirtableRecord,
  body: VerifyBody,
  mode: ComprehensionMode
): { pass: boolean; explanation?: string } {
  if (!mode) return { pass: false };

  const explanationRaw = rec.fields["Explanation"];
  const explanation =
    explanationRaw != null && String(explanationRaw).trim() ? String(explanationRaw).trim() : undefined;

  if (mode === "free") {
    const text = body.freeText != null ? String(body.freeText) : "";
    const pass = freeTextPassesHeuristic(text);
    return pass ? { pass: true, explanation } : { pass: false };
  }

  const correct = parseCorrectIdsFromField(rec.fields["Correct"]);
  if (correct.length === 0) return { pass: false };

  if (mode === "single") {
    const id = body.singleChoiceId != null ? String(body.singleChoiceId).trim() : "";
    const pass = id.length > 0 && correct.length === 1 && id === correct[0];
    return pass ? { pass: true, explanation } : { pass: false };
  }

  const submitted = Array.isArray(body.multiChoiceIds) ? body.multiChoiceIds.map((x) => String(x).trim()).filter(Boolean) : [];
  const pass = setsEqual(submitted, correct);
  return pass ? { pass: true, explanation } : { pass: false };
}
