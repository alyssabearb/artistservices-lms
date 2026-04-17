/**
 * My Learning – Entry page.
 * Paste into Custom Code block on your "My Learning" page (e.g. slug /my-learning).
 * Block data source: **Contacts** (Artist Services Surveys), or a filtered view (e.g. people with assignments).
 * User enters email → we find the person and redirect to /my-learning-tracks?personId=...
 *
 * If you have more than 100 contacts: Softr often returns only the first 100 records.
 * Use a view filtered to people who may log in, or sort so the first page includes everyone needed.
 * RecordID: use this base’s Airtable record id (formula or "Record ID" field), not a synced copy from another base unless ids match Assignments’ link target.
 */
import { useState, useMemo, useEffect } from "react";
import { useRecords, q } from "@/lib/datasource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

const MY_LEARNING_TRACKS_SLUG = "/my-learning-tracks";

function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  return /[?&]debug=1/.test(window.location.search);
}

const personnelSelect = q.select({
  email: "Email",
  recordId: "RecordID",
  emailAddress: "Email Address",
  workEmail: "Work Email",
  emailAlt: "E-mail",
});

function toEmailString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" && v.includes("@") && v.trim()) return v.trim().toLowerCase();
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    const from = (o.email ?? o.Email ?? o.value ?? o.address ?? o.href) as string | undefined;
    if (typeof from === "string" && from.includes("@") && from.trim()) return from.trim().toLowerCase();
    for (const k of Object.keys(o)) {
      const s = toEmailString(o[k]);
      if (s) return s;
    }
  }
  if (Array.isArray(v) && v.length > 0) return toEmailString(v[0]);
  return "";
}

function getEmailFromRecord(rec: Record<string, unknown> & { fields?: Record<string, unknown> }): string {
  const fields = (rec.fields as Record<string, unknown>) ?? {};
  const topLevel = rec as Record<string, unknown>;
  const candidates = [
    topLevel.email,
    topLevel.Email,
    fields.email,
    fields.Email,
    fields.emailAddress,
    fields.workEmail,
    fields.emailAlt,
    fields["Email Address"],
    fields["Work Email"],
    fields["E-mail"],
  ];
  for (const v of candidates) {
    const s = toEmailString(v);
    if (s) return s;
  }
  for (const key of Object.keys(fields)) {
    const s = toEmailString(fields[key]);
    if (s) return s;
  }
  for (const key of Object.keys(topLevel)) {
    if (key.toLowerCase().includes("email") || key === "Email") {
      const s = toEmailString(topLevel[key]);
      if (s) return s;
    }
  }
  return "";
}

export default function Block() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: personnelData,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecords({
    select: personnelSelect,
    count: 2000,
  }) as {
    data: unknown;
    status: string;
    fetchNextPage?: () => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
  };

  const allPersonnel = useMemo(() => {
    const raw = personnelData as Record<string, unknown> | undefined;
    const list: unknown[] = [];
    // Paginated shape: { pages: [{ items }, { items }, ...] } or similar
    const pages = raw?.pages ?? (Array.isArray(raw) ? raw : []);
    const pageArray = Array.isArray(pages) ? pages : [pages];
    for (const p of pageArray) {
      const page = p as Record<string, unknown>;
      const items =
        page?.items ??
        page?.records ??
        page?.data ??
        (Array.isArray(page) ? page : []);
      if (Array.isArray(items)) list.push(...items);
    }
    // Single-page shape: data is the array itself
    if (list.length === 0 && Array.isArray(raw)) list.push(...raw);
    if (list.length === 0 && raw && typeof raw === "object" && "records" in raw && Array.isArray((raw as { records: unknown[] }).records)) {
      list.push(...(raw as { records: unknown[] }).records);
    }
    return list as { id?: string; fields?: Record<string, unknown> }[];
  }, [personnelData]);

  // If the datasource supports infinite pagination, keep fetching until we have all personnel (Softr often caps at 100 per page)
  useEffect(() => {
    if (typeof fetchNextPage !== "function" || !hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (!isDebug() || status !== "success") return;
    const recs = allPersonnel;
    console.log("[My Learning debug] status:", status, "| personnel count:", recs.length);
    if (recs.length === 0) {
      console.log("[My Learning debug] personnelData keys:", personnelData ? Object.keys(personnelData as object) : "null");
      console.log("[My Learning debug] personnelData sample:", JSON.stringify(personnelData, null, 2).slice(0, 800));
    } else {
      const first = recs[0] as Record<string, unknown> & { fields?: Record<string, unknown> };
      console.log("[My Learning debug] first record keys:", Object.keys(first));
      console.log("[My Learning debug] first record.fields keys:", first?.fields ? Object.keys(first.fields) : "none");
      const extracted = getEmailFromRecord(first as Record<string, unknown> & { fields?: Record<string, unknown> });
      console.log("[My Learning debug] first record extracted email:", extracted || "(empty)");
      const emails = recs.slice(0, 10).map((r) => getEmailFromRecord(r as Record<string, unknown> & { fields?: Record<string, unknown> }));
      console.log("[My Learning debug] first 10 extracted emails:", emails);
    }
  }, [status, allPersonnel, personnelData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email.");
      return;
    }
    setSubmitted(true);
    const match = allPersonnel.filter((rec) => getEmailFromRecord(rec as Record<string, unknown> & { fields?: Record<string, unknown> }) === trimmed);
    if (match.length === 0) {
      if (isDebug()) {
        const allEmails = allPersonnel.map((r) => getEmailFromRecord(r as Record<string, unknown> & { fields?: Record<string, unknown> }));
        console.log("[My Learning debug] no match. You entered (normalized):", trimmed);
        console.log("[My Learning debug] total records:", allPersonnel.length, "| sample emails:", allEmails.slice(0, 15));
      }
      setError("We couldn't find your profile. Reach out to your National Artist Services Team with any questions.");
      setSubmitted(false);
      return;
    }
    if (match.length > 1) {
      setError("Multiple profiles found. Please contact your administrator.");
      setSubmitted(false);
      return;
    }
    const first = match[0] as Record<string, unknown> & { id?: string; fields?: Record<string, unknown> };
    const rawId =
      first?.id ??
      first?.recordId ??
      (first?.fields as Record<string, unknown>)?.recordId ??
      (first?.fields as Record<string, unknown>)?.RecordID;
    const personId =
      typeof rawId === "string"
        ? rawId
        : rawId != null && typeof rawId === "object" && "id" in (rawId as object)
          ? String((rawId as { id?: string }).id ?? "")
          : rawId != null
            ? String(rawId)
            : "";
    if (!personId || personId.length < 5) {
      setError("Could not load your profile. Please try again or contact support.");
      setSubmitted(false);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = `${MY_LEARNING_TRACKS_SLUG}?personId=${encodeURIComponent(personId)}`;
    }
  };

  if (status === "pending") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[280px]">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-6 py-12">
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-10 w-10 text-primary" />
              <CardTitle className="text-2xl">My Learning</CardTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              Enter the email address associated with your profile to see your assigned tracks and continue your progress.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="my-learning-email" className="block text-sm font-medium mb-2">
                  Email address
                </label>
                <input
                  id="my-learning-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={submitted}
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitted}>
                {submitted ? "Redirecting…" : "Continue to My Learning"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
