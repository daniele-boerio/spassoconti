// Applicazione del tema al DOM.
//
// La preferenza dell'utente ("system" inclusa) vive in localStorage; su <html>
// finisce sempre il tema *risolto*, così il CSS ha bisogno di due soli blocchi
// di token (`:root` e `[data-theme="dark"]`, in styles/_tokens.scss).

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Deve restare allineato a --bg nei due temi: è il colore della status bar.
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#f6f8f7",
  dark: "#0a1526",
};

const isPreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

export function readStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isPreference(stored) ? stored : "system";
}

export function persistTheme(preference: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;

  root.dataset.theme = theme;
  // Fa seguire il tema anche a scrollbar e controlli nativi.
  root.style.colorScheme = theme;

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Segue le variazioni del tema di sistema finché la preferenza è "system".
 * Ritorna la funzione di cleanup.
 */
export function watchSystemTheme(
  onChange: (theme: ResolvedTheme) => void,
): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) =>
    onChange(event.matches ? "dark" : "light");

  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}
