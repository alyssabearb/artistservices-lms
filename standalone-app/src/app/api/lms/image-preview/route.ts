import { NextResponse } from "next/server";
import { isAllowedImagePreviewHost } from "@/lib/lms-image-preview-host";

export const runtime = "nodejs";

const MAX_BYTES = 40 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS } });
}

/** ISO BMFF / HEIF family: do not passthrough as “normal” raster. */
function bufferLooksLikeHeifContainer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const major = buf.toString("ascii", 8, 12).toLowerCase();
  return major === "heic" || major === "heix" || major === "hevc" || major === "mif1" || major === "msf1";
}

function sniffRasterMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

function normalizeMime(h: string | null): string {
  return (h || "").split(";")[0].trim().toLowerCase();
}

function canPassthroughRaster(buf: Buffer, upstreamMime: string | null): { ok: true; contentType: string } | { ok: false } {
  if (bufferLooksLikeHeifContainer(buf)) return { ok: false };
  const mime = normalizeMime(upstreamMime);
  const sniffed = sniffRasterMime(buf);
  const allow = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (sniffed && allow.has(sniffed)) return { ok: true, contentType: sniffed };
  if (allow.has(mime)) return { ok: true, contentType: mime };
  if ((mime === "application/octet-stream" || mime === "" || mime === "binary/octet-stream") && sniffed && allow.has(sniffed)) {
    return { ok: true, contentType: sniffed };
  }
  return { ok: false };
}

async function decodeToViewable(buf: Buffer): Promise<{ body: Buffer; contentType: string }> {
  const sharp = (await import("sharp")).default;
  try {
    const body = await sharp(buf).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { body, contentType: "image/jpeg" };
  } catch {
    const convert = (await import("heic-convert")).default;
    const out = await convert({
      buffer: buf,
      format: "JPEG",
      quality: 0.92,
    });
    return { body: Buffer.from(out), contentType: "image/jpeg" };
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url || !/^https:\/\//i.test(url)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400, headers: { ...CORS } });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid url" }, { status: 400, headers: { ...CORS } });
    }
    if (parsed.username || parsed.password) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400, headers: { ...CORS } });
    }
    if (!isAllowedImagePreviewHost(parsed.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403, headers: { ...CORS } });
    }

    const upstream = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "image/*,*/*" },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream failed" }, { status: 502, headers: { ...CORS } });
    }
    const len = upstream.headers.get("content-length");
    if (len) {
      const n = parseInt(len, 10);
      if (Number.isFinite(n) && n > MAX_BYTES) {
        return NextResponse.json({ error: "File too large" }, { status: 413, headers: { ...CORS } });
      }
    }
    const ab = await upstream.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413, headers: { ...CORS } });
    }
    const buf = Buffer.from(ab);
    const upstreamType = upstream.headers.get("content-type");
    const pass = canPassthroughRaster(buf, upstreamType);
    if (pass.ok) {
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": pass.contentType,
          "Cache-Control": "private, max-age=900",
          ...CORS,
        },
      });
    }
    const { body: imageBytes, contentType } = await decodeToViewable(buf);
    return new NextResponse(new Uint8Array(imageBytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        ...CORS,
      },
    });
  } catch (e) {
    console.error("[lms/image-preview]", e);
    return NextResponse.json({ error: "Preview failed" }, { status: 500, headers: { ...CORS } });
  }
}
