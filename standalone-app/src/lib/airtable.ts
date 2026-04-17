const AIRTABLE_HOST = "https://api.airtable.com/v0";

export type AirtableRecord = { id: string; fields: Record<string, unknown> };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

async function fetchJson(url: string): Promise<unknown> {
  const token = requireEnv("AIRTABLE_PAT");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

export async function listAllRecords(tableName: string): Promise<AirtableRecord[]> {
  const baseId = requireEnv("AIRTABLE_BASE_ID");
  const tableEnc = encodeURIComponent(tableName);
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const u = new URL(`${AIRTABLE_HOST}/${baseId}/${tableEnc}`);
    u.searchParams.set("pageSize", "100");
    if (offset) u.searchParams.set("offset", offset);
    const data = (await fetchJson(u.toString())) as { records?: AirtableRecord[]; offset?: string };
    out.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return out;
}

export async function listRecordsByFormula(tableName: string, filterByFormula: string): Promise<AirtableRecord[]> {
  const baseId = requireEnv("AIRTABLE_BASE_ID");
  const tableEnc = encodeURIComponent(tableName);
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const u = new URL(`${AIRTABLE_HOST}/${baseId}/${tableEnc}`);
    u.searchParams.set("pageSize", "100");
    u.searchParams.set("filterByFormula", filterByFormula);
    if (offset) u.searchParams.set("offset", offset);
    const data = (await fetchJson(u.toString())) as { records?: AirtableRecord[]; offset?: string };
    out.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return out;
}

export async function getRecord(tableName: string, recordId: string): Promise<AirtableRecord | null> {
  const baseId = requireEnv("AIRTABLE_BASE_ID");
  const tableEnc = encodeURIComponent(tableName);
  const u = `${AIRTABLE_HOST}/${baseId}/${tableEnc}/${encodeURIComponent(recordId)}`;
  const token = requireEnv("AIRTABLE_PAT");
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<AirtableRecord>;
}

export async function getRecordsByIds(tableName: string, ids: string[]): Promise<AirtableRecord[]> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return [];
  const all: AirtableRecord[] = [];
  const chunkSize = 8;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const parts = chunk.map((id) => `RECORD_ID()='${id.replace(/'/g, "''")}'`);
    const formula = `OR(${parts.join(",")})`;
    const rows = await listRecordsByFormula(tableName, formula);
    all.push(...rows);
  }
  return all;
}

/** Single-field exact match (field name without braces in env). `normalizedEmail` must already be lowercased / normalized. */
export function contactLookupFormula(normalizedEmail: string): string {
  const e = normalizedEmail.replace(/'/g, "''");
  const primary = process.env.AIRTABLE_CONTACT_EMAIL_FIELD ?? "Email";
  // TRIM so spaces in Airtable do not break equality; LOWER makes match case-insensitive vs literal.
  return `LOWER(TRIM({${primary}}&''))='${e}'`;
}
