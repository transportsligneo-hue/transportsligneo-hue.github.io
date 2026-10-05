import { logoLigneoSeasonal as logoLigneo } from "@/lib/seasonal-logo";
import logoDriver from "@/assets/logo-driver.png.asset.json";
import { useIsMobileAppShell } from "@/components/mobile/MobileAppGate";

interface Props {
  /** Taille du lockup */
  size?: "sm" | "md" | "lg";
  /** Tag affiché sous le wordmark (ex: DRIVER). Null = aucun */
  tag?: string | null;
  className?: string;
  /** Variante de couleur. Par défaut bleu néon électrique (site). */
  variant?: "blue" | "green";
  /** Utilise le logo avec le bandeau DRIVER (espace convoyeur uniquement). */
  driverBadge?: boolean;
}

const SIZES = {
  sm: { badge: 30, icon: 17, word: 12.5, tag: 8 },
  md: { badge: 48, icon: 27, word: 17.5, tag: 10 },
  lg: { badge: 48, icon: 27, word: 20, tag: 11 },
} as const;

/**
 * Lockup officiel "TRANSPORTS LIGNEO" :
 * badge véhicule doré + wordmark (TRANSPORTS blanc · LIGNEO bleu électrique)
 * + tag optionnel doré. Remplace l'icône seule partout (app driver, site, splash, login).
 */
export default function LigneoLockup({ size = "md", tag = null, className = "", variant, driverBadge = false }: Props) {
  const s = SIZES[size];
  const isApp = useIsMobileAppShell();
  // Dans la coquille Capacitor (driver), le lockup passe en vert néon par défaut.
  const isGreen = (variant ?? (isApp ? "green" : "blue")) === "green";
  return (
    <div className={`ligneo-lockup ${isGreen ? "ligneo-lockup--green" : "ligneo-lockup--blue"} flex items-center gap-2.5 min-w-0 ${className}`}>
      <span
        className="ligneo-lockup-badge shrink-0 flex items-center justify-center rounded-full overflow-hidden"
        style={{
          width: s.badge,
          height: s.badge,
        }}
      >
        <img
          src={driverBadge ? logoDriver.url : logoLigneo()}
          alt="Transports Ligneo"
          width={s.badge}
          height={s.badge}
          className="ligneo-lockup-logo h-full w-full object-contain p-[2px]"
        />
      </span>
      <span className="min-w-0 flex flex-col leading-none">
        <span
          className="font-heading font-extrabold tracking-[0.01em] whitespace-nowrap"
          style={{ fontFamily: "'Poppins','SF Pro Rounded','Segoe UI Rounded','Nunito',system-ui,sans-serif", fontSize: s.word }}
        >
          <span className="ligneo-lockup-transport">TRANSPORTS</span>{" "}
          <span className="ligneo-lockup-accent">LIGNEO</span>
        </span>

        {tag && (
          <span
            className="ligneo-lockup-tag font-bold uppercase tracking-[0.12em] mt-[2px]"
            style={{ fontSize: s.tag }}

          >
            {tag}
          </span>
        )}
      </span>
    </div>
  );
}

