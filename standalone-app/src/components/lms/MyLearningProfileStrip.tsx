"use client";

/**
 * Profile strip for My Learning Tracks (data from parent).
 */
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SLUGS = { myLearning: "/my-learning" };

/** Airtable attachment / image field: prefer direct `url`, then thumbnail URLs. */
function attachmentImageUrl(item: unknown): string | null {
  if (item == null || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.url === "string" && o.url.trim()) return o.url.trim();
  const th = o.thumbnails;
  if (th && typeof th === "object") {
    const t = th as Record<string, unknown>;
    for (const key of ["large", "full", "small"] as const) {
      const slot = t[key];
      if (slot && typeof slot === "object" && "url" in (slot as object)) {
        const u = (slot as { url?: string }).url;
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
  }
  return null;
}

function photoUrlFromField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    if (/^https?:\/\//i.test(t)) return t;
    return null;
  }
  if (Array.isArray(v) && v.length > 0) {
    for (const item of v) {
      const u = attachmentImageUrl(item);
      if (u) return u;
    }
  }
  return attachmentImageUrl(v);
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(", ");
  if (typeof v === "object" && v !== null && "name" in v) return String((v as { name: string }).name);
  return String(v);
}

export type MyLearningProfileStripProps = {
  personId: string | null;
  person: { id: string; fields: Record<string, unknown> } | null;
  status: "pending" | "success" | "error";
};

export function MyLearningProfileStrip({ personId, person, status }: MyLearningProfileStripProps) {
  const goBack = () => {
    if (typeof window !== "undefined") window.location.href = PAGE_SLUGS.myLearning;
  };

  if (!personId) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-6 text-center">
        <p className="text-muted-foreground text-sm">No profile selected.</p>
        <Button variant="outline" size="sm" onClick={goBack} className="mt-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Enter your email
        </Button>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-8">
        <div className="w-full max-w-[1600px] mx-auto flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-muted rounded w-48 animate-pulse" />
            <div className="h-4 bg-muted rounded w-32 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const fields = (person?.fields ?? {}) as Record<string, unknown>;
  const name = asString(fields.name ?? fields.Name ?? "");
  const photoUrl = photoUrlFromField(fields["Photo"] ?? fields.Photo ?? fields.photo ?? fields["Profile Photo"]);
  const title = asString(fields.title ?? fields.Title ?? "");
  const becVenue = fields.becVenue ?? fields["BEC Venue"];
  function venueDisplayName(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      const n = o.name ?? o.label ?? o.title ?? o["BEC Venue"];
      if (typeof n === "string") return n.trim();
      if (n != null && typeof n === "object" && "name" in (n as object)) return String((n as { name: string }).name);
    }
    return "";
  }
  const venueList = Array.isArray(becVenue)
    ? becVenue.map(venueDisplayName).filter(Boolean)
    : becVenue != null
      ? [venueDisplayName(becVenue)]
      : [];

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 pt-6 pb-4">
      <div className="w-full max-w-[1600px] mx-auto">
        <Button variant="ghost" onClick={goBack} className="mb-6 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Learning Login
        </Button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-xl border border-border bg-card shadow-sm">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-muted/40 flex items-center justify-center shrink-0 ring-2 ring-border">
            {photoUrl ? (
              <img src={photoUrl} alt={name || "Profile"} className="w-full h-full object-cover min-w-full min-h-full" />
            ) : (
              <span className="text-3xl font-semibold text-muted-foreground">
                {name ? name.charAt(0).toUpperCase() : "?"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{name || "My Learning"}</h1>
            {title && <p className="text-muted-foreground mt-1">{title}</p>}
            {venueList.length > 0 && <p className="text-muted-foreground mt-1">{venueList.join(", ")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
