import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

interface Props {
  /** Texte affiché sous le logo (ex : "Calcul du tarif…") */
  label?: string;
  /** Plein écran (overlay) ou inline */
  fullScreen?: boolean;
  /** Taille du logo en px */
  size?: number;
  className?: string;
}

/**
 * Chargeur animé avec le logo Ligneo · animations 100% CSS (pas de framer-motion).
 * Anneau doré rotatif + logo en pulsation douce.
 */
export function LogoLoader({ label, fullScreen = false, size = 64, className = "" }: Props) {
  const inner = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative" style={{ width: size + 24, height: size + 24 }}>
        <div
          className="absolute inset-0 rounded-full border-2 border-primary/15 border-t-primary animate-spin"
          style={{ animationDuration: "1.4s" }}
        />
        <div
          className="absolute inset-[5px] rounded-full border border-primary/10 border-b-primary/60 animate-spin"
          style={{ animationDuration: "2.2s", animationDirection: "reverse" }}
        />
        <div className="absolute inset-[12px] rounded-full bg-[#0b1026] flex items-center justify-center overflow-hidden animate-pulse" style={{ animationDuration: "2s" }}>
          <img src={logoLigneo} alt="Transports Ligneo" className="w-full h-full object-contain p-1" />
        </div>
      </div>
      {label && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80 font-heading animate-pulse" style={{ animationDuration: "2s" }}>
          {label}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0b1026]/95 backdrop-blur-sm flex items-center justify-center">
        {inner}
      </div>
    );
  }
  return inner;
}
