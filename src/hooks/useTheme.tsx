import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LigneoTheme = "dark" | "light";
/** Préférence choisie par le visiteur : clair, sombre, ou celle de son appareil. */
export type LigneoThemePreference = LigneoTheme | "system";

const STORAGE_KEY = "ligneo-theme";

interface ThemeCtx {
  /** Thème réellement appliqué. */
  theme: LigneoTheme;
  /** Préférence enregistrée (peut être "system"). */
  preference: LigneoThemePreference;
  setTheme: (t: LigneoTheme) => void;
  setPreference: (p: LigneoThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  preference: "system",
  setTheme: () => {},
  setPreference: () => {},
  toggleTheme: () => {},
});

function applyTheme(theme: LigneoTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.classList.toggle("theme-dark", theme === "dark");
  root.dataset["ligneoTheme"] = theme;
  root.style.colorScheme = theme;
}

function systemTheme(): LigneoTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR : on rend toujours le thème sombre (thème historique), puis on
  // réhydrate la préférence de l'appareil côté client.
  const [theme, setThemeState] = useState<LigneoTheme>("dark");
  const [preference, setPreferenceState] = useState<LigneoThemePreference>("system");

  useEffect(() => {
    let pref: LigneoThemePreference = "system";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") pref = stored;
    } catch {
      /* storage indisponible */
    }
    const resolved = pref === "system" ? systemTheme() : pref;
    setPreferenceState(pref);
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  // Suit les changements système tant que la préférence est "system".
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = mq.matches ? "light" : "dark";
      setThemeState(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: LigneoThemePreference) => {
    const resolved = next === "system" ? systemTheme() : next;
    setPreferenceState(next);
    setThemeState(resolved);
    applyTheme(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage indisponible */
    }
  }, []);

  const setTheme = useCallback((next: LigneoTheme) => setPreference(next), [setPreference]);

  const toggleTheme = useCallback(() => {
    setPreference(theme === "light" ? "dark" : "light");
  }, [theme, setPreference]);

  const value = useMemo(
    () => ({ theme, preference, setTheme, setPreference, toggleTheme }),
    [theme, preference, setTheme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
