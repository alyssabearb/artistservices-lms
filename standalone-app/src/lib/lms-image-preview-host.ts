/**
 * Host allowlist for /api/lms/image-preview (SSRF guard). Extend if you add other attachment CDNs.
 */

export function isAllowedImagePreviewHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "dl.airtable.com") return true;
  if (h.endsWith(".airtableusercontent.com")) return true;
  return false;
}
