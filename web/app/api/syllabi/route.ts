import crypto from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { ingestSyllabus } from "@/lib/ingestSyllabus";
import { uploadFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const text = formData.get("text");
  const courseIdRaw = formData.get("course_id");
  const courseId = typeof courseIdRaw === "string" && courseIdRaw.trim() ? courseIdRaw : undefined;

  if (courseId) {
    const course = await prisma.courses.findFirst({ where: { id: courseId, user_id: userId } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  try {
    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Archived purely for traceability (syllabi.file_url) — the actual
      // text extraction below happens in-memory, right here, since it only
      // needs this request's own upload and doesn't need anything persisted.
      const { url } = await uploadFile(
        "syllabi",
        buffer,
        `${crypto.randomUUID()}${path.extname(file.name)}`
      );

      const result = await ingestSyllabus({
        userId,
        fileUrl: url,
        input: { kind: "file", buffer, fileName: file.name },
        courseId,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (typeof text === "string" && text.trim()) {
      const result = await ingestSyllabus({
        userId,
        fileUrl: `pasted-text:${Date.now()}`,
        input: { kind: "text", text },
        courseId,
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
