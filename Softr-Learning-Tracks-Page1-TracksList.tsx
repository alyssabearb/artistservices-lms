/**
 * Page 1: Learning Tracks list.
 * Paste this into the Custom Code block on your Learning Tracks page.
 * Block data source: Learning Tracks table.
 * "Start" navigates to Track Detail page with ?recordId={trackId}.
 */
import { useState } from "react";
import { useRecords, q } from "@/lib/datasource";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowRight, Building2, Theater, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SLUGS = {
  trackDetail: "/track-detail",
};

const tracksSelect = q.select({
  title: "Learning Track Title",
  description: "Description",
  image: "Track Image",
  audiences: "Audiences",
  venueType: "Venue Type",
  courses: "Courses",
  recordId: "RecordID",
  year: "Year",
});

export default function Block() {
  const [selectedVenueType, setSelectedVenueType] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const { data: tracksData, status: tracksStatus } = useRecords({
    select: tracksSelect,
    count: 100,
  });

  const allTracks = tracksData?.pages.flatMap((page) => page.items) ?? [];

  const filteredTracks = allTracks.filter((track) => {
    const venueTypes = Array.isArray(track.fields.venueType) ? track.fields.venueType : [];
    const audiences = Array.isArray(track.fields.audiences) ? track.fields.audiences : [];
    const year = track.fields.year ?? "";
    const venueMatch = selectedVenueType === null || venueTypes.some((vt) => vt.id === selectedVenueType);
    const audienceMatch = selectedAudience === null || audiences.some((aud) => aud.id === selectedAudience);
    const yearMatch = selectedYear === null || year.includes(selectedYear);
    return venueMatch && audienceMatch && yearMatch;
  });

  const goToTrackDetail = (trackId: string) => {
    const url = `${PAGE_SLUGS.trackDetail}?recordId=${encodeURIComponent(trackId)}`;
    if (typeof window !== "undefined") window.location.href = url;
  };

  if (tracksStatus === "pending") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12">
        <div className="w-full max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-video bg-muted" />
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tracksStatus === "error") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center">
        <p className="text-destructive">Error loading learning tracks</p>
      </div>
    );
  }

  if (allTracks.length === 0) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No learning tracks available yet</p>
      </div>
    );
  }

  const venueOptions = [
    { id: "all-venues", label: "All Venues", icon: Globe },
    { id: "selVl5A4Gby1YG0ZU", label: "Amphitheater", icon: Building2 },
    { id: "selyzN4zIFO0QnW35", label: "Club & Theater", icon: Theater },
  ];
  const audienceOptions = [
    { id: "all-audiences", label: "All" },
    { id: "selDoTXDBHVigxnBk", label: "New" },
    { id: "selI5xBvgEm6ER1g1", label: "Returning" },
  ];
  const yearOptions = [
    { id: "all-years", label: "All" },
    { id: "2025", label: "2025" },
    { id: "2026", label: "2026" },
    { id: "Evergreen", label: "Evergreen" },
  ];

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 py-8 md:py-12">
      <div className="w-full max-w-[1600px] mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2">Backstage Learning Tracks Home</h1>
          <p className="text-muted-foreground text-lg mb-8">Choose a track to preview content.</p>

          <div className="mb-6">
            <label className="text-sm font-semibold mb-3 block text-foreground">Venue Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {venueOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedVenueType === option.id;
                const isAllVenues = option.id === "all-venues";
                const showAsActive = isSelected || (isAllVenues && selectedVenueType === null);
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedVenueType(isAllVenues ? null : option.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 px-6 py-4 rounded-lg border-2 transition-all duration-200 font-medium",
                      showAsActive
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-accent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium mb-2.5 block text-muted-foreground">Audience</label>
            <div className="flex flex-wrap gap-2">
              {audienceOptions.map((option) => {
                const isSelected = selectedAudience === option.id;
                const isAll = option.id === "all-audiences";
                const showAsActive = isSelected || (isAll && selectedAudience === null);
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedAudience(isAll ? null : option.id)}
                    className={cn(
                      "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      showAsActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-primary/20"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2.5 block text-muted-foreground">Year</label>
            <div className="flex flex-wrap gap-2">
              {yearOptions.map((option) => {
                const isSelected = selectedYear === option.id;
                const isAll = option.id === "all-years";
                const showAsActive = isSelected || (isAll && selectedYear === null);
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedYear(isAll ? null : option.id)}
                    className={cn(
                      "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      showAsActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-primary/20"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No learning tracks found for the selected filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTracks.map((track) => {
              const imageUrl = Array.isArray(track.fields.image) && track.fields.image.length > 0 ? track.fields.image[0].url : null;
              const sectionCount = Array.isArray(track.fields.courses) ? track.fields.courses.length : 0;
              const recordId = String((track.fields as Record<string, unknown>)?.recordId ?? track.id);
              return (
                <Card key={track.id} className="group hover:shadow-lg transition-shadow duration-300 flex flex-col">
                  {imageUrl && (
                    <div className="aspect-video overflow-hidden rounded-t-lg">
                      <img
                        src={imageUrl}
                        alt={track.fields.title ?? "Learning Track"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-xl leading-tight">{track.fields.title ?? "Untitled Track"}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-3">{track.fields.description ?? "No description available"}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        {sectionCount} {sectionCount === 1 ? "Section" : "Sections"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        onClick={() => goToTrackDetail(recordId)}
                      >
                        Start
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
