import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

// Serves files from the local-disk fallback in lib/storage.ts — only ever
// reached when R2 isn't configured (production always has R2 set, so this
// route is a dev/CI convenience, not something a real deployment relies on).
// Public, no auth: matches the same trust model the old worker's file-serving
// endpoint used (an unguessable-ish filename is the only gate) and what a
// real R2 public bucket URL would be.

const NAMESPACES = new Set(["lectures", "syllabi"]);

function isSafeFilename(filename: string): boolean {
  return !filename.includes("/") && !filename.includes("\\") && !filename.includes("..");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ namespace: string; filename: string }> }
) {
  const { namespace, filename } = await params;
  if (!NAMESPACES.has(namespace) || !isSafeFilename(filename)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const target = path.join(process.cwd(), ".data", namespace, filename);
  if (!fs.existsSync(target)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = new Uint8Array(fs.readFileSync(target));
  return new NextResponse(body);
}
