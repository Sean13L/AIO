"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";

export function TopBar() {
  const { email, setEmail, ready } = useCurrentUser();
  const [draft, setDraft] = useState(email);

  useEffect(() => {
    if (ready) setDraft(email);
  }, [ready, email]);

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        AI Syllabus Assistant
      </Link>
      {ready && (
        <form
          className="user-form"
          onSubmit={(e) => {
            e.preventDefault();
            setEmail(draft.trim());
          }}
        >
          <input
            type="email"
            placeholder="you@example.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit">Use this account</button>
          {email && <span className="current-user">signed in as {email}</span>}
        </form>
      )}
    </header>
  );
}
