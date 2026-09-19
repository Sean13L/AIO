"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn, useSession, type ClientSafeProvider } from "next-auth/react";
import { LogoMark } from "@/components/Logo";

// NextAuth redirects back here with ?error=<code> on a failed sign-in
// instead of throwing — without reading it, a failure (e.g. clicking
// "Continue with Google") just silently bounces back to this same page
// with zero indication anything went wrong, which reads as "the button is
// broken" rather than as an error.
const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method. Try the magic link below instead, or contact support to link your Google account.",
  OAuthSignin: "Couldn't start the Google sign-in flow. Try again.",
  OAuthCallback: "Google sign-in didn't complete. Try again.",
  OAuthCreateAccount: "Couldn't create an account from your Google sign-in. Try again.",
  AccessDenied: "Access was denied by Google.",
  Default: "Sign-in failed. Try again, or use a different sign-in method below.",
};

function SignInForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const [email, setEmail] = useState("");
  const [devEmail, setDevEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  const oauthErrorCode = searchParams.get("error");
  const oauthError = oauthErrorCode
    ? ERROR_MESSAGES[oauthErrorCode] ?? ERROR_MESSAGES.Default
    : null;

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await signIn("email", { email: email.trim(), redirect: false });
    setMagicLinkSent(true);
  }

  async function handleDevSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!devEmail.trim()) return;
    setDevError(null);
    const result = await signIn("dev-email", { email: devEmail.trim(), redirect: false });
    if (result?.ok) {
      router.replace("/");
    } else {
      setDevError(result?.error ?? "Sign-in failed");
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm mt-12 mb-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark size={40} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">Studdy — AI syllabus assistant</p>
        </div>
      </div>

      {oauthError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {oauthError}
        </p>
      )}

      {providers?.google && (
        <button
          onClick={() => signIn("google")}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]/40"
        >
          Continue with Google
        </button>
      )}

      {providers?.email && (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-2 border-t border-gray-200 pt-5">
          <label className="text-sm font-medium text-gray-700">Email magic link</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1E40AF] focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20"
          />
          <button
            type="submit"
            className="rounded-md bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E3A8A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E40AF]/40"
          >
            Send magic link
          </button>
          {magicLinkSent && (
            <p className="text-sm text-green-600">
              Check your email — or, if no email service is configured, the server console —
              for a sign-in link.
            </p>
          )}
        </form>
      )}

      {providers?.["dev-email"] && (
        <form onSubmit={handleDevSignIn} className="flex flex-col gap-2 border-t border-amber-200 pt-5">
          <label className="text-sm font-medium text-amber-800">
            Dev sign-in <span className="font-normal text-amber-600">(no email sent, local only)</span>
          </label>
          <input
            type="email"
            value={devEmail}
            onChange={(e) => setDevEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="rounded-md border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Continue (dev only)
          </button>
          {devError && <p className="text-sm text-red-600">{devError}</p>}
        </form>
      )}

      {providers === null && <p className="text-sm text-gray-500">Loading sign-in options…</p>}

      <p className="text-center text-xs text-gray-400">
        By continuing, you agree to our{" "}
        <a href="/terms" className="underline hover:text-gray-600">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-gray-600">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
