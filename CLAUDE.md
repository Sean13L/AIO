# Project: AI Syllabus Assistant

## Purpose
An app that uses AI to automatically ingest course syllabuses, extract the information that actually matters, and turn it into a live, organized, forward-looking system for staying on top of school — not just a static summary.

## Branding
Product name is **Studdy** (renamed from "Studently" on 2026-09-19 — see git history for the earlier name if old references turn up in screenshots/docs) — "AI Syllabus Assistant" still serves as the tagline/description. Visual identity: `#1E40AF` dark vibrant blue (replacing the earlier `#6C5CE7` violet on 2026-09-19) stays the one locked *interactive* accent (buttons, links, active nav, focus rings) so clickability is never ambiguous, on warm-neutral light surfaces. Kept meaningfully darker than `--tag-blue-text`/`--color-info` (both lighter, brighter blues already in the palette) so "the one interactive accent" and "an informational/category blue" still read as different things despite sharing a hue family. On top of that, color is used deliberately in two more places rather than kept to a single accent everywhere:
- **Category tags** — a pastel tag-color system (`.tag-blue/teal/amber/rose/violet/pink/slate/green` in `web/app/globals.css`) for item type, status, and source badges.
- **Per-course identity color** — `courseAccentKey()`/`courseInitials()` in `web/lib/uiColors.ts` deterministically hash a course code to one of the same 8 hues (solid `.avatar-*` variant, not pastel) so a course reads as "the same color" everywhere it appears — dashboard list, course header, board cards, and (since 2026-09-20, at the user's request, reversing this doc's earlier stance) the course-code column on the Timeline table too, via the `--tag-*-text` token as the link color — without storing a color in the database. Calendar stays uncolored; a per-row color there would still compete with scanning rather than help it.
- **Marketing surfaces only** — the signed-out homepage hero has a soft blurred multi-color glow (`.home-hero-glow`) and the feature grid uses solid pastel card backgrounds with a white icon circle (`.feature-icon-circle`); a slim static brand-gradient strip (`.top-accent-bar`) runs across the very top of every page. These keep the app feeling colorful/attractive at the edges while every data-dense productivity view (tables, board columns, forms) stays visually quiet — color there is only ever functional (a tag, a course accent), never decorative, so users don't lose focus scanning real work.

Logo is an inline SVG mark (`web/components/Logo.tsx`, also `web/app/icon.svg` for the favicon) — a bold "S" with a diagonal pencil laid across it (sharpened tip and eraser end both visibly poking out past the letter, separated from the S by a knockout-halo gap so the two read as distinct overlapping objects rather than fusing into one shape), no external image asset. Replaced the original rounded-square checkmark glyph on 2026-09-19 as part of the Studdy rebrand. Signed-out visitors at `/` see a real marketing homepage (hero + feature grid); signed-in users see the existing courses dashboard at the same route.

