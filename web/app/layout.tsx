import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Syllabus Assistant",
  description: "Courses, deadlines, and lectures extracted from your syllabuses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthSessionProvider>
          <TopBar />
          <main className="container">{children}</main>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
