import path from "node:path";

export type SyllabusInput =
  | { kind: "text"; text: string }
  | { kind: "file"; buffer: Buffer; fileName: string };

export async function extractRawText(input: SyllabusInput): Promise<string> {
  if (input.kind === "text") {
    return input.text;
  }

  const ext = path.extname(input.fileName).toLowerCase();

  if (ext === ".pdf") {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(input.buffer);
    return result.text;
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: input.buffer });
    return result.value;
  }

  if (ext === ".txt" || ext === ".md") {
    return input.buffer.toString("utf8");
  }

  throw new Error(`Unsupported file type: ${ext || "(no extension)"}`);
}
