export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "studdy-theme";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

// Applies the preference to the document and persists it. Called both from
// the Settings page (live updates) and the bootstrap script below (initial
// load) — kept as one function so the two can never drift.
export function applyThemePreference(preference: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
}

// Inlined into a <script> tag as the first child of <body> (see
// app/layout.tsx) so it runs — and sets data-theme — before the browser's
// first paint. Without this, the page would flash the light theme and then
// snap to dark a moment later for anyone who has dark mode selected. Kept as
// a plain string (not importing this module's own functions) because it has
// to be self-contained: it runs before any application JS bundle loads.
export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var resolved = pref === "dark" || pref === "light"
      ? pref
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {}
})();
`;
