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
      <div className="brand-nav">
        <Link href="/" className="brand">
          AI Syllabus Assistant
        </Link>
        <nav className="nav-links">
          <Link href="/">Courses</Link>
          <Link href="/timeline">Timeline</Link>
          <Link href="/board">Board</Link>
          <Link href="/todos">To Do</Link>
          <Link href="/extracurriculars">Extracurriculars</Link>
        </nav>
      </div>
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
