"use client";

import { useSession } from "next-auth/react";

// Drop-in-ish replacement for the old CurrentUserContext's useCurrentUser():
// same {email, ready} shape so pages barely change, but email now comes
// from a real NextAuth session instead of a box typed into the top bar.
export function useAuthGate() {
  const { data: session, status } = useSession();
  return {
    ready: status !== "loading",
    email: session?.user?.email ?? null,
  };
}
