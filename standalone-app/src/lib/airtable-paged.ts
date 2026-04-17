import type { AirtableRecord } from "./airtable";
import { getEmailFromRecord } from "./contact-email";

const AIRTABLE_HOST = "https://api.airtable.com/v0";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** One Airtable list page (use `nextCursor` for the following page). */
export async function fetchRecordsPage(
  tableName: string,
  options?: { cursor?: string; pageSize?: number }
): Promise<{ records: AirtableRecord[]; nextCursor?: string }> {
  const baseId = requireEnv("AIRTABLE_BASE_ID");
  const token = requireEnv("AIRTABLE_PAT");
  const tableEnc = encodeURIComponent(tableName);
  const u = new URL(`${AIRTABLE_HOST}/${baseId}/${tableEnc}`);
  u.searchParams.set("pageSize", String(options?.pageSize ?? 100));
  if (options?.cursor) u.searchParams.set("offset", options.cursor);
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { records?: AirtableRecord[]; offset?: string };
  return { records: data.records ?? [], nextCursor: data.offset };
}

/**
 * Scan the table page-by-page for rows whose primary email (see getEmailFromRecord) matches `normalizedEmail`.
 * Stops early once two matches exist (enough to respond "multiple"). Otherwise scans the whole table up to `maxPages`.
 */
export async function findRecordsByNormalizedEmail(
  tableName: string,
  normalizedEmail: string,
  options?: { maxPages?: number }
): Promise<AirtableRecord[]> {
  const maxPages = options?.maxPages ?? 500;
  const matches: AirtableRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const { records, nextCursor } = await fetchRecordsPage(tableName, { cursor, pageSize: 100 });
    for (const r of records) {
      const em = getEmailFromRecord(r as Record<string, unknown> & { fields?: Record<string, unknown> });
      if (em && em === normalizedEmail) {
        matches.push(r);
      }
    }
    if (matches.length >= 2) return matches;
    cursor = nextCursor;
    if (!cursor) break;
  }
  return matches;
}

/** List up to `maxRecords` (for scan fallback when formula lookup misses). */
export async function listRecordsUpTo(tableName: string, maxRecords: number): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let cursor: string | undefined;
  while (out.length < maxRecords) {
    const { records, nextCursor } = await fetchRecordsPage(tableName, { cursor, pageSize: 100 });
    if (records.length === 0) break;
    const room = maxRecords - out.length;
    out.push(...records.slice(0, room));
    if (out.length >= maxRecords) break;
    cursor = nextCursor;
    if (!cursor) break;
  }
  return out;
}
