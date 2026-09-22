"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Logo } from "./Logo";

const NAV_LINKS = [
  { href: "/", label: "Courses" },
  { href: "/calendar", label: "Calendar" },
  { href: "/timeline", label: "Timeline" },
  { href: "/board", label: "Board" },
  { href: "/todos", label: "To Do" },
  { href: "/extracurriculars", label: "Extracurriculars" },
  { href: "/study-guides", label: "Study Guides" },
  { href: "/upload", label: "Upload syllabus" },
];

// Inline, not an external asset — same reasoning as Logo.tsx.
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.5c.04-.33.06-.66.06-1s-.02-.67-.06-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.4.96a7.5 7.5 0 0 0-1.73-1l-.36-2.55a.5.5 0 0 0-.5-.43h-3.84a.5.5 0 0 0-.5.43l-.36 2.55c-.63.24-1.22.58-1.73 1l-2.4-.96a.5.5 0 0 0-.6.22L2.63 9.28a.5.5 0 0 0 .12.64L4.78 11.5c-.04.33-.06.66-.06 1s.02.67.06 1l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.33.6.22l2.4-.96c.51.42 1.1.76 1.73 1l.36 2.55c.05.25.26.43.5.43h3.84c.24 0 .45-.18.5-.43l.36-2.55a7.5 7.5 0 0 0 1.73-1l2.4.96c.28.11.46.02.6-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="brand-nav">
        <Link href="/" className="brand">
          <Logo size={26} />
        </Link>
        {status === "authenticated" && (
          <nav className="nav-links">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="user-form">
        {status === "authenticated" && session.user?.email && (
          <Link
            href="/settings"
            className={`icon-button${pathname === "/settings" ? " active" : ""}`}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </Link>
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
