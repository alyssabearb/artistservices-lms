/** Client + server: detect HEIC/HEIF from URL or filename (Airtable often keeps original extension). */

export function isLikelyHeicUrl(url: string, filenameHint?: string): boolean {
  if (!url || typeof url !== "string") return false;
  const pathOnly = url.split("?")[0].split("#")[0].toLowerCase();
  if (/\.(heic|heif)(?:$)/i.test(pathOnly)) return true;
  const lower = url.toLowerCase();
  if (lower.includes("image%2fheic") || lower.includes("image/heic")) return true;
  if (lower.includes("image%2fheif") || lower.includes("image/heif")) return true;
  const name = (filenameHint || "").toLowerCase();
  if (/\.(heic|heif)(?:$)/i.test(name)) return true;
  return false;
}

export function blobLooksHeif(blob: Blob): boolean {
  const t = (blob.type || "").toLowerCase();
  return t.includes("heic") || t.includes("heif");
}
