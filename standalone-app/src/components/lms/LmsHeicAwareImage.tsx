"use client";

import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { isLikelyHeicUrl } from "@/lib/lms-heic-detect";
import { fetchPreviewObjectUrl } from "@/lib/lms-image-preview-client";

type Mode = "direct" | "loading" | "blob" | "error";

export type LmsHeicAwareImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

/**
 * Remote images (especially HEIC from Airtable) load via same-origin /api/lms/image-preview:
 * server fetches the URL and returns JPEG (no browser CORS on the attachment host).
 */
export function LmsHeicAwareImage(props: LmsHeicAwareImageProps) {
  const { src, alt, className, ...imgRest } = props;
  const [mode, setMode] = useState<Mode>(() => (src && isLikelyHeicUrl(src, alt) ? "loading" : "direct"));
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  const recoveryAttempted = useRef(false);

  const revoke = useCallback(function () {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
  }, []);

  useEffect(
    function () {
      revoke();
      setBlobUrl(null);
      recoveryAttempted.current = false;
      if (!src) {
        setMode("error");
        return;
      }
      if (isLikelyHeicUrl(src, alt)) {
        setMode("loading");
        let cancelled = false;
        fetchPreviewObjectUrl(src).then(function (url) {
          if (cancelled) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          if (url) {
            blobRef.current = url;
            setBlobUrl(url);
            setMode("blob");
          } else {
            setMode("error");
          }
        });
        return function () {
          cancelled = true;
        };
      }
      setMode("direct");
      return undefined;
    },
    [src, alt, revoke]
  );

  useEffect(
    function () {
      return function () {
        revoke();
      };
    },
    [revoke]
  );

  const onImgError = useCallback(
    function () {
      if (!src || recoveryAttempted.current) {
        setMode("error");
        return;
      }
      if (!isLikelyHeicUrl(src, alt)) {
        setMode("error");
        return;
      }
      recoveryAttempted.current = true;
      setMode("loading");
      fetchPreviewObjectUrl(src).then(function (url) {
        if (!url) {
          setMode("error");
          return;
        }
        revoke();
        blobRef.current = url;
        setBlobUrl(url);
        setMode("blob");
      });
    },
    [src, alt, revoke]
  );

  if (mode === "loading") {
    return (
      <div
        className={cn("flex min-h-[8rem] w-full items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground", className)}
        role="status"
        aria-busy="true"
      >
        Loading image…
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-muted/30 p-4 text-center text-sm", className)}>
        <span className="text-muted-foreground">Preview could not be loaded (try again or open the file).</span>
        <a href={src} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
          Open or download original
        </a>
      </div>
    );
  }

  if (mode === "blob" && blobUrl) {
    return <img src={blobUrl} alt={alt || ""} className={className} {...imgRest} />;
  }

  return <img src={src} alt={alt || ""} className={className} onError={onImgError} {...imgRest} />;
}
