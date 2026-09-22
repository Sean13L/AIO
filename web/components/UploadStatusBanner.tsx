"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUploadManager } from "@/lib/uploadManager";

// Surfaces the in-progress/finished syllabus upload on every page except
// /upload itself, which already shows the same information inline (its own
// richer success card, with the usedMock warning). Lets the user switch
// pages mid-extraction and still see when it finishes and whether it
// worked, instead of that feedback only existing on the page they started
// it from.
export function UploadStatusBanner() {
  const { status, result, error, dismiss } = useUploadManager();
  const pathname = usePathname();

  if (pathname === "/upload" || status === "idle") return null;

  if (status === "uploading") {
    return (
      <div className="upload-status-banner upload-status-banner-progress">
        <span className="upload-status-spinner" aria-hidden="true" />
        Extracting your syllabus in the background — feel free to keep browsing.
      </div>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="upload-status-banner upload-status-banner-success">
        <span>
          ✓ Syllabus imported — {result.itemsCreated} item{result.itemsCreated === 1 ? "" : "s"}{" "}
          and {result.lecturesCreated} lecture{result.lecturesCreated === 1 ? "" : "s"}.
          {result.usedMock && " (used the offline parser — no AI key configured)"}
        </span>
        <div className="upload-status-banner-actions">
          <Link href={`/courses/${result.courseId}`}>
            <button type="button" className="secondary">
              View course
            </button>
          </Link>
          <button type="button" className="upload-status-dismiss" onClick={dismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>
    );
  }

  if (status === "error" && error) {
    return (
      <div className="upload-status-banner upload-status-banner-error">
        <span>Syllabus upload failed: {error}</span>
        <button type="button" className="upload-status-dismiss" onClick={dismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    );
  }

  return null;
}
