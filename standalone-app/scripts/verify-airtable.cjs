/**
 * Smoke-test Airtable credentials and table names (maxRecords=1 per table).
 * Run from standalone-app: npm run verify:airtable
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

if (!fs.existsSync(envPath)) {
  console.error(
    "Missing .env.local in standalone-app/. Copy .env.local.example → .env.local and set AIRTABLE_PAT and AIRTABLE_BASE_ID (same values you use in Softr / Airtable)."
  );
  process.exit(1);
}

dotenv.config({ path: envPath });

const pat = process.env.AIRTABLE_PAT?.trim();
const baseId = process.env.AIRTABLE_BASE_ID?.trim();

if (!pat || !baseId) {
  console.error("AIRTABLE_PAT and AIRTABLE_BASE_ID must be set in .env.local.");
  process.exit(1);
}

function tableNames() {
  return {
    contacts: process.env.AIRTABLE_TABLE_CONTACTS ?? "Contacts",
    assignments: process.env.AIRTABLE_TABLE_ASSIGNMENTS ?? "Assignments",
    tracks: process.env.AIRTABLE_TABLE_TRACKS ?? "Learning Tracks",
    courses: process.env.AIRTABLE_TABLE_COURSES ?? "Courses",
    sections: process.env.AIRTABLE_TABLE_SECTIONS ?? "Training Sections",
    resources: process.env.AIRTABLE_TABLE_RESOURCES ?? "Resource Library",
  };
}

const HOST = "https://api.airtable.com/v0";

async function probe(label, table) {
  const url = `${HOST}/${baseId}/${encodeURIComponent(table)}?maxRecords=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { label, table, status: res.status, body };
}

async function main() {
  const tables = tableNames();
  const rows = [
    ["contacts", tables.contacts],
    ["assignments", tables.assignments],
    ["tracks", tables.tracks],
    ["courses", tables.courses],
    ["sections", tables.sections],
    ["resources", tables.resources],
  ];

  console.log("Airtable short pass (base:", baseId.slice(0, 8) + "…)\n");

  let failed = false;
  for (const [label, name] of rows) {
    const { status, body } = await probe(label, name);
    const ok = status === 200;
    if (!ok) failed = true;
    const err = body?.error?.message || body?.error?.type || "";
    console.log(
      ok ? `  OK   ${label} → "${name}"` : `  FAIL ${label} → "${name}" HTTP ${status} ${err}`
    );
    if (!ok && label === "contacts" && status === 404) {
      console.log(
        '       Hint: Softr blocks often use "All Personnel". Set AIRTABLE_TABLE_CONTACTS=All Personnel in .env.local.'
      );
    }
  }

  if (failed) {
    console.error("\nOne or more tables failed. Fix table names or PAT scopes and retry.");
    process.exit(1);
  }
  console.log("\nAll tables reachable.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
