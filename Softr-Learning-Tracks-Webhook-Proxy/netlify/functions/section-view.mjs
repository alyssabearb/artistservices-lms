/**
 * POST section view. Deploy to Netlify; rewrite /api/section-view -> this function.
 */
import { Redis } from "@upstash/redis";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body = {};
  try {
    body = await req.json();
  } catch (_) {}
  const { personId, courseId, lastViewedIndex } = body;
  if (!personId || !courseId || typeof lastViewedIndex !== "number") {
    return json({ error: "Missing personId, courseId, or lastViewedIndex" }, 400);
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

  try {
    const redis = Redis.fromEnv();
    const key = `progress:${personId}`;
    let existing = await redis.get(key);
    if (typeof existing === "string") {
      try {
        existing = JSON.parse(existing);
      } catch (_) {
        existing = {};
      }
    }
    existing = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
    const curEntry = normalizeEntry(existing[courseId]);
    const now = new Date().toISOString();
    if (lastViewedIndex > curEntry.lastViewedIndex) {
      existing[courseId] = {
        ...curEntry,
        lastViewedIndex,
        startedAt: curEntry.startedAt || now,
      };
      await redis.set(key, existing);
    }
    return json({ ok: true });
  } catch (err) {
    return json({
      error: "Progress save failed",
      message: String(err.message),
      hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Netlify env.",
    }, 500);
  }
};
