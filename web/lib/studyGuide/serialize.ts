import type { Prisma } from "@prisma/client";

export const STUDY_GUIDE_DETAIL_INCLUDE = {
  sources: {
    include: {
      lectures: { include: { courses: { select: { course_code: true, course_name: true } } } },
    },
  },
} satisfies Prisma.study_guidesInclude;

export type StudyGuideWithSources = Prisma.study_guidesGetPayload<{
  include: typeof STUDY_GUIDE_DETAIL_INCLUDE;
}>;

// Shared by POST /api/study-guides and GET /api/study-guides/[id] — flattens
// the nested sources/lectures/courses include into the flat StudyGuideDetail
// shape the client expects.
export function serializeStudyGuide(guide: StudyGuideWithSources) {
  return {
    id: guide.id,
    title: guide.title,
    content: guide.content,
    used_mock: guide.used_mock,
    created_at: guide.created_at,
    sources: guide.sources.map((source) => ({
      lecture_id: source.lecture_id,
      course_id: source.lectures.course_id,
      course_code: source.lectures.courses.course_code,
      course_name: source.lectures.courses.course_name,
      week_number: source.lectures.week_number,
      scheduled_at: source.lectures.scheduled_at,
      included_topics: source.included_topics,
      included_slides: source.included_slides,
      included_transcript: source.included_transcript,
    })),
  };
}
