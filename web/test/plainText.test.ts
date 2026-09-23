import { describe, expect, it } from "vitest";
import { stripInlineMarkdown } from "@/lib/studyGuide/plainText";

describe("stripInlineMarkdown", () => {
  it("strips bold, italics, underscores-bold, and inline code", () => {
    expect(stripInlineMarkdown("a **change in quantity demanded** here")).toBe(
      "a change in quantity demanded here"
    );
    expect(stripInlineMarkdown("What does *ceteris paribus* mean?")).toBe(
      "What does ceteris paribus mean?"
    );
    expect(stripInlineMarkdown("__bold__ and `code`")).toBe("bold and code");
  });

  it("leaves math operators and lone asterisks alone", () => {
    expect(stripInlineMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(stripInlineMarkdown("a*b*c")).toBe("a*b*c");
    expect(stripInlineMarkdown("footnote*")).toBe("footnote*");
  });

  it("passes plain text through unchanged", () => {
    expect(stripInlineMarkdown("The Law of Demand")).toBe("The Law of Demand");
  });
});
