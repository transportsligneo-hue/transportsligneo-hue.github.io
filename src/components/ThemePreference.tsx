import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type LigneoThemePreference } from "@/hooks/useTheme";

const OPTIONS: ReadonlyArray<{ value: LigneoThemePreference; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
  { value: "system", label: "Auto", Icon: Monitor },
];

/**
 * Choix du thème par défaut du site (mémorisé sur l'appareil du visiteur).
 */
export default function ThemePreference({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div className={`theme-pref ${className}`} role="group" aria-label="Thème du site">
      <span className="theme-pref-label">Thème du site</span>
      <div className="theme-pref-group">
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            aria-pressed={preference === value}
            className={`theme-pref-btn${preference === value ? " is-active" : ""}`}
          >
            <Icon size={13} strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
