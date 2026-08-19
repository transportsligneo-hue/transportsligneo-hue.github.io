import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

interface Props {
  /** Taille du lockup */
  size?: "sm" | "md" | "lg";
  /** Tag affiché sous le wordmark (ex: DRIVER). Null = aucun */
  tag?: string | null;
  className?: string;
  /** Variante de couleur. Par défaut bleu néon électrique (site). */
  variant?: "blue" | "green";
}

const SIZES = {
  sm: { badge: 30, icon: 17, word: 12.5, tag: 8 },
  md: { badge: 34, icon: 19, word: 14.5, tag: 9 },
  lg: { badge: 48, icon: 27, word: 20, tag: 11 },
} as const;

/**
 * Lockup officiel "TRANSPORTS LIGNEO" :
 * badge véhicule doré + wordmark (TRANSPORTS blanc · LIGNEO bleu électrique)
 * + tag optionnel doré. Remplace l'icône seule partout (app driver, site, splash, login).
 */
export default function LigneoLockup({ size = "md", tag = null, className = "", variant }: Props) {
  const s = SIZES[size];
  const isApp = useIsMobileAppShell();
  // Dans la coquille Capacitor (driver), le lockup passe en vert néon par défaut.
  const isGreen = (variant ?? (isApp ? "green" : "blue")) === "green";
  const accent = isGreen ? "#6effcd" : "#4f8cff";
  const accentSoft = isGreen ? "rgba(78,255,178,0.3)" : "rgba(79,140,255,0.3)";
  const accentGlow = isGreen ? "rgba(110,255,205,0.15)" : "rgba(79,140,255,0.15)";
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <span
        className="shrink-0 flex items-center justify-center rounded-full overflow-hidden"
        style={{
          width: s.badge,
          height: s.badge,
          background: "#0b1026",
          border: `1px solid ${accent}`,
          boxShadow: `0 0 14px ${accent}, 0 0 28px ${accentSoft}, inset 0 0 10px ${accentGlow}`,
        }}
      >
        <img
          src={logoLigneo}
          alt="Transports Ligneo"
          width={s.badge}
          height={s.badge}
          className="h-full w-full object-contain p-[2px]"
          style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
        />
      </span>
      <span className="min-w-0 flex flex-col leading-none">
        <span
          className="font-heading font-extrabold tracking-[0.01em] whitespace-nowrap"
          style={{ fontFamily: "'Poppins','SF Pro Rounded','Segoe UI Rounded','Nunito',system-ui,sans-serif", fontSize: s.word }}
        >
          <span className="text-white">TRANSPORTS</span>{" "}
          <span className={isGreen ? "text-[#6effcd]" : "text-[#4f8cff]"} style={{ textShadow: `0 0 10px ${accent}, 0 0 22px ${accentSoft}` }}>LIGNEO</span>
        </span>

        {tag && (
          <span
            className="font-bold uppercase tracking-[0.12em] mt-[2px]"
            style={{ fontSize: s.tag, color: accent, textShadow: `0 0 8px ${accent}` }}

          >
            {tag}
          </span>
        )}
      </span>
    </div>
  );
}

