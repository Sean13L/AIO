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

// Concatenates several uploads (a syllabus plus supplemental documents like a
// separate exam schedule or lab-policy addendum) into the single text blob
// extractSyllabus() expects. Labeled per-document once there's more than one,
// so the model can tell "the syllabus proper" apart from an addendum when
// they disagree.
export async function extractCombinedRawText(inputs: SyllabusInput[]): Promise<string> {
  const texts = await Promise.all(inputs.map(extractRawText));
  if (inputs.length === 1) return texts[0];

  return inputs
    .map((input, i) => {
      const label = input.kind === "file" ? input.fileName : "Pasted text";
      return `=== Document ${i + 1}: ${label} ===\n\n${texts[i]}`;
    })
    .join("\n\n");
}
