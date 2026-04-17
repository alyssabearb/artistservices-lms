import { Suspense } from "react";
import CourseDetailClient from "@/components/lms/CourseDetailClient";

/** Course reader: TOC + section + resources (`recordId` = course). */
export default function SectionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
          <p className="text-lg font-semibold text-foreground">Loading…</p>
        </div>
      }
    >
      <CourseDetailClient />
    </Suspense>
  );
}
