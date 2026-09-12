"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function TopBar() {
  const { data: session, status } = useSession();

  return (
    <header className="topbar">
      <div className="brand-nav">
        <Link href="/" className="brand">
          AI Syllabus Assistant
        </Link>
        <nav className="nav-links">
          <Link href="/">Courses</Link>
          <Link href="/calendar">Calendar</Link>
          <Link href="/timeline">Timeline</Link>
          <Link href="/board">Board</Link>
          <Link href="/todos">To Do</Link>
          <Link href="/extracurriculars">Extracurriculars</Link>
          <Link href="/upload">Upload syllabus</Link>
        </nav>
      </div>
      <div className="user-form">
        {status === "authenticated" && session.user?.email && (
          <>
            <span className="current-user">signed in as {session.user.email}</span>
            <button className="secondary" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </button>
          </>
        )}
        {status === "unauthenticated" && (
          <Link href="/auth/signin">
            <button type="button">Sign in</button>
          </Link>
        )}
      </div>
    </header>
  );
}
