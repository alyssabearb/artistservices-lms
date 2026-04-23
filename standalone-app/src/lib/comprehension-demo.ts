import { normalizeEmailForLookup } from "@/lib/contact-email";

/**
 * Full comprehension persistence (localStorage + section-view gating): pass/read snapshots,
 * block Next until answered, same as any normal learner. Checked before demo bypass so this
 * list wins even if NEXT_PUBLIC_DEMO_COMPREHENSION_EMAIL is mis-set.
 */
const BUILT_IN_COMPREHENSION_ALWAYS_PERSIST_EMAILS = new Set([
  normalizeEmailForLookup("alyssabuzzello@livenation.com"),
]);

/** Demo: no comprehension localStorage and no section-view for comprehension-only rows (repeatable demos). */
const BUILT_IN_DEMO_COMPREHENSION_EMAILS = new Set([
  normalizeEmailForLookup("artistservices@livenation.com"),
]);

/**
 * When true, comprehension pass state is not read from or written to localStorage,
 * and section-view webhooks are skipped for comprehension rows (see SectionContentBlock).
 */
export function shouldBypassComprehensionPersistence(email: string | null | undefined): boolean {
  const e = email != null ? normalizeEmailForLookup(String(email)) : "";
  if (e && BUILT_IN_COMPREHENSION_ALWAYS_PERSIST_EMAILS.has(e)) return false;
  if (e && BUILT_IN_DEMO_COMPREHENSION_EMAILS.has(e)) return true;
  const extra =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEMO_COMPREHENSION_EMAIL
      ? normalizeEmailForLookup(process.env.NEXT_PUBLIC_DEMO_COMPREHENSION_EMAIL)
      : "";
  return Boolean(extra && e && e === extra);
}
