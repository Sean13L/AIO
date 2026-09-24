import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { extractRawText } from "@/lib/extraction/parseFile";
import { assertAllowedUpload, NOTES_EXTENSIONS, NOTES_MAX_BYTES } from "@/lib/uploadValidation";

// Imports a notes file into the lecture's notes: extracts its text and
// appends it (under a header naming the file) rather than replacing what's
// already there, so importing several files — or importing after typing —
// accumulates. Only the text is kept; the file itself is never stored, same
// as study-guide notes. Plain typed edits go through PATCH /api/lectures/[id].
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({ where: { id, courses: { user_id: userId } } });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Attach at least one file" }, { status: 400 });
  }

  const imported: string[] = [];
  try {
    for (const file of files) {
      assertAllowedUpload(file, { allowedExtensions: NOTES_EXTENSIONS, maxBytes: NOTES_MAX_BYTES });
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = (await extractRawText({ kind: "file", buffer, fileName: file.name })).trim();
      if (text) imported.push(`--- Imported from ${path.basename(file.name)} ---\n\n${text}`);
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (imported.length === 0) {
    return NextResponse.json(
      { error: "Couldn't find any text in that file — is it a scanned image?" },
      { status: 400 }
    );
  }

  const existing = lecture.notes?.trim();
  const notes = [existing, ...imported].filter(Boolean).join("\n\n");
  const updated = await prisma.lectures.update({ where: { id }, data: { notes } });
  return NextResponse.json(updated);
}
