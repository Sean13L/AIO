import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Studently",
};

export default function TermsPage() {
  return (
    <div>
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: 2026-09-18</p>

      <p>
        These terms cover your use of Studently (AI Syllabus Assistant). By creating an account or
        using the app, you agree to them.
      </p>

      <h2>What the service is</h2>
      <p>
        Studently reads a course syllabus you upload or paste, extracts deadlines, grading, and
        lecture schedule information with the help of an AI model, and organizes it into a
        calendar and dashboard for you. It&apos;s a personal planning tool, not an official record
        of your course requirements.
      </p>

      <h2>AI-extracted content isn&apos;t guaranteed accurate</h2>
      <p>
        Extraction is done by an AI model and can misread, miss, or misinterpret information in a
        syllabus — dates, weights, and policies included. Always check extracted deadlines and
        grading details against your actual syllabus and instructor before relying on them,
        especially for anything with real consequences (a missed deadline, a misunderstood
        grading policy). We&apos;re not responsible for outcomes from relying solely on
        AI-extracted data without checking it against the source.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You&apos;re responsible for what you upload and for keeping access to your account.</li>
        <li>
          Don&apos;t upload content you don&apos;t have the right to upload, or use the service to
          store or generate anything unlawful, abusive, or that infringes someone else&apos;s
          rights.
        </li>
        <li>
          We may suspend or remove an account that abuses the service (e.g. attempting to bypass
          rate limits, uploading unsafe file content, or attacking the infrastructure).
        </li>
      </ul>

      <h2>No cost to use</h2>
      <p>
        Studently is currently free to use, with no paid plans, subscriptions, or in-app purchases
        — nothing to bill, refund, or cancel.
      </p>

      <h2>Service &quot;as is&quot;</h2>
      <p>
        The service is provided as-is, without warranty of any kind, and may change, break, or be
        discontinued at any time. We&apos;ll try to avoid surprises, but as a personal/small-scale
        project we can&apos;t guarantee uptime or long-term availability.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If these terms change materially, we&apos;ll update the date above. Continuing to use the
        service after a change means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:sean.le3131@gmail.com">sean.le3131@gmail.com</a>.
      </p>
    </div>
  );
}
