// File storage for uploaded syllabi and lecture slides. Backed by Vercel
// Blob in production; when it isn't configured, falls back to local disk
// under web/.data/ so local dev and CI need no external service — same
// "gracefully degrade when an external service isn't configured" pattern
// already used by mockExtractSyllabus.ts, mockGeneratePreview.ts, and the
// dev-email CredentialsProvider in lib/auth.ts.
//
// Chosen over Cloudflare R2 (the originally planned backend, see
// CLAUDE.md): R2 requires a credit card on file to enable even on its free
// tier. Vercel Blob is free on Hobby with no card, and needs no separate
// account since the app is already deployed on Vercel — connecting a Blob
// store to the project wires up access automatically. Newer projects get
// OIDC-based auth (BLOB_STORE_ID + an auto-injected identity token) instead
// of a static BLOB_READ_WRITE_TOKEN — the @vercel/blob SDK checks for OIDC
// credentials first and falls back to the token var, so either is fine as
// long as one of the two is present.

import fs from "node:fs";
import path from "node:path";

export type Namespace = "lectures" | "syllabi";

function isSafeFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function blobPathname(namespace: Namespace, filename: string): string {
  return `${namespace}/${filename}`;
}

const LOCAL_ROOT = path.join(process.cwd(), ".data");

function localDir(namespace: Namespace): string {
  const dir = path.join(LOCAL_ROOT, namespace);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function localFilePath(namespace: Namespace, filename: string): string {
  return path.join(localDir(namespace), filename);
}

// Only used when Blob storage isn't configured — served by
// app/api/dev-files, a dev-only stand-in for a real public URL.
function localUrl(namespace: Namespace, filename: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/dev-files/${namespace}/${filename}`;
}

export async function uploadFile(
  namespace: Namespace,
  buffer: Buffer,
  filename: string
): Promise<{ filename: string; url: string }> {
  if (!isSafeFilename(filename)) {
    throw new Error(`Unsafe filename: ${filename}`);
  }

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(blobPathname(namespace, filename), buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { filename, url };
  }

  fs.writeFileSync(localFilePath(namespace, filename), buffer);
  return { filename, url: localUrl(namespace, filename) };
}

export async function downloadFile(namespace: Namespace, filename: string): Promise<Buffer | null> {
  if (!isSafeFilename(filename)) return null;

  if (blobConfigured()) {
    const { get } = await import("@vercel/blob");
    const result = await get(blobPathname(namespace, filename), { access: "public" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const arrayBuffer = await new Response(result.stream).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const target = localFilePath(namespace, filename);
  return fs.existsSync(target) ? fs.readFileSync(target) : null;
}

// Best-effort: callers should not let a failed cleanup block the database
// operation it's attached to (e.g. deleting a course whose file is already
// gone, or Blob storage being briefly unreachable). Errors are swallowed
// and logged.
export async function deleteFile(namespace: Namespace, filename: string): Promise<void> {
  if (!isSafeFilename(filename)) return;

  try {
    if (blobConfigured()) {
      const { del } = await import("@vercel/blob");
      await del(blobPathname(namespace, filename));
      return;
    }
    fs.rmSync(localFilePath(namespace, filename), { force: true });
  } catch (err) {
    console.error(`[deleteFile] ${namespace}/${filename} failed:`, err);
  }
}

// The app never has a raw file handle after upload — the filename encoded
// in the stored URL is the only handle it keeps. Returns null for anything
// that isn't a real stored-file URL, notably the "pasted-text:<timestamp>"
// placeholder syllabi.file_url gets for paste-in-text uploads, which were
// never a file at all.
export function filenameFromFileUrl(fileUrl: string | null): string | null {
  if (!fileUrl || !fileUrl.startsWith("http")) return null;
  return fileUrl.split("/").pop() ?? null;
}
