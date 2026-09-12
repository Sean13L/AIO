// The schema has no per-user timezone concept yet, so naive date/time
// strings (from extraction or manual entry) are treated as UTC. Revisit
// once timezones are modeled. (Mirrors server/src/util/timestamp.ts.)
export function toTimestamp(date: string, time: string | null): string {
  return `${date}T${time ?? "00:00"}:00Z`;
}
