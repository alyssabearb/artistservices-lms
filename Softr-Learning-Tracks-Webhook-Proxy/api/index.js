/**
 * Single serverless function: /api/progress (GET), /api/section-view (POST), /api/complete (POST).
 * Stored per person: { [courseId]: { lastViewedIndex, startedAt?, completedAt? } } (legacy: number).
 */

const { Redis } = require("@upstash/redis");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, GET, POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

function setCors(res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
}

function getRedis() {
  const urlCandidates = [
    process.env.REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.KV_REST_API_URL,
  ].filter(Boolean);
  const url = urlCandidates.find((u) => String(u).startsWith("https://"));
  const token =
    process.env.REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing valid Redis: set REDIS_REST_URL and REDIS_REST_TOKEN (full https:// URL from console.upstash.com)."
    );
  }
  return new Redis({ url, token });
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

/** Canonical Contact personId → legacy All Personnel Redis keys (merge on GET /api/progress). Extend via PROGRESS_LEGACY_MERGE_JSON env. */
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

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const path = (req.url || "").split("?")[0];
  const isProgress = path.endsWith("/progress") || path === "/api/progress";
  const isSectionView = path.endsWith("/section-view") || path === "/api/section-view";
  const isComplete = path.endsWith("/complete") || path === "/api/complete";

  if (isProgress) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const personId = req.query.personId;
    if (!personId) return res.status(400).json({ error: "Missing personId query" });
    try {
      const redis = getRedis();
      let data = (await redis.get(`progress:${personId}`)) || {};
      const legacyIds = getLegacyProgressKeyList(personId);
      for (const legacyId of legacyIds) {
        const leg = (await redis.get(`progress:${legacyId}`)) || {};
        data = mergeProgressObjects(data, leg);
      }
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({
        error: "Progress fetch failed",
        message: String(err.message),
      });
    }
  }

  if (isSectionView) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const { personId, courseId, lastViewedIndex } = body;
    if (!personId || !courseId || typeof lastViewedIndex !== "number") {
      return res.status(400).json({ error: "Missing personId, courseId, or lastViewedIndex" });
    }
    try {
      const redis = getRedis();
      const key = `progress:${personId}`;
      const existing = (await redis.get(key)) || {};
      const curEntry = normalizeEntry(existing[courseId]);
      const now = new Date().toISOString();
      if (lastViewedIndex > curEntry.lastViewedIndex) {
        const next = {
          ...curEntry,
          lastViewedIndex,
          startedAt: curEntry.startedAt || now,
        };
        existing[courseId] = next;
        await redis.set(key, existing);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        error: "Progress save failed",
        message: String(err.message),
      });
    }
  }

  if (isComplete) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const { personId, courseId } = body;
    if (!personId || !courseId) {
      return res.status(400).json({ error: "Missing personId or courseId" });
    }
    try {
      const redis = getRedis();
      const key = `progress:${personId}`;
      const existing = (await redis.get(key)) || {};
      const curEntry = normalizeEntry(existing[courseId]);
      existing[courseId] = {
        ...curEntry,
        completedAt: new Date().toISOString(),
      };
      await redis.set(key, existing);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({
        error: "Complete save failed",
        message: String(err.message),
      });
    }
  }

  return res.status(404).json({ error: "Not found", path });
};
