"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "/", label: "Courses" },
  { href: "/calendar", label: "Calendar" },
  { href: "/timeline", label: "Timeline" },
  { href: "/board", label: "Board" },
  { href: "/todos", label: "To Do" },
  { href: "/extracurriculars", label: "Extracurriculars" },
  { href: "/upload", label: "Upload syllabus" },
];

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="brand-nav">
        <Link href="/" className="brand">
          AI Syllabus Assistant
        </Link>
        <nav className="nav-links">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
              {label}
            </Link>
          ))}
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
