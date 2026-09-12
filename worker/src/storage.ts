import fs from "node:fs";
import path from "node:path";

// Everything lives under one root so a single Docker volume mount
// (STORAGE_ROOT, default /data/uploads) covers all persisted files.
// Resolved to absolute regardless of input — express's res.sendFile()
// rejects relative paths, and STORAGE_ROOT is commonly set as a relative
// "./data" in local .env files.
export const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT ?? path.join(process.cwd(), "data"));

export type Namespace = "lectures" | "syllabi";

export function namespaceDir(namespace: Namespace): string {
  const dir = path.join(STORAGE_ROOT, namespace);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isSafeFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export function filePath(namespace: Namespace, filename: string): string {
  return path.join(namespaceDir(namespace), filename);
}
