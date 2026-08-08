import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  /** compact = icône seule (navbars), full = icône + libellé (sidebar) */
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Bascule thème sombre (par défaut) / thème clair bleu électrique.
 * Le choix est mémorisé sur l'appareil.
 */
export default function ThemeToggle({ variant = "compact", className = "" }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${variant === "full" ? "theme-toggle--full" : ""} ${className}`}
      aria-label={isLight ? "Activer le thème sombre" : "Activer le thème clair"}
      title={isLight ? "Thème sombre" : "Thème clair"}
    >
      {isLight ? <Moon size={15} strokeWidth={2.2} /> : <Sun size={15} strokeWidth={2.2} />}
      {variant === "full" && <span>{isLight ? "Thème sombre" : "Thème clair"}</span>}
    </button>
  );
}
