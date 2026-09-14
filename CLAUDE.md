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

## Implemented Stack
A single Next.js app (`web/`) — the earlier `worker/` + Docker Compose hybrid split was collapsed back into one app once its two jobs became serverless-viable, so there's now one deployable unit instead of two:
- **App:** Next.js (App Router) + Tailwind, Next.js API routes, Prisma against Postgres, NextAuth.js (Google OAuth + magic links via a direct Resend API call — not v5-beta, not nodemailer). Calls Claude directly for syllabus extraction and lecture-preview generation.
- **Database:** Postgres — Neon in production (real free tier, no expiration), a local native install for dev. One `schema.prisma`, no more duplication.
- **File storage** (uploaded syllabi + lecture slides): Vercel Blob via `web/lib/storage.ts`. Switched from the originally planned Cloudflare R2 because R2 requires a credit card on file to enable even within its free tier, while Blob is free on Vercel's Hobby plan with no card and no separate account — the project already deploys on Vercel, so connecting a Blob store just sets `BLOB_READ_WRITE_TOKEN` automatically. Falls back to local disk under `web/.data/` when that env var isn't set, so local dev/CI need no external service — same pattern as the mock syllabus extractor and mock preview generator below.
- **Lecture-preview scheduler:** was an always-on polling loop in `worker/`; now `web/app/api/cron/generate-previews/route.ts`, triggered by Vercel Cron (see `vercel.json`) since Vercel's free Hobby tier only allows daily cron — acceptable given `PREVIEW_LEAD_HOURS` defaults to 48h.
- **Calendar sync:** `.ics` subscription feed, shipped (per-user token URL, multiple sync-target labels supported). Direct Google Calendar OAuth push is *not yet built* — schema has a slot for it (`sync_target_type`, `google_oauth_token`) but the route only accepts `ics_subscriber` today.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — typecheck/test/build against a real Postgres service container.
- **Hosting:** Vercel (free Hobby tier, includes Blob storage) + Neon (free). Chosen after checking current 2026 pricing — Railway/Render/Fly.io no longer have usable free tiers for an always-on container with persistent storage, which is what made collapsing out of the worker/ split the right call rather than just paying to keep it.

## Open Questions — resolved
1. Deadlines/Assignments: consolidated into one `items` table with a `source` field (auto-extracted vs. manual), as recommended — not the two-database Notion split.
2. Multi-user calendar sync: went with multiple `.ics` feed recipients (read-only, link-based) as the simple first cut. Direct OAuth push per recipient is still open — see Build Order step 6 below.

## Build Order (suggested)
1. Syllabus upload + AI extraction → structured course record (deadlines *and* the lecture schedule) — **done**
2. Database schema + basic CRUD UI for assignments/quizzes/projects — **done**
3. Calendar: ship the `.ics` feed first (works everywhere, no auth needed) — **done**
4. Notion-style views (timeline, kanban) on top of the same data — **done**
5. Lecture pages: slide upload + syllabus-topic cross-reference → generated pre-review content, linked from the lecture's calendar event — **done**
6. Multi-recipient calendar sync, direct Google Calendar API push (if instant sync becomes a priority) — **multi-recipient `.ics` done; direct Google push not started** (needs a real Google Cloud OAuth client ID/secret to build against)
