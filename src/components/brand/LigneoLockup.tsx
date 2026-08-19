import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

interface Props {
  /** Taille du lockup */
  size?: "sm" | "md" | "lg";
  /** Tag affiché sous le wordmark (ex: DRIVER). Null = aucun */
  tag?: string | null;
  className?: string;
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
export default function LigneoLockup({ size = "md", tag = null, className = "" }: Props) {
  const s = SIZES[size];
  const neonGreen = "#6effcd";
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <span
        className="shrink-0 flex items-center justify-center rounded-full border border-[#6effcd] overflow-hidden"
        style={{
          width: s.badge,
          height: s.badge,
          background: "#0b1026",
          boxShadow: "0 0 14px rgba(110,255,205,0.55), 0 0 28px rgba(110,255,205,0.25), inset 0 0 10px rgba(110,255,205,0.12)",
        }}
      >
        <img
          src={logoLigneo}
          alt="Transports Ligneo"
          width={s.badge}
          height={s.badge}
          className="h-full w-full object-contain p-[2px]"
          style={{ filter: "drop-shadow(0 0 4px rgba(110,255,205,0.7))" }}
        />
      </span>
      <span className="min-w-0 flex flex-col leading-none">
        <span
          className="font-heading font-extrabold tracking-[0.01em] whitespace-nowrap"
          style={{ fontFamily: "'Poppins','SF Pro Rounded','Segoe UI Rounded','Nunito',system-ui,sans-serif", fontSize: s.word }}
        >
          <span className="text-white">TRANSPORTS</span>{" "}
          <span className="text-[#6effcd]" style={{ textShadow: "0 0 10px rgba(110,255,205,0.65), 0 0 20px rgba(110,255,205,0.35)" }}>LIGNEO</span>
        </span>
        {tag && (
          <span
            className="font-bold uppercase tracking-[0.12em] text-[#6effcd] mt-[2px]"
            style={{ fontSize: s.tag, textShadow: "0 0 8px rgba(110,255,205,0.6)" }}
          >
            {tag}
          </span>
        )}
      </span>
    </div>
  );
}
