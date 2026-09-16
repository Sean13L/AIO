import type {
  ExtractedItem,
  ExtractedLecture,
  SyllabusExtraction,
} from "./schema";

// Local, offline stand-in for extractSyllabus() when GEMINI_API_KEY isn't
// set. Regex/heuristic based — far less capable than the real Gemini
// extraction, but lets the upload -> extract -> persist pipeline run for
// real (no network call) so it can be exercised without an API key.
// extractSyllabus() falls back to this automatically; see extractSyllabus.ts.

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthNameToNumber(name: string): number | null {
  return MONTHS[name.trim().toLowerCase()] ?? null;
}

// "September 20, 2026" -> "2026-09-20"
function parseLongDate(text: string): string | null {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = monthNameToNumber(m[1]);
  if (!month) return null;
  return `${m[3]}-${pad2(month)}-${pad2(Number(m[2]))}`;
}

// "Sept 8" + inferred year -> "2026-09-08"
function parseShortDate(text: string, year: number): string | null {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!m) return null;
  const month = monthNameToNumber(m[1]);
  if (!month) return null;
  return `${year}-${pad2(month)}-${pad2(Number(m[2]))}`;
}

// "11:59 PM" / "2:00 PM" -> "23:59" / "14:00"
function parseTime(text: string): string | null {
  const m = text.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return `${pad2(hour)}:${m[2]}`;
}

function guessCourse(text: string): SyllabusExtraction["course"] {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  const codeMatch = firstLine.match(/([A-Z]{2,5}\s?\d{2,4})/);
  const nameMatch = firstLine.match(/[—–-]\s*(.+)$/);
  const semesterMatch = text.match(/Semester:\s*(.+)/i);

  return {
    course_code: codeMatch ? codeMatch[1].trim() : firstLine.trim() || "UNKNOWN",
    course_name: nameMatch ? nameMatch[1].trim() : firstLine.trim() || "Unknown course",
    semester: semesterMatch ? semesterMatch[1].trim() : null,
  };
}

function guessGradingScheme(text: string): SyllabusExtraction["grading_scheme"] {
  const scheme: SyllabusExtraction["grading_scheme"] = [];
  const lineRe = /^[\s-]*([A-Za-z][A-Za-z\s]*?):\s*(\d{1,3}%)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text))) {
    scheme.push({ component: m[1].trim(), weight: m[2].trim() });
  }
  return scheme;
}

function guessRequiredTools(text: string): string[] {
  const m = text.match(/Required tools:\s*(.+)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

function guessPolicies(text: string): SyllabusExtraction["policies"] {
  const lateWork = text.match(/Late work:\s*(.+)/i);
  const attendance = text.match(/Attendance:\s*(.+)/i);
  const academicIntegrity = text.match(/Academic integrity:\s*(.+)/i);
  const regrade = text.match(/(Regrade[^\n]*\.)/i);

  return {
    late_work: lateWork ? lateWork[1].trim() : null,
    attendance: attendance ? attendance[1].trim() : null,
    academic_integrity: academicIntegrity ? academicIntegrity[1].trim() : null,
    regrade_policy: regrade ? regrade[1].trim() : null,
    other: null,
  };
}

function guessItems(
  text: string,
  gradingScheme: SyllabusExtraction["grading_scheme"]
): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const lineRe =
    /-\s*(.+?)\s+(?:due|on)\s+([A-Za-z]+ \d{1,2},\s*\d{4})(?:\s+at\s+(\d{1,2}:\d{2}\s*[AP]M))?/gi;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(text))) {
    const name = m[1].trim();
    const due_date = parseLongDate(m[2]);
    if (!due_date) continue;
    const due_time = m[3] ? parseTime(m[3]) : null;

    const lowerName = name.toLowerCase();
    let type: ExtractedItem["type"] = "other";
    if (lowerName.includes("quiz")) type = "quiz";
    else if (lowerName.includes("midterm")) type = "midterm";
    else if (lowerName.includes("final")) type = "final_exam";
    else if (lowerName.includes("project")) type = "project";
    else if (lowerName.includes("peer")) type = "peer_evaluation";
    else if (lowerName.includes("assignment")) type = "assignment";

    const matchingComponent = gradingScheme.find(
      (g) =>
        lowerName.includes(g.component.toLowerCase()) ||
        g.component.toLowerCase().includes(lowerName)
    );

    items.push({
      name,
      type,
      due_date,
      due_time,
      is_datetime: due_time !== null,
      weight: matchingComponent?.weight ?? null,
      notes: null,
    });
  }

  return items;
}

function guessLectures(text: string): ExtractedLecture[] {
  const lectures: ExtractedLecture[] = [];
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  const lineRe = /Week\s*(\d+)\s*\(([^)]+)\):\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  let lastTime: string | null = null;

  while ((m = lineRe.exec(text))) {
    const week_number = Number(m[1]);
    const scheduled_date = parseShortDate(m[2], year);
    let topicsRaw = m[3].trim();

    const timeMatch = topicsRaw.match(/Lecture meets [^.]*?at\s+(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (timeMatch) {
      lastTime = parseTime(timeMatch[1]);
      topicsRaw = topicsRaw.replace(/\s*Lecture meets[^.]*\./i, "").trim();
    }

    if (!scheduled_date || !lastTime) continue;

    lectures.push({
      week_number,
      scheduled_date,
      scheduled_time: lastTime,
      topics: topicsRaw || null,
    });
  }

  return lectures;
}

export function mockExtractSyllabus(syllabusText: string): SyllabusExtraction {
  const course = guessCourse(syllabusText);
  const grading_scheme = guessGradingScheme(syllabusText);

  return {
    course,
    grading_scheme,
    policies: guessPolicies(syllabusText),
    required_tools: guessRequiredTools(syllabusText),
    items: guessItems(syllabusText, grading_scheme),
    lectures: guessLectures(syllabusText),
  };
}
