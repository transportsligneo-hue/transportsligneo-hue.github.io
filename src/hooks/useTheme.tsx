import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LigneoTheme = "dark" | "light";

const STORAGE_KEY = "ligneo-theme";

interface ThemeCtx {
  theme: LigneoTheme;
  setTheme: (t: LigneoTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  setTheme: () => {},
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR : on rend toujours le thème sombre (thème historique), puis on
  // réhydrate la préférence de l'appareil côté client.
  const [theme, setThemeState] = useState<LigneoTheme>("dark");

  useEffect(() => {
    let initial: LigneoTheme = "dark";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") initial = stored;
    } catch {
      /* storage indisponible */
    }
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: LigneoTheme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage indisponible */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
