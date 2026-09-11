import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { ingestSyllabus } from "../ingest/ingestSyllabus.js";
import { pool } from "../db/client.js";

function usageAndExit(): never {
  console.error(
    `Usage:
  npm run ingest -- --email <user email> --file <path to .pdf|.docx>
  npm run ingest -- --email <user email> --text <path to a .txt file of pasted syllabus text>`
  );
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      file: { type: "string" },
      text: { type: "string" },
    },
  });

  if (!values.email || (!values.file && !values.text)) {
    usageAndExit();
  }

  const result = values.file
    ? await ingestSyllabus({
        userEmail: values.email!,
        fileUrl: path.resolve(values.file),
        input: {
          kind: "file",
          buffer: fs.readFileSync(values.file!),
          fileName: values.file!,
        },
      })
    : await ingestSyllabus({
        userEmail: values.email!,
        fileUrl: `pasted-text:${path.resolve(values.text!)}`,
        input: {
          kind: "text",
          text: fs.readFileSync(values.text!, "utf8"),
        },
      });

  console.log(JSON.stringify(
    {
      userId: result.userId,
      courseId: result.courseId,
      syllabusId: result.syllabusId,
      itemsCreated: result.itemsCreated,
      lecturesCreated: result.lecturesCreated,
      course: result.extraction.course,
    },
    null,
    2
  ));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
