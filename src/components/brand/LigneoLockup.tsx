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
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <span
        className="shrink-0 flex items-center justify-center rounded-full border border-[#d9b54a] shadow-[0_0_12px_rgba(217,181,74,0.35)]"
        style={{
          width: s.badge,
          height: s.badge,
          background: "radial-gradient(circle at 30% 20%, #4f8cff, #132a6b 70%)",
        }}
        aria-hidden="true"
      >
        <svg width={s.icon} height={s.icon} viewBox="0 0 24 24" fill="none" stroke="#d9b54a" strokeWidth="1.6">
          <path d="M3 13l2-5a2 2 0 012-1.4h10A2 2 0 0119 8l2 5v5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
          <circle cx="7.5" cy="16.5" r="1.3" fill="#d9b54a" />
          <circle cx="16.5" cy="16.5" r="1.3" fill="#d9b54a" />
        </svg>
      </span>
      <span className="min-w-0 flex flex-col leading-none">
        <span
          className="font-heading font-extrabold tracking-[0.01em] whitespace-nowrap"
          style={{ fontFamily: "'Poppins','SF Pro Rounded','Segoe UI Rounded','Nunito',system-ui,sans-serif", fontSize: s.word }}
        >
          <span className="text-white">TRANSPORTS</span>{" "}
          <span className="text-[#4f8cff]">LIGNEO</span>
        </span>
        {tag && (
          <span
            className="font-bold uppercase tracking-[0.12em] text-[#d9b54a] mt-[2px]"
            style={{ fontSize: s.tag }}
          >
            {tag}
          </span>
        )}
      </span>
    </div>
  );
}
