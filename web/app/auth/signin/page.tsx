"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProviders, signIn, useSession, type ClientSafeProvider } from "next-auth/react";

export default function SignInPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const [email, setEmail] = useState("");
  const [devEmail, setDevEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">AI Syllabus Assistant</p>
      </div>

      {providers?.google && (
        <button
          onClick={() => signIn("google")}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
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
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
    </div>
  );
}
