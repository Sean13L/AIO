# Project: AI Syllabus Assistant

## Purpose
An app that uses AI to automatically ingest course syllabuses, extract the information that actually matters, and turn it into a live, organized, forward-looking system for staying on top of school — not just a static summary.

## User Model
- **Single-user data model:** each account owns its own courses, deadlines, and lectures. No shared/multi-student course records in the core data model.
- **Multi-user calendar syncing (optional layer on top):** the calendar sync feature should support pushing a user's calendar to more than one destination — e.g. the student's own Google Calendar plus a parent's or study partner's. This is a sync-layer capability, not a change to the single-user ownership model underneath.

## Core Features

### 1. Syllabus Import & Extraction
- Accept uploaded syllabus files (PDF, DOCX, and pasted text at minimum).
- Use an LLM (Claude API) to extract structured data:
  - Grading scheme / weight breakdown
  - Course rules and policies (late work, attendance, academic integrity, regrade policy, etc.)
  - Tools/platforms required (e.g., specific textbook, LMS, software, calculators)
  - All key dates: deadlines, assignments, projects, quizzes, exams
- Output should be structured (JSON) before it's rendered to the UI or written to the database — don't rely on free-text parsing downstream.
- Handle multiple syllabuses (multiple courses) per user, each becoming its own course record.

### 2. Calendar
- Internal calendar view showing all extracted dates across all courses.
- **Event timing rule:** every deadline defaults to an **all-day event**. If the syllabus (or the user) specifies an actual time — e.g. "quiz at 2:00 PM," a fixed exam slot — create a **timed event** in that slot instead. The extraction step needs to detect and flag which dates carry a real time vs. a date-only deadline (this maps directly onto the `is_datetime` flag Notion's own date property already uses — worth mirroring in the app's schema).
- **Export/sync approach:** generate a subscribable calendar feed (standard `.ics` / iCalendar format) per user, served at a stable URL. This is the universal mechanism — Google Calendar, Outlook, and Apple Calendar all support "subscribe by URL," so it satisfies "Google or other calendars" with one implementation rather than a separate integration per provider.
  - Trade-off to flag for the user: subscribed feeds refresh on the calendar provider's own polling schedule (Google Calendar typically checks every several hours, not instantly), so it's *near-real-time*, not instant.
  - If instant sync matters more than universal support, the alternative is a direct **Google Calendar API** (OAuth) push integration — instant updates, but Google-only and requires the user to connect their account.
  - Reasonable default: ship the `.ics` feed first (works everywhere, no auth needed), and treat direct Google API push as a v2 enhancement if instant sync turns out to matter.
- Each calendar event should link back to the originating assignment/quiz record, not just exist as a bare event.
- **Lecture events:** scheduled lectures also appear on the calendar as timed events (they have a fixed class slot, so they're never all-day). Each lecture event links to that session's dedicated pre-review page — see Pre-Lecture Content Review below.

### 3. Organizational Database (mirrors the "Student Planner" Notion setup)
Reference: https://app.notion.com/p/Student-Planner-29356e8d187683f5b00401ad27368574

The app's data model should mirror the structure already validated in Notion:

- **Courses** table — one row per course.
  - Course Code (text, e.g. "CS135")
  - Course Name (title)
  - Semester (select, e.g. "1A")
  - → linked to that course's deadline/assignment items
- **Deadline / Assignment items** table — the core work item, extracted from syllabuses or added manually.
  - Name/Title
  - Course (relation to Courses)
  - Type (select: Assignment, Quiz, Midterm, Final Exam, Project, Peer Evaluation, Other)
  - Date/Deadline (date, with the `is_datetime` flag described above so all-day vs. timed events resolve correctly)
  - Weight (text/%, e.g. "15%")
  - Notes / Description (text)
  - Done (checkbox/status — not started / in progress / done)
  - Design note: the Notion version currently splits this into two databases ("Fall 2026 Course Deadlines" and "Assignments") with overlapping fields. Worth consolidating into a single items table in the app, with a "source" field (auto-extracted vs. manually added) instead of maintaining two parallel structures.
- **Lectures** table — one row per scheduled class session, extracted from the syllabus's week-by-week course schedule.
  - Course (relation to Courses)
  - Date/Time (timed, not all-day — reflects the actual class slot)
  - Week/session number (optional)
  - Topics covered (text, from the syllabus schedule)
  - Slides (file, added once the user uploads them for that session)
  - Pre-Review Page (the dedicated linked page holding the generated preview — see Pre-Lecture Content Review)
  - Preview status (not generated / generated / viewed)
- **To Do List** — a lighter, non-syllabus-linked running task list, separate from the structured deadline items.
- **Extracurriculars** — freeform space for side projects/activities outside coursework, not tied to the grading/deadline schema.
- Multiple views on the items table: by course, by due date (timeline), by status (kanban-style board) — matching what Notion offers natively.

### 4. Pre-Lecture Content Review
- **Source material:** combines two inputs per lecture —
  1. The syllabus's week-by-week/lecture-by-lecture topic schedule (what's covered when), extracted during syllabus import.
  2. Uploaded lecture slides for that specific session, when available.
- The AI cross-references the two: syllabus topic list gives the *expected* scope, slides (once uploaded) give the *actual* content, and the generated preview should lean on slides when present and fall back to the syllabus's topic description alone when they aren't uploaded yet.
- Goal: prime the student on the topic before class to improve retention and in-class comprehension.
- **Dedicated lecture pages:** every scheduled lecture is its own record with its own page — not just a calendar entry. That page holds the generated pre-review content (and, once uploaded, the slides themselves) for that specific session.
  - The lecture's calendar event links directly to its pre-review page.
  - The lecture also appears in the course's schedule listing (in the Notion-style organizational view), also linked to the same page.
  - Needs a trigger mechanism — e.g., a scheduled job that checks "what's the next lecture for each course" and generates/refreshes the preview a set amount of time beforehand.

## Suggested Tech Stack (adjust as needed)
- **Frontend:** React/Next.js
- **Backend:** Node or Python (FastAPI)
- **Database:** Postgres — relational fits courses → items → grading weights well
- **AI:** Claude API for syllabus extraction (structured/JSON output) and lecture-preview generation
- **Calendar sync:** Google Calendar API (OAuth 2.0); Microsoft Graph API if Outlook is in scope

## Open Questions to Resolve
1. Whether to keep Deadlines and Assignments as one consolidated table (recommended above) or preserve the two-database split from the current Notion setup.
2. Multi-user calendar sync mechanism: simplest is multiple `.ics` feed recipients (anyone with the link can subscribe, read-only); more involved is letting a user connect and push to multiple external calendar accounts. Worth deciding before building the sync layer.

## Build Order (suggested)
1. Syllabus upload + AI extraction → structured course record (deadlines *and* the lecture schedule)
2. Database schema + basic CRUD UI for assignments/quizzes/projects
3. Calendar: ship the `.ics` feed first (works everywhere, no auth needed)
4. Notion-style views (timeline, kanban) on top of the same data
5. Lecture pages: slide upload + syllabus-topic cross-reference → generated pre-review content, linked from the lecture's calendar event
6. Multi-recipient calendar sync, direct Google Calendar API push (if instant sync becomes a priority)
