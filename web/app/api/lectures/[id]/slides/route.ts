import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { uploadFileToWorker } from "@/lib/workerClient";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({
    where: { id, courses: { user_id: userId } },
  });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("slides");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded (expected form field 'slides')" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Requesting "<lectureId><ext>" as the filename means re-uploading
  // ("Replace slides") cleanly overwrites the previous file on the worker.
  const { url } = await uploadFileToWorker(
    "lectures",
    { buffer, filename: file.name },
    `${id}${path.extname(file.name)}`
  );

  const updated = await prisma.lectures.update({
    where: { id },
    data: { slides_url: url },
  });
  return NextResponse.json(updated);
}
