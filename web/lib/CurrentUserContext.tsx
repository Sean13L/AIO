"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "syllabus-assistant-email";

interface CurrentUserContextValue {
  email: string;
  setEmail: (email: string) => void;
  ready: boolean;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

// No auth system yet — see CLAUDE.md User Model / resolveUser.ts on the API
// side. The app identifies "you" by an email you type in once, remembered
// in this browser via localStorage.
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [email, setEmailState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setEmailState(localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      // localStorage unavailable — fall back to session-only state.
    }
    setReady(true);
  }, []);

  function setEmail(value: string) {
    setEmailState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }

  return (
    <CurrentUserContext.Provider value={{ email, setEmail, ready }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }
  return ctx;
}
