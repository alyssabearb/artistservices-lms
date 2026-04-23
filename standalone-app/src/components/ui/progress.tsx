"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  /** Fill segment. Default: green when value > 0, transparent at 0 so the track looks empty. */
  indicatorClassName?: string;
};

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => {
    const n = typeof value === "number" && !Number.isNaN(value) ? Math.min(100, Math.max(0, value)) : 0;
    const fill =
      indicatorClassName ?? (n > 0 ? "bg-[#228B22]" : "bg-transparent");
    return (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn("relative h-4 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn("h-full w-full flex-1 transition-all", fill)}
          style={{ transform: `translateX(-${100 - n}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  }
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
