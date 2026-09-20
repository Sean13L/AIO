import { describe, expect, it } from "vitest";
import { formatDue, formatTime } from "@/lib/dates";

describe("formatTime", () => {
  it("passes 24h through unchanged", () => {
    expect(formatTime("00:00", "24h")).toBe("00:00");
    expect(formatTime("13:05", "24h")).toBe("13:05");
    expect(formatTime("23:59", "24h")).toBe("23:59");
  });

  it("converts to 12h with midnight/noon edge cases", () => {
    expect(formatTime("00:00", "12h")).toBe("12:00 AM");
    expect(formatTime("00:30", "12h")).toBe("12:30 AM");
    expect(formatTime("11:59", "12h")).toBe("11:59 AM");
    expect(formatTime("12:00", "12h")).toBe("12:00 PM");
    expect(formatTime("13:05", "12h")).toBe("1:05 PM");
    expect(formatTime("23:59", "12h")).toBe("11:59 PM");
  });
});

describe("formatDue", () => {
  it("renders an all-day item without a time regardless of format", () => {
    const item = { due_at: "2026-10-08T00:00:00.000Z", is_datetime: false };
    expect(formatDue(item, "24h")).toBe("2026-10-08 (all day)");
    expect(formatDue(item, "12h")).toBe("2026-10-08 (all day)");
  });

  it("renders a timed item in the requested format", () => {
    const item = { due_at: "2026-10-08T14:30:00.000Z", is_datetime: true };
    expect(formatDue(item, "24h")).toBe("2026-10-08 at 14:30");
    expect(formatDue(item, "12h")).toBe("2026-10-08 at 2:30 PM");
  });
});
