/** Ported from Softr-Learning-Tracks-MyLearningEntry.tsx for identical email matching. */

/** Canonical form for comparisons (case- and Unicode-normalized, invisible chars stripped). */
export function normalizeEmailForLookup(raw: string): string {
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export function toEmailString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" && v.includes("@") && v.trim()) return normalizeEmailForLookup(v);
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    const from = (o.email ?? o.Email ?? o.value ?? o.address ?? o.href) as string | undefined;
    if (typeof from === "string" && from.includes("@") && from.trim()) return normalizeEmailForLookup(from);
    for (const k of Object.keys(o)) {
      const s = toEmailString(o[k]);
      if (s) return s;
    }
  }
  if (Array.isArray(v) && v.length > 0) return toEmailString(v[0]);
  return "";
}

export function getEmailFromRecord(rec: Record<string, unknown> & { fields?: Record<string, unknown> }): string {
  const fields = (rec.fields as Record<string, unknown>) ?? {};
  const topLevel = rec as Record<string, unknown>;
  const candidates = [
    topLevel.email,
    topLevel.Email,
    fields.email,
    fields.Email,
    fields.emailAddress,
    fields.workEmail,
    fields.emailAlt,
    fields["Email Address"],
    fields["Work Email"],
    fields["E-mail"],
  ];
  for (const v of candidates) {
    const s = toEmailString(v);
    if (s) return s;
  }
  for (const key of Object.keys(fields)) {
    const s = toEmailString(fields[key]);
    if (s) return s;
  }
  for (const key of Object.keys(topLevel)) {
    if (key.toLowerCase().includes("email") || key === "Email") {
      const s = toEmailString(topLevel[key]);
      if (s) return s;
    }
  }
  return "";
}
