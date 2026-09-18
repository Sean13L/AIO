import { describe, expect, it } from "vitest";
import {
  assertAllowedUpload,
  SYLLABUS_EXTENSIONS,
  SYLLABUS_MAX_BYTES,
} from "@/lib/uploadValidation";

function fakeFile(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe("assertAllowedUpload", () => {
  it("allows a file with an allowed extension and size within the limit", () => {
    expect(() =>
      assertAllowedUpload(fakeFile("syllabus.pdf", 1024), {
        allowedExtensions: SYLLABUS_EXTENSIONS,
        maxBytes: SYLLABUS_MAX_BYTES,
      })
    ).not.toThrow();
  });

  it("rejects a disallowed extension (e.g. html, which a browser would render/execute)", () => {
    expect(() =>
      assertAllowedUpload(fakeFile("payload.html", 1024), {
        allowedExtensions: SYLLABUS_EXTENSIONS,
        maxBytes: SYLLABUS_MAX_BYTES,
      })
    ).toThrow(/Unsupported file type/);
  });

  it("rejects a file over the size limit even with an allowed extension", () => {
    expect(() =>
      assertAllowedUpload(fakeFile("syllabus.pdf", SYLLABUS_MAX_BYTES + 1), {
        allowedExtensions: SYLLABUS_EXTENSIONS,
        maxBytes: SYLLABUS_MAX_BYTES,
      })
    ).toThrow(/too large/);
  });

  it("is case-insensitive on extension", () => {
    expect(() =>
      assertAllowedUpload(fakeFile("Syllabus.PDF", 1024), {
        allowedExtensions: SYLLABUS_EXTENSIONS,
        maxBytes: SYLLABUS_MAX_BYTES,
      })
    ).not.toThrow();
  });
});
