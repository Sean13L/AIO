import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { TopBar } from "@/components/TopBar";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Bold display face for headings, nav, and buttons — the one typographic
// throughline tying every page to the redesign (homepage hero included),
// while body copy stays on Inter for readability at table/form density.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Studdy — AI Syllabus Assistant",
  description:
    "Upload a syllabus and Studdy turns it into a live calendar, deadline tracker, and lecture pre-review — organized automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakarta.variable}`}
      // The bootstrap script sets data-theme on the client before paint, which
      // will always differ from this server-rendered markup (no theme
      // attribute) — expected, not a real mismatch, so don't warn about it.
      suppressHydrationWarning
    >
      <body>
        {/* Runs before first paint so a saved dark-mode preference applies
            immediately instead of flashing light-then-dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <div className="top-accent-bar" aria-hidden="true" />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AuthSessionProvider>
          <TopBar />
          <main id="main-content" className="container">
            {children}
          </main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <span>© {new Date().getFullYear()} Studdy</span>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/cookies">Cookies</Link>
              <a href="mailto:sean.le3131@gmail.com">Contact</a>
            </div>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
