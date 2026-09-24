import crypto from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { ingestSyllabus } from "@/lib/ingestSyllabus";
import type { SyllabusInput } from "@/lib/extraction/parseFile";
import { uploadFile } from "@/lib/storage";
import { assertAllowedUpload, SYLLABUS_EXTENSIONS, SYLLABUS_MAX_BYTES } from "@/lib/uploadValidation";
import {
  geminiUsageLimitMessage,
  recordGeminiCallAndCheckLimit,
  refundGeminiCall,
} from "@/lib/geminiUsage";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const formData = await req.formData();
  // Multiple files can be appended under the same "file" key — the main
  // syllabus plus any supplemental documents (an addendum, a separate exam
  // schedule) it doesn't cover.
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  const text = formData.get("text");
  const courseIdRaw = formData.get("course_id");
  const courseId = typeof courseIdRaw === "string" && courseIdRaw.trim() ? courseIdRaw : undefined;

  if (courseId) {
    const course = await prisma.courses.findFirst({ where: { id: courseId, user_id: userId } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  try {
    const inputs: SyllabusInput[] = [];
    const fileUrls: string[] = [];

    for (const file of files) {
      assertAllowedUpload(file, {
        allowedExtensions: SYLLABUS_EXTENSIONS,
        maxBytes: SYLLABUS_MAX_BYTES,
      });
      const buffer = Buffer.from(await file.arrayBuffer());

      // Archived purely for traceability (syllabi.file_url) — the actual
      // text extraction below happens in-memory, right here, since it only
      // needs this request's own uploads and doesn't need anything persisted.
      const { url } = await uploadFile(
        "syllabi",
        buffer,
        `${crypto.randomUUID()}${path.extname(file.name)}`
      );
      fileUrls.push(url);
      inputs.push({ kind: "file", buffer, fileName: file.name });
    }

    if (typeof text === "string" && text.trim()) {
      inputs.push({ kind: "text", text });
      fileUrls.push(`pasted-text:${Date.now()}`);
    }

    if (inputs.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one file upload or pasted text" },
        { status: 400 }
      );
    }

    const usage = await recordGeminiCallAndCheckLimit(userId);
    if (!usage.allowed) {
      return NextResponse.json({ error: geminiUsageLimitMessage(usage.limit) }, { status: 429 });
    }

    let result: Awaited<ReturnType<typeof ingestSyllabus>>;
    try {
      result = await ingestSyllabus({
        userId,
        fileUrl: fileUrls.join(", "),
        inputs,
        courseId,
      });
    } catch (err) {
      await refundGeminiCall(userId, usage.date);
      throw err;
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
