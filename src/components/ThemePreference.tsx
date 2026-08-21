import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type LigneoThemePreference } from "@/hooks/useTheme";

const OPTIONS: ReadonlyArray<{ value: LigneoThemePreference; label: string; shortLabel: string; Icon: typeof Sun }> = [
  { value: "light", label: "Clair", shortLabel: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", shortLabel: "Sombre", Icon: Moon },
  { value: "system", label: "Auto", shortLabel: "Auto", Icon: Monitor },
];

interface Props {
  className?: string;
  /** compact = intégration navbar (sans label, plus petit), full = footer/sidebar */
  variant?: "compact" | "full";
}

/**
 * Choix du thème par défaut du site (mémorisé sur l'appareil du visiteur).
 */
export default function ThemePreference({ className = "", variant = "full" }: Props) {
  const { preference, setPreference } = useTheme();
  const isCompact = variant === "compact";

  return (
    <div className={`theme-pref ${isCompact ? "theme-pref--compact" : ""} ${className}`} role="group" aria-label="Thème du site">
      {!isCompact && <span className="theme-pref-label">Thème du site</span>}
      <div className="theme-pref-group">
        {OPTIONS.map(({ value, label, shortLabel, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            aria-pressed={preference === value}
            className={`theme-pref-btn${preference === value ? " is-active" : ""}`}
            title={label}
          >
            <Icon size={isCompact ? 12 : 13} strokeWidth={2.2} />
            <span className="theme-pref-btn-text">{isCompact ? shortLabel : label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
