import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { ingestSyllabus } from "@/lib/ingestSyllabus";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const text = formData.get("text");

  try {
    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Kept for traceability back to what was extracted, matching
      // syllabi.file_url's intent in schema.sql.
      const uploadsDir = path.join(process.cwd(), "uploads", "syllabi");
      fs.mkdirSync(uploadsDir, { recursive: true });
      const fileName = `${Date.now()}-${file.name}`;
      fs.writeFileSync(path.join(uploadsDir, fileName), buffer);

      const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      const result = await ingestSyllabus({
        userId,
        fileUrl: `${base}/uploads/syllabi/${fileName}`,
        input: { kind: "file", buffer, fileName: file.name },
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (typeof text === "string" && text.trim()) {
      const result = await ingestSyllabus({
        userId,
        fileUrl: `pasted-text:${Date.now()}`,
        input: { kind: "text", text },
      });
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json(
      { error: "Provide a 'file' upload or 'text' field with pasted syllabus text" },
      { status: 400 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
