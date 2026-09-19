import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Studdy — AI Syllabus Assistant",
  description:
    "Upload a syllabus and Studdy turns it into a live calendar, deadline tracker, and lecture pre-review — organized automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
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
            <span>© {new Date().getFullYear()} Studdy</span>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookies">Cookies</Link>
            <a href="mailto:sean.le3131@gmail.com">Contact</a>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
