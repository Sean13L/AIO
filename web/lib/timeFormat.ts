"use client";

import { useEffect, useState } from "react";

export type TimeFormatPreference = "24h" | "12h";

const STORAGE_KEY = "studdy-time-format";
// Fired whenever the preference is saved, so any page already mounted in
// this tab (not just future page loads) picks up the change immediately —
// mirrors how the theme toggle applies live rather than needing a reload.
const CHANGE_EVENT = "studdy-time-format-change";

function isPreference(value: unknown): value is TimeFormatPreference {
  return value === "24h" || value === "12h";
}

// Defaults to "24h" — the app's behavior before this setting existed — so a
// visitor who never opens Settings sees no change.
export function getStoredTimeFormatPreference(): TimeFormatPreference {
  if (typeof window === "undefined") return "24h";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isPreference(stored) ? stored : "24h";
}

export function setStoredTimeFormatPreference(preference: TimeFormatPreference): void {
  window.localStorage.setItem(STORAGE_KEY, preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Starts at "24h" (matching the server-rendered/pre-hydration default) and
// syncs to the real stored value on mount, then stays in sync via the change
// event above (same tab) and the browser's own "storage" event (other tabs).
export function useTimeFormatPreference(): TimeFormatPreference {
  const [preference, setPreference] = useState<TimeFormatPreference>("24h");

  useEffect(() => {
    setPreference(getStoredTimeFormatPreference());
    const sync = () => setPreference(getStoredTimeFormatPreference());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return preference;
}
