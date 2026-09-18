import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — Studently",
};

export default function CookiesPage() {
  return (
    <div>
      <h1>Cookie Policy</h1>
      <p className="muted">Last updated: 2026-09-18</p>

      <p>
        Studently sets only two cookies, both strictly necessary for the app to function — neither
        is used for tracking, analytics, or advertising, which is why no cookie consent banner is
        shown.
      </p>

      <h2>Cookies we set</h2>
      <ul>
        <li>
          <strong>Session cookie</strong> (<code>next-auth.session-token</code>, or{" "}
          <code>__Secure-next-auth.session-token</code> in production) — keeps you signed in. It&apos;s
          set when you sign in and cleared when you sign out. Stored httpOnly, so it can&apos;t be
          read by page scripts.
        </li>
        <li>
          <strong>Google Calendar connection cookie</strong> (
          <code>google_calendar_oauth_state</code>) — a short-lived, random value set only while
          you&apos;re in the middle of connecting your Google Calendar, used to verify the request
          that comes back from Google is genuinely yours. It expires within minutes and isn&apos;t
          set during normal use.
        </li>
      </ul>

      <h2>What we don&apos;t set</h2>
      <p>
        No advertising cookies, no analytics/tracking cookies, and no third-party cookies beyond
        what Google itself sets during the optional Calendar connection flow (governed by
        Google&apos;s own cookie policy, not ours).
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:sean.le3131@gmail.com">sean.le3131@gmail.com</a>.
      </p>
    </div>
  );
}
