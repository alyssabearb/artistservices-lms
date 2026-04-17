/**
 * POST course complete. Sets completedAt for personId+courseId. Deploy to Netlify; rewrite /api/complete -> this function.
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

function normalizeEntry(val) {
  if (val == null) return { lastViewedIndex: -1 };
  if (typeof val === "number") return { lastViewedIndex: val };
  return {
    lastViewedIndex: typeof val.lastViewedIndex === "number" ? val.lastViewedIndex : -1,
    startedAt: val.startedAt || null,
    completedAt: val.completedAt || null,
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body = {};
  try {
    body = await req.json();
  } catch (_) {}
  const { personId, courseId } = body;
  if (!personId || !courseId) {
    return json({ error: "Missing personId or courseId" }, 400);
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
    existing[courseId] = {
      ...curEntry,
      completedAt: new Date().toISOString(),
    };
    await redis.set(key, existing);
    return json({ ok: true });
  } catch (err) {
    return json({
      error: "Complete save failed",
      message: String(err.message),
      hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Netlify env.",
    }, 500);
  }
};
