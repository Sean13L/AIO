// RFC 5545 iCalendar feed generation, hand-rolled — the format is simple
// enough for our needs (VEVENTs with a summary, one time field, and a
// link-back URL) that a dependency isn't worth it.

interface ItemForFeed {
  id: string;
  course_id: string;
  name: string;
  type: string;
  due_at: Date;
  is_datetime: boolean;
  weight: string | null;
  notes: string | null;
  course_code: string;
}

interface LectureForFeed {
  id: string;
  course_id: string;
  scheduled_at: Date;
  week_number: number | null;
  topics: string | null;
  course_code: string;
}

const PRODID = "-//AI Syllabus Assistant//Calendar Feed//EN";

// Placeholder durations: the schema/extraction don't capture how long a
// class or a deadline "block" actually is, so timed events get a nominal
// duration for calendar display rather than showing as instantaneous.
const ITEM_DURATION_MINUTES = 30;
const LECTURE_DURATION_MINUTES = 60;

// Fold lines over 75 octets per RFC 5545 §3.1 (continuation lines start
// with a single space).
function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;

  const segments: string[] = [];
  let chunk = "";
  let chunkBytes = 0;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (chunkBytes + charBytes > 74) {
      segments.push(chunk);
      chunk = char;
      chunkBytes = charBytes;
    } else {
      chunk += char;
      chunkBytes += charBytes;
    }
  }
  segments.push(chunk);

  return segments.join("\r\n ");
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatDateTimeUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

interface VEventInput {
  uid: string;
  dtstamp: Date;
  start: Date;
  allDay: boolean;
  durationMinutes: number;
  summary: string;
  description?: string | null;
  url: string;
}

function buildEvent(event: VEventInput): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatDateTimeUTC(event.dtstamp)}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.start)}`);
  } else {
    lines.push(`DTSTART:${formatDateTimeUTC(event.start)}`);
    const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
    lines.push(`DTEND:${formatDateTimeUTC(end)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT");
  return lines;
}

export interface BuildIcsFeedOptions {
  items: ItemForFeed[];
  lectures: LectureForFeed[];
  webBaseUrl: string;
}

export function buildIcsFeed({ items, lectures, webBaseUrl }: BuildIcsFeedOptions): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AI Syllabus Assistant",
  ];

  for (const item of items) {
    lines.push(
      ...buildEvent({
        uid: `item-${item.id}@ai-syllabus-assistant`,
        dtstamp: now,
        start: new Date(item.due_at),
        allDay: !item.is_datetime,
        durationMinutes: ITEM_DURATION_MINUTES,
        summary: `${item.course_code}: ${item.name}`,
        description: [item.type, item.weight ? `Weight: ${item.weight}` : null, item.notes]
          .filter(Boolean)
          .join(" — "),
        // Each event links back to its originating item — see CLAUDE.md
        // Calendar section. No dedicated item detail page exists yet, so
        // this points at the item's course page.
        url: `${webBaseUrl}/courses/${item.course_id}`,
      })
    );
  }

  for (const lecture of lectures) {
    lines.push(
      ...buildEvent({
        uid: `lecture-${lecture.id}@ai-syllabus-assistant`,
        dtstamp: now,
        start: new Date(lecture.scheduled_at),
        allDay: false,
        durationMinutes: LECTURE_DURATION_MINUTES,
        summary: `${lecture.course_code}: Lecture${
          lecture.week_number ? ` (Week ${lecture.week_number})` : ""
        }`,
        description: lecture.topics,
        // Links to the lecture's dedicated pre-review page — see CLAUDE.md
        // Calendar section ("Each lecture event links directly to its
        // pre-review page").
        url: `${webBaseUrl}/courses/${lecture.course_id}/lectures/${lecture.id}`,
      })
    );
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
