// File storage for uploaded syllabi and lecture slides. Backed by Cloudflare
// R2 (S3-compatible) in production; when R2 isn't configured, falls back to
// local disk under web/.data/ so local dev and CI need no external service —
// same "gracefully degrade when an external service isn't configured"
// pattern already used by mockExtractSyllabus.ts, mockGeneratePreview.ts,
// and the dev-email CredentialsProvider in lib/auth.ts.

import fs from "node:fs";
import path from "node:path";

export type Namespace = "lectures" | "syllabi";

function isSafeFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

async function getR2Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
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

// Only used when R2 isn't configured — served by app/api/dev-files, a
// dev-only stand-in for a real public URL.
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

  const r2 = r2Config();
  if (r2) {
    const client = await getR2Client(r2.accountId, r2.accessKeyId, r2.secretAccessKey);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = `${namespace}/${filename}`;
    await client.send(
      new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: buffer })
    );
    return { filename, url: `${r2.publicUrl.replace(/\/$/, "")}/${key}` };
  }

  fs.writeFileSync(localFilePath(namespace, filename), buffer);
  return { filename, url: localUrl(namespace, filename) };
}

export async function downloadFile(namespace: Namespace, filename: string): Promise<Buffer | null> {
  if (!isSafeFilename(filename)) return null;

  const r2 = r2Config();
  if (r2) {
    const client = await getR2Client(r2.accountId, r2.accessKeyId, r2.secretAccessKey);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: r2.bucket, Key: `${namespace}/${filename}` })
      );
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  const target = localFilePath(namespace, filename);
  return fs.existsSync(target) ? fs.readFileSync(target) : null;
}

// Best-effort: callers should not let a failed cleanup block the database
// operation it's attached to (e.g. deleting a course whose file is already
// gone, or R2 being briefly unreachable). Errors are swallowed and logged.
export async function deleteFile(namespace: Namespace, filename: string): Promise<void> {
  if (!isSafeFilename(filename)) return;

  try {
    const r2 = r2Config();
    if (r2) {
      const client = await getR2Client(r2.accountId, r2.accessKeyId, r2.secretAccessKey);
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(
        new DeleteObjectCommand({ Bucket: r2.bucket, Key: `${namespace}/${filename}` })
      );
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
