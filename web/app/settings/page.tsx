"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useAuthGate } from "@/lib/useAuthGate";
import {
  applyThemePreference,
  getStoredThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function SettingsPage() {
  const { email, ready } = useAuthGate();
  // Starts "system" (the bootstrap script's own default) so the segmented
  // control's server-rendered markup matches the client's first render —
  // the real stored value is read in an effect, after mount.
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    setTheme(getStoredThemePreference());
  }, []);

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    applyThemePreference(next);
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
    </div>
  );
}