- **App-wide "dark frame" redesign (2026-09-20)**, inspired by a dark music-platform landing page and a school-website template the user shared: a bold display face (`Plus Jakarta Sans`, `--font-display` in `web/app/layout.tsx`, applied to h1/h2/h3/buttons/nav via `web/app/globals.css` — body copy stays on Inter) and pill-shaped buttons (`--radius-pill`) apply globally, so every page picked this up automatically without per-page changes. `TopBar` and the site footer (`.site-footer`) switched from light to a shared dark navy (`--dark-bg`/`--dark-surface`/`--dark-border`/`--dark-text`/`--dark-text-muted` tokens) — since both are present on every single page, this is the one persistent visual thread connecting the whole app to the new look, and it does **not** change with the light/dark content toggle below (the frame is always dark). The homepage (`app/page.tsx`) got the full treatment on top of that shared frame — a full-bleed dark glow hero (`.full-bleed` breaks a section out of `.container`'s max-width using the 100vw/negative-margin technique; `.home-hero-glow`) with an eyebrow label, a gradient-accented headline phrase (`.gradient-text`), a "this week's deadlines" mock product card standing in for photography Studdy doesn't have, a numbered 4-step "how it works" section (`.steps`/`.step-num`), the existing feature grid, and a closing dark CTA band (`.home-cta`) bookending the page the same way the hero opens it.
- **Settings page + real dark mode (2026-09-20)** — `web/app/settings/page.tsx`, linked from a gear icon in `TopBar` (replacing the "signed in as {email}" text + inline Sign out button that used to live in the top bar itself; both now live in the Settings page's Account card instead). Appearance card offers Light/Dark/System, backed by `web/lib/theme.ts`: preference persists to `localStorage` (`studdy-theme`), resolves "system" via `prefers-color-scheme`, and applies as `data-theme="light"|"dark"` on `<html>`. A blocking inline script (`THEME_BOOTSTRAP_SCRIPT`, injected as the first child of `<body>` in `layout.tsx`) sets that attribute before first paint to avoid a light-then-dark flash. Supersedes the light-only content-area decision above: `:root[data-theme="dark"]` in `globals.css` overrides the light-mode content tokens (`--color-bg/-surface/-border/-text*`, `--color-primary*`, `--color-danger/success/warning/info*`, `--tag-*-bg/-text`, `--shadow-*`) with dark-navy/translucent-chip equivalents, so tables, forms, board, calendar grid, and cards all flip too — only the always-dark frame tokens (`--dark-*`) and the fixed `--avatar-*` tokens (kept equal to the original light `--tag-*-text` values, since `.avatar-*` pairs them with a hardcoded white foreground that only stays legible at those specific values) are exempt.
- **Time format setting (2026-09-20)** — same Settings page, a "Time format" card offering 12-hour/24-hour, backed by `web/lib/timeFormat.ts` (`localStorage` key `studdy-time-format`, defaults to 24h — the app's pre-setting behavior — so a visitor who never opens Settings sees no change). `useTimeFormatPreference()` also listens for a same-tab custom event (fired on save) and the cross-tab `storage` event, so every already-open page picks up a change live rather than needing a reload — unlike the theme toggle, this can't be pure CSS since it changes rendered text, so every call site (`formatDue`/`formatTime` in `web/lib/dates.ts`, plus calendar's own `hmUTC`) takes the preference as an explicit argument rather than reading a global.

## User Model
- **Single-user data model:** each account owns its own courses, deadlines, and lectures. No shared/multi-student course records in the core data model.
- **Multi-user calendar syncing (optional layer on top):** the calendar sync feature should support pushing a user's calendar to more than one destination — e.g. the student's own Google Calendar plus a parent's or study partner's. This is a sync-layer capability, not a change to the single-user ownership model underneath.

## Core Features

### 1. Syllabus Import & Extraction
- Accept uploaded syllabus files (PDF, DOCX, and pasted text at minimum).
- Use an LLM (Gemini API — see Implemented Stack for why) to extract structured data:
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
  - **Shipped, owner-only:** the account owner can connect their own Google Calendar (`app/api/calendar-feed/google/authorize` + `.../callback`, `lib/calendar/googleCalendar.ts`) for instant push of their own items/lectures. A shared recipient (parent, study partner) still gets the `.ics` link only — each recipient OAuth-connecting their own calendar was scoped out as a bigger follow-up (would need an auth flow for people with no account in the app).
  - The subscribe/export UI (`components/CalendarFeedCard.tsx` — feed URL, recipient list, Google Calendar connect) lives on `/calendar`, not the courses page — moved there 2026-09-20 since it's calendar functionality, not course management. The Google OAuth callback redirects back to `/calendar`.
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
  - Transcript (free text, built live from the browser's speech recognition during class — see Live Lecture Transcription & Summary) and Transcript summary (AI-generated from it after class)
- **To Do List** — a lighter, non-syllabus-linked running task list, separate from the structured deadline items. Each todo can optionally carry its own deadline (`due_at` + `is_datetime`, same all-day-vs-timed convention as items — added 2026-09-20, Apple Reminders-style: dated and undated tasks coexist in the same list, sorted dated-soonest-first then undated).
  - **Show on calendar (opt-in, per todo)** — added 2026-09-20: a `show_on_calendar` flag, off by default, only settable when the todo has a deadline (enforced in the API — see `app/api/todos/route.ts`/`[id]/route.ts`). When on, that todo appears on the in-app `/calendar` grid (amber `.calendar-event-todo`, distinct from item/lecture colors), the `.ics` feed, and the owner's synced Google Calendar, alongside items/lectures. Clearing a todo's deadline silently turns the flag back off too (not an error) since a dateless todo has nowhere to be placed on a calendar. No dedicated todo detail page exists, so both the `.ics` event and the Google Calendar event link back to `/todos`.
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

### 5. Live Lecture Transcription & Summary (2026-09-20)
- **During class**, not before/after: the lecture page (`app/courses/[id]/lectures/[lectureId]/page.tsx`) has a "Live transcript" card with Start/Stop recording. Uses the browser's own Web Speech API (`lib/useLectureTranscription.ts`, `lib/speechRecognition.d.ts` for the ambient types it doesn't ship with TS's `dom` lib) — chosen over a server-side streaming-audio pipeline specifically because it's free and already in the browser (Chrome/Edge), matching the project's "free tier first" stack choices elsewhere. Firefox/Safari don't support it; the card feature-detects and shows a plain "not supported in this browser" message instead of a broken button.
  - Recording is resumable across multiple start/stop sessions on the same lecture (each new session's text is appended as a new paragraph, not overwritten), autosaves every 20s while recording plus on stop (`PATCH /api/lectures/[id]`), and can be cleared.
  - Stored as `lectures.transcript` — free text, not structured, since speech-to-text output has no natural schema beyond "what was said."
- **After class:** "Generate summary" sends the saved transcript to Gemini (`lib/transcription/generateTranscriptSummary.ts`, same mock-fallback-when-no-`GEMINI_API_KEY` / `usedMock` pattern as the pre-lecture preview) for a study-friendly summary — main topics/key concepts, plus an "announcements & action items" section for anything like office-hours changes or assignment reminders the instructor mentioned, omitted entirely when there's nothing like that. Stored as `lectures.transcript_summary`.
  - Editing or clearing the transcript nulls out any existing `transcript_summary` (enforced in the PATCH route) — the two would otherwise silently drift apart.

## Implemented Stack
A single Next.js app (`web/`) — the earlier `worker/` + Docker Compose hybrid split was collapsed back into one app once its two jobs became serverless-viable, so there's now one deployable unit instead of two:
- **App:** Next.js (App Router) + Tailwind, Next.js API routes, Prisma against Postgres, NextAuth.js (Google OAuth + magic links via a direct Resend API call — not v5-beta, not nodemailer). Calls Gemini directly for syllabus extraction, lecture-preview generation, and post-lecture transcript summarization — switched from the originally-planned Claude API because Anthropic's API has no ongoing free tier (a one-time $5 trial credit, then paid), while Gemini's free tier (via Google AI Studio, no card) is generous enough for a single student's real usage indefinitely. `lib/extraction/extractSyllabus.ts`, `lib/preview/generatePreview.ts`, and `lib/transcription/generateTranscriptSummary.ts` fall back to local heuristic mocks (`mockExtractSyllabus.ts`, `mockGeneratePreview.ts`, `mockGenerateTranscriptSummary.ts`) when `GEMINI_API_KEY` isn't set — same "gracefully degrade" pattern as file storage — but the mock is narrow-format-only (or, for the transcript summarizer, just a snippet), so callers surface a `usedMock` flag the UI turns into a visible warning rather than silently returning inaccurate results. All three call sites go through `lib/gemini.ts`'s `generateContentWithFallback()`, which retries a fixed chain of sibling models (flash-tier first, then `gemini-2.5-pro` as a different-capacity-pool last resort) when the configured model returns a capacity error (503/UNAVAILABLE) — added 2026-09-20 after a real demand spike took out the whole `gemini-3.x` flash lineup at once.
- **Database:** Postgres — Neon in production (real free tier, no expiration), a local native install for dev. One `schema.prisma`, no more duplication.
- **File storage** (uploaded syllabi + lecture slides): Vercel Blob via `web/lib/storage.ts`. Switched from the originally planned Cloudflare R2 because R2 requires a credit card on file to enable even within its free tier, while Blob is free on Vercel's Hobby plan with no card and no separate account — the project already deploys on Vercel, so connecting a Blob store just sets `BLOB_READ_WRITE_TOKEN` automatically. Falls back to local disk under `web/.data/` when that env var isn't set, so local dev/CI need no external service — same pattern as the mock syllabus extractor and mock preview generator below.
- **Lecture-preview scheduler:** was an always-on polling loop in `worker/`; now `web/app/api/cron/generate-previews/route.ts`, triggered by Vercel Cron (see `vercel.json`) since Vercel's free Hobby tier only allows daily cron — acceptable given `PREVIEW_LEAD_HOURS` defaults to 48h.
- **Calendar sync:** `.ics` subscription feed, shipped (per-user token URL, multiple sync-target labels supported). Direct Google Calendar OAuth push, owner-only, also shipped — a separate OAuth flow from NextAuth sign-in (its own authorize/callback routes, `calendar.events` scope, refresh-token storage on `calendar_sync_targets`), since sign-in shouldn't require calendar consent. Requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (same vars as Google sign-in) plus the Calendar API enabled on that Google Cloud project and a second redirect URI registered — see `.env.example`.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — typecheck/test/build against a real Postgres service container.
- **Hosting:** Vercel (free Hobby tier, includes Blob storage) + Neon (free). Chosen after checking current 2026 pricing — Railway/Render/Fly.io no longer have usable free tiers for an always-on container with persistent storage, which is what made collapsing out of the worker/ split the right call rather than just paying to keep it.

## Open Questions — resolved
1. Deadlines/Assignments: consolidated into one `items` table with a `source` field (auto-extracted vs. manual), as recommended — not the two-database Notion split.
2. Multi-user calendar sync: went with multiple `.ics` feed recipients (read-only, link-based) as the simple first cut, plus owner-only direct Google Calendar OAuth push (see Build Order step 6). Push for *each* recipient's own Google account (not just the owner's) is the one piece still open, if that turns out to matter.

## Build Order (suggested)
1. Syllabus upload + AI extraction → structured course record (deadlines *and* the lecture schedule) — **done**
2. Database schema + basic CRUD UI for assignments/quizzes/projects — **done**
3. Calendar: ship the `.ics` feed first (works everywhere, no auth needed) — **done**
4. Notion-style views (timeline, kanban) on top of the same data — **done**
5. Lecture pages: slide upload + syllabus-topic cross-reference → generated pre-review content, linked from the lecture's calendar event — **done**
6. Multi-recipient calendar sync, direct Google Calendar API push (if instant sync becomes a priority) — **multi-recipient `.ics` done; owner-only direct Google push done** (per-recipient Google OAuth is the remaining v2 slice, scoped out for now)
