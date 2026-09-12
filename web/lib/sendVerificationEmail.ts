// Sends the magic-link email over plain HTTP (Resend's API) instead of via
// nodemailer/SMTP. Every nodemailer release compatible with next-auth v4's
// EmailProvider (the ^7.x line) still trips `npm audit` with unpatched
// high-severity advisories, so this sidesteps that dependency entirely.
//
// Falls back to logging the link to the server console when RESEND_API_KEY
// isn't set, so magic-link sign-in is fully testable locally with no email
// service configured — same "mock" pattern as extraction/mockExtractSyllabus.ts
// and preview/mockGeneratePreview.ts.
export async function sendVerificationRequest({
  identifier,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: { from?: string };
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = provider.from ?? process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  if (!apiKey) {
    console.warn(
      `[auth] RESEND_API_KEY is not set — logging the magic link instead of ` +
        `emailing it (dev-mode workaround).\nSign-in link for ${identifier}:\n${url}`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: identifier,
      subject: "Sign in to AI Syllabus Assistant",
      html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send verification email: ${res.status} ${body}`);
  }
}
