import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { ingestSyllabus } from "@/lib/ingestSyllabus";
import { uploadFileToWorker } from "@/lib/workerClient";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const text = formData.get("text");

  try {
    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Archived on the worker's persistent storage purely for
      // traceability (syllabi.file_url) — the actual text extraction below
      // happens in-memory, right here, since it only needs this request's
      // own upload and doesn't need anything persisted.
      const { url } = await uploadFileToWorker("syllabi", {
        buffer,
        filename: `${Date.now()}-${file.name}`,
      });

      const result = await ingestSyllabus({
        userId,
        fileUrl: url,
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
