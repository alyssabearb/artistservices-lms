import { Suspense } from "react";
import MyLearningTracksShell from "./MyLearningTracksShell";

export default function MyLearningTracksPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[280px]">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <MyLearningTracksShell />
    </Suspense>
  );
}
