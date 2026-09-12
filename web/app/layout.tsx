import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Syllabus Assistant",
  description: "Courses, deadlines, and lectures extracted from your syllabuses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>
          <TopBar />
          <main className="container">{children}</main>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
