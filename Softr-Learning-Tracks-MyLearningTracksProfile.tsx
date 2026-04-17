/**
 * My Learning Tracks – Profile section (user details).
 * Paste into the FIRST Custom Code block on your "My Learning Tracks" page.
 * Block data source: **Contacts** (same base / connection as My Learning entry).
 * URL: ?personId=recXXX (set by the My Learning entry page).
 * Shows: Name, Profile photo (circle), Title, Venues (BEC Venue).
 */
import { useState, useEffect } from "react";
import { useRecord, q } from "@/lib/datasource";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SLUGS = { myLearning: "/my-learning" };

function getParamsFromUrl(): { personId: string | null } {
  if (typeof window === "undefined") return { personId: null };
  const params = new URLSearchParams(window.location.search);
  return { personId: params.get("personId") };
}

const personnelSelect = q.select({
  name: "Name",
  photo: "Photo",
  title: "Title",
  becVenue: "BEC Venue",
});

function photoUrlFromField(v: unknown): string | null {
  if (!v) return null;
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    if (first && typeof first === "object" && "url" in first) return (first as { url: string }).url;
  }
  if (typeof v === "object" && v !== null && "url" in v) return (v as { url: string }).url;
  return null;
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(asString).filter(Boolean).join(", ");
  if (typeof v === "object" && v !== null && "name" in v) return String((v as { name: string }).name);
  return String(v);
}

export default function Block() {
  const [urlParams, setUrlParams] = useState(getParamsFromUrl);
  const personId = urlParams.personId;

  useEffect(() => {
    const read = () => setUrlParams(getParamsFromUrl());
    read();
    const t1 = setTimeout(read, 100);
    const t2 = setTimeout(read, 500);
    const onPop = () => read();
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const { data: person, status } = useRecord({
    recordId: personId ?? undefined,
    select: personnelSelect,
  });

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
  const photoUrl = photoUrlFromField(fields.photo ?? fields.Photo ?? fields["Profile Photo"]);
  const title = asString(fields.title ?? fields.Title ?? "");
  const becVenue = fields.becVenue ?? fields["BEC Venue"];
  function venueDisplayName(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      const name = o.name ?? o.label ?? o.title ?? o["BEC Venue"];
      if (typeof name === "string") return name.trim();
      if (name != null && typeof name === "object" && "name" in (name as object)) return String((name as { name: string }).name);
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
            {title && (
              <p className="text-muted-foreground mt-1">{title}</p>
            )}
            {venueList.length > 0 && (
              <p className="text-muted-foreground mt-1">{venueList.join(", ")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
