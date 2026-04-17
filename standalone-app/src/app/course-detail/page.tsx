"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectToSectionDetail() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    router.replace(`/section-detail?${sp.toString()}`);
  }, [router, sp]);
  return (
    <div className="w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[200px]">
      <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
      <p className="text-sm text-muted-foreground">Opening course…</p>
    </div>
  );
}

/** @deprecated Use `/section-detail` (same query string). */
export default function CourseDetailRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[200px]">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <RedirectToSectionDetail />
    </Suspense>
  );
}
