import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Studently",
};

export default function PrivacyPage() {
  return (
    <div>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 2026-09-15</p>

      <p>
        Studently (AI Syllabus Assistant) is a personal tool for extracting and organizing course
        syllabus information. This page explains what data it collects, why, and how it&apos;s
        handled.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address, and if you sign in with Google, your name
          and profile photo.
        </li>
        <li>
          <strong>Course data you provide:</strong> uploaded syllabus files, the course,
          deadline, and lecture information extracted from them, manually added items, to-dos,
          and extracurriculars.
        </li>
        <li>
          <strong>Uploaded files:</strong> syllabus files and lecture slides you upload.
        </li>
        <li>
          <strong>Google Calendar (optional):</strong> if you connect your Google Calendar, we
          store an access/refresh token so we can push your own course deadlines and lectures to
          it as calendar events. We only request the <code>calendar.events</code> scope — no
          access to anything else in your Google account.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To extract structured data from your syllabus using the Claude API.</li>
        <li>
          To display your courses, deadlines, and lectures, and to generate lecture pre-review
          content.
        </li>
        <li>
          To serve your personal calendar feed, and, if you&apos;ve connected it, push events to
          your Google Calendar.
        </li>
        <li>To send magic-link sign-in emails.</li>
      </ul>

      <h2>Third-party services</h2>
      <p>
        Your data passes through the following services to make the app work. See each one&apos;s
        own privacy policy for how they handle it:
      </p>
      <ul>
        <li>Neon — database hosting</li>
        <li>Vercel — app hosting and file storage</li>
        <li>Anthropic (Claude API) — syllabus text extraction and lecture preview generation</li>
        <li>Google — sign-in, and Calendar API if you connect your calendar</li>
        <li>Resend — magic-link email delivery</li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <p>
        No ads, no analytics or tracking beyond what&apos;s needed to run the app, and we don&apos;t
        sell or share your data with third parties for their own purposes.
      </p>

      <h2>Data retention &amp; deletion</h2>
      <p>
        Your data stays tied to your account until you remove it: delete a course to remove its
        data, or disconnect Google Calendar to revoke that access at any time. To delete your
        account entirely, contact us at the email below.
      </p>

      <h2>Single-user model</h2>
      <p>
        Each account&apos;s courses, deadlines, and files are private to that account. The only
        sharing feature is an optional, read-only calendar subscription link that you choose to
        share with others.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:sean.le3131@gmail.com">sean.le3131@gmail.com</a>.
      </p>
    </div>
  );
}
