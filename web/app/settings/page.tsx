"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { AiUsageSummary } from "@/lib/types";
import {
  applyThemePreference,
  getStoredThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import {
  getStoredTimeFormatPreference,
  setStoredTimeFormatPreference,
  type TimeFormatPreference,
} from "@/lib/timeFormat";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const TIME_FORMAT_OPTIONS: { value: TimeFormatPreference; label: string }[] = [
  { value: "12h", label: "12-hour (2:30 PM)" },
  { value: "24h", label: "24-hour (14:30)" },
];

export default function SettingsPage() {
  const { email, ready } = useAuthGate();
  // Starts "system" (the bootstrap script's own default) so the segmented
  // control's server-rendered markup matches the client's first render —
  // the real stored value is read in an effect, after mount.
  const [theme, setTheme] = useState<ThemePreference>("system");
  // Same reasoning as theme above: starts at the app's pre-setting default
  // (24h) so the server-rendered markup matches the client's first render.
  const [timeFormat, setTimeFormat] = useState<TimeFormatPreference>("24h");
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);

  useEffect(() => {
    setTheme(getStoredThemePreference());
    setTimeFormat(getStoredTimeFormatPreference());
  }, []);

  // Only for the one-line summary on the AI usage card — if it fails, the
  // card falls back to a generic description rather than showing an error.
  useEffect(() => {
    if (!email) return;
    api.getAiUsage().then(setAiUsage).catch(() => {});
  }, [email]);

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    applyThemePreference(next);
  }

  function handleTimeFormatChange(next: TimeFormatPreference) {
    setTimeFormat(next);
    setStoredTimeFormatPreference(next);
  }

  if (!ready) return null;

  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to view settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Settings</h1>

      <div className="card">
        <h2>Account</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Signed in as <strong style={{ color: "var(--color-text)" }}>{email}</strong>
        </p>
        <button type="button" className="secondary" onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </button>
      </div>

      <div className="card">
        <h2>AI usage</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          {aiUsage
            ? `${aiUsage.today.used} of ${aiUsage.limit} AI requests used today${
                aiUsage.error_total > 0
                  ? ` · ${aiUsage.error_total} failed ${aiUsage.error_total === 1 ? "request" : "requests"} in the last 30 days`
                  : ""
              }.`
            : "Your daily AI allowance, recent usage, and any failed AI requests."}
        </p>
        <Link href="/settings/ai-usage">
          <button type="button" className="secondary">
            View AI usage
          </button>
        </Link>
      </div>

      <div className="card">
        <h2>Appearance</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Choose how Studdy looks on this device, or match your system setting.
        </p>
        <div className="theme-switcher" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={theme === option.value ? undefined : "secondary"}
              onClick={() => handleThemeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Time format</h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Applies to every deadline, lecture, and calendar time shown across the app.
        </p>
        <div className="theme-switcher" role="radiogroup" aria-label="Time format">
          {TIME_FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={timeFormat === option.value}
              className={timeFormat === option.value ? undefined : "secondary"}
              onClick={() => handleTimeFormatChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
