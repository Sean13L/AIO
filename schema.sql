-- AI Syllabus Assistant — initial Postgres schema
-- Companion to CLAUDE.md. Adjust types/naming to taste once an ORM is chosen (Prisma/SQLAlchemy/etc.)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TYPE item_type AS ENUM (
  'assignment', 'quiz', 'midterm', 'final_exam', 'project', 'peer_evaluation', 'other'
);

CREATE TYPE item_status AS ENUM ('not_started', 'in_progress', 'done');

CREATE TYPE item_source AS ENUM ('extracted', 'manual');

CREATE TYPE preview_status AS ENUM ('not_generated', 'generated', 'viewed');

CREATE TYPE sync_target_type AS ENUM ('ics_subscriber', 'google_oauth');

-- Users. Kept as a real table for auth/scoping even though each account's
-- data is single-user — see User Model in CLAUDE.md.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  semester TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_user ON courses(user_id);

-- Uploaded syllabus files, kept for traceability back to what was extracted
CREATE TABLE syllabi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  raw_extraction JSONB,             -- the structured JSON the LLM produced; useful for debugging/re-parsing
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consolidated deadlines/assignments/quizzes/exams table
-- (replaces the two-database split from the current Notion setup — see design note in CLAUDE.md)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type item_type NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  is_datetime BOOLEAN NOT NULL DEFAULT false, -- false = render as all-day event, true = render at due_at's actual time
  weight TEXT,                                -- e.g. "15%" — text, since some syllabi give ranges/bonus notes
  notes TEXT,
  status item_status NOT NULL DEFAULT 'not_started',
  source item_source NOT NULL DEFAULT 'extracted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_course ON items(course_id);
CREATE INDEX idx_items_due_at ON items(due_at);

-- Scheduled lectures, extracted from the syllabus's week-by-week schedule.
-- Always a real time slot (never all-day) — see Calendar section in CLAUDE.md.
CREATE TABLE lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  week_number INTEGER,
  topics TEXT,                      -- from the syllabus's week-by-week schedule
  slides_url TEXT,                  -- populated once the user uploads slides for this session
  preview_status preview_status NOT NULL DEFAULT 'not_generated',
  preview_content TEXT,             -- generated pre-lecture review (slides + syllabus topics cross-referenced)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lectures_course ON lectures(course_id);
CREATE INDEX idx_lectures_scheduled_at ON lectures(scheduled_at);

-- Lightweight, non-syllabus-linked running task list
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Freeform extracurriculars/side projects, outside the grading/deadline schema
CREATE TABLE extracurriculars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user subscribable calendar feed (the .ics endpoint)
CREATE TABLE calendar_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_token TEXT UNIQUE NOT NULL,  -- unguessable token used in the feed URL, e.g. /calendar/{feed_token}.ics
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additional sync destinations for a feed — supports optional multi-user calendar syncing
CREATE TABLE calendar_sync_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES calendar_feeds(id) ON DELETE CASCADE,
  target_type sync_target_type NOT NULL,
  label TEXT,                        -- e.g. "Mom's calendar", "Study group"
  google_oauth_token TEXT,           -- populated only when target_type = 'google_oauth'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
