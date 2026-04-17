/**
 * GET progress for a person. Deploy to Netlify; rewrite /api/progress -> this function.
 */
import { Redis } from "@upstash/redis";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizeEntry(val) {
  if (val == null) return { lastViewedIndex: -1 };
  if (typeof val === "number") return { lastViewedIndex: val };
  return {
    lastViewedIndex: typeof val.lastViewedIndex === "number" ? val.lastViewedIndex : -1,
    startedAt: val.startedAt || null,
    completedAt: val.completedAt || null,
  };
}

/** Same as api/index.js — merge legacy Personnel Redis keys into Contact personId reads. */
const BUILTIN_LEGACY_PROGRESS_KEYS = {
  recOvUU9hnSiqpjgU: ["recl3sAfLo4pnplMO"],
};

function getLegacyProgressKeyList(personId) {
  const fromBuiltin = BUILTIN_LEGACY_PROGRESS_KEYS[personId];
  const list = Array.isArray(fromBuiltin) ? [...fromBuiltin] : [];
  try {
    const raw = process.env.PROGRESS_LEGACY_MERGE_JSON;
    if (!raw) return list;
    const parsed = JSON.parse(raw);
    const extra = parsed[personId];
    if (Array.isArray(extra)) list.push(...extra);
    else if (typeof extra === "string") list.push(extra);
  } catch (_) {}
  return [...new Set(list)];
}

function mergeCourseProgress(a, b) {
  const na = normalizeEntry(a);
  const nb = normalizeEntry(b);
  const lastViewedIndex = Math.max(na.lastViewedIndex, nb.lastViewedIndex);
  let startedAt = na.startedAt || nb.startedAt || null;
  if (na.startedAt && nb.startedAt) startedAt = na.startedAt < nb.startedAt ? na.startedAt : nb.startedAt;
  const completedAt = na.completedAt || nb.completedAt || null;
  return { lastViewedIndex, startedAt, completedAt };
}

function mergeProgressObjects(primary, secondary) {
  const out = { ...(primary && typeof primary === "object" ? primary : {}) };
  if (!secondary || typeof secondary !== "object") return out;
  for (const courseId of Object.keys(secondary)) {
    out[courseId] = mergeCourseProgress(out[courseId], secondary[courseId]);
  }
  return out;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const personId = url.searchParams.get("personId");
  const wipe = url.searchParams.get("wipe");
  if (!personId) return json({ error: "Missing personId query" }, 400);

  try {
    const redis = Redis.fromEnv();
    const key = `progress:${personId}`;
    if (wipe === "1" || wipe === "true") {
      await redis.del(key);
      return json({});
    }
    let data = await redis.get(key);
    if (data == null) data = {};
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (_) {
        data = {};
      }
    }
    if (typeof data !== "object" || Array.isArray(data)) data = {};
    const legacyIds = getLegacyProgressKeyList(personId);
    for (const legacyId of legacyIds) {
      let leg = await redis.get(`progress:${legacyId}`);
      if (leg == null) leg = {};
      if (typeof leg === "string") {
        try {
          leg = JSON.parse(leg);
        } catch (_) {
          leg = {};
        }
      }
      if (typeof leg === "object" && !Array.isArray(leg)) data = mergeProgressObjects(data, leg);
    }
    return json(data);
  } catch (err) {
    return json({
      error: "Progress fetch failed",
      message: String(err.message),
      hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Netlify env.",
    }, 500);
  }
};
