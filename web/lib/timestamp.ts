// The schema has no per-user timezone concept yet, so naive date/time
// strings (from extraction or manual entry) are treated as UTC. Revisit
// once timezones are modeled.
export function toTimestamp(date: string, time: string | null): string {
  return `${date}T${time ?? "00:00"}:00Z`;
}

// A lecture's stored schedule from optional date/time input: no date means
// unscheduled; a date with no time is an all-day lecture.
export function lectureSchedule(
  date: string | null | undefined,
  time: string | null | undefined
): { scheduled_at: string | null; is_datetime: boolean } {
  if (!date) return { scheduled_at: null, is_datetime: true };
  return { scheduled_at: toTimestamp(date, time ?? null), is_datetime: Boolean(time) };
}
