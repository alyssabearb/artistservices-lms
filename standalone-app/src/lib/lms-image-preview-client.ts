/**
 * Same-origin preview: server fetches Airtable/CDN URLs (no browser CORS) and returns JPEG.
 *
 * If this UI is embedded on another host (e.g. Softr), set `NEXT_PUBLIC_LMS_ORIGIN` to your
 * deployed LMS base URL (no trailing slash), e.g. `https://your-lms.vercel.app`.
 */

function imagePreviewPostUrl(): string {
  const base =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_LMS_ORIGIN
      ? String(process.env.NEXT_PUBLIC_LMS_ORIGIN).replace(/\/$/, "")
      : "";
  if (base) return base + "/api/lms/image-preview";
  return "/api/lms/image-preview";
}

export async function fetchPreviewObjectUrl(remoteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imagePreviewPostUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: remoteUrl }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
