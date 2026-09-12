import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { lectureUploadsDir } from "@/lib/preview/readSlidesText";

// Next.js only auto-serves the public/ directory — unlike Express's
// static() middleware, arbitrary directories aren't web-accessible, so
// uploaded slides need an explicit route to be downloadable/viewable.
// (Preview generation itself doesn't need this: readSlidesText() reads
// straight off disk within the Node process.)

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Defend against path traversal — a decoded filename should never
  // resolve outside lectureUploadsDir.
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(lectureUploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(buffer, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}
