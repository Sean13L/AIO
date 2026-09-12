import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { lectureUploadsDir } from "@/lib/preview/readSlidesText";

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

  fs.mkdirSync(lectureUploadsDir, { recursive: true });
  const fileName = `${id}${path.extname(file.name)}`;
  const filePath = path.join(lectureUploadsDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

  const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const slidesUrl = `${base}/uploads/lectures/${fileName}`;

  const updated = await prisma.lectures.update({
    where: { id },
    data: { slides_url: slidesUrl },
  });
  return NextResponse.json(updated);
}
