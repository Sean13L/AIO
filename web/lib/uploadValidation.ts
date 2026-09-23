import path from "node:path";

// Enforced before a file ever reaches public Blob storage (lib/storage.ts
// uploads with access: "public", and Blob serves files directly with no
// app-controlled Content-Disposition). Without an extension allowlist here,
// an uploaded .html or .svg would be stored and servable as
// browser-executable content at a public URL — a stored-XSS vector. Only
// extensions the app actually knows how to process should ever be allowed
// through.
export function assertAllowedUpload(
  file: File,
  { allowedExtensions, maxBytes }: { allowedExtensions: readonly string[]; maxBytes: number }
): void {
  const ext = path.extname(file.name).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(
      `Unsupported file type "${ext || "(no extension)"}" — allowed: ${allowedExtensions.join(", ")}`
    );
  }
  if (file.size > maxBytes) {
    throw new Error(`File is too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`);
  }
}

// Kept in sync with lib/extraction/parseFile.ts's extractRawText(), which
// is the only thing that ever reads these files back — pdf/docx/txt/md are
// the only extensions it knows how to parse (both syllabi and lecture
// slides go through the same extractor). Allowing an extension here that
// parseFile.ts can't handle would let the upload succeed and then fail
// later at extraction/preview-generation time.
export const SYLLABUS_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;
export const SYLLABUS_MAX_BYTES = 15 * 1024 * 1024;

export const SLIDES_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;
export const SLIDES_MAX_BYTES = 25 * 1024 * 1024;

// Supplementary notes attached to a study guide — parsed for their text and
// discarded, not archived to storage like syllabi/slides (see study_guides.notes).
export const NOTES_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;
export const NOTES_MAX_BYTES = 15 * 1024 * 1024;
