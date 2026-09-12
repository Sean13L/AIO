import fs from "node:fs";
import path from "node:path";
import { extractRawText } from "../extraction/parseFile";

// Slides are stored on local disk (web/uploads/lectures/) and re-parsed on
// demand rather than caching extracted text in the DB — schema.sql only has
// slides_url, not a text column, and re-parsing a slide deck is cheap.
export const lectureUploadsDir = path.join(process.cwd(), "uploads", "lectures");

export async function readSlidesText(slidesUrl: string | null): Promise<string | null> {
  if (!slidesUrl) return null;

  const fileName = slidesUrl.split("/").pop();
  if (!fileName) return null;

  const filePath = path.join(lectureUploadsDir, fileName);
  if (!fs.existsSync(filePath)) return null;

  return extractRawText({ kind: "file", buffer: fs.readFileSync(filePath), fileName });
}
