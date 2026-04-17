import { NextResponse } from "next/server";
import { contactLookupFormula, listRecordsByFormula } from "@/lib/airtable";
import { findRecordsByNormalizedEmail } from "@/lib/airtable-paged";
import { normalizeEmailForLookup } from "@/lib/contact-email";
import { getTableNames } from "@/lib/tables";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const normalized = normalizeEmailForLookup(String(body.email ?? ""));
    if (!normalized) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const tables = getTableNames();
    let matches: Awaited<ReturnType<typeof listRecordsByFormula>> = [];
    try {
      matches = await listRecordsByFormula(tables.contacts, contactLookupFormula(normalized));
    } catch (err) {
      // Invalid formula (wrong field name/type) returns HTTP 422 and would skip the scan fallback.
      // Softr-side matching uses client-side email extraction across several field names — mirror that here.
      console.warn("[contacts/lookup] filterByFormula failed, using record scan", err);
    }
    if (matches.length === 0) {
      matches = await findRecordsByNormalizedEmail(tables.contacts, normalized);
    }
    if (matches.length === 0) {
      return NextResponse.json({ matches: [] });
    }
    if (matches.length > 1) {
      return NextResponse.json({
        multiple: true,
        matches: matches.map((m) => ({ id: m.id })),
      });
    }
    return NextResponse.json({
      multiple: false,
      matches: [{ id: matches[0].id, fields: matches[0].fields }],
    });
  } catch (e) {
    console.error("[contacts/lookup]", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
