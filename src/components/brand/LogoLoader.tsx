import { logoLigneoSeasonal as logoLigneo } from "@/lib/seasonal-logo";

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
 * Logo qui respire + barre verte (aucun rond qui tourne).
 */
export function LogoLoader({ label, fullScreen = false, size = 64, className = "" }: Props) {
  const inner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="lb-mark" style={{ width: size + 24, height: size + 24 }}>
        <i className="lb-halo" />
        <img src={logoLigneo()} alt="Transports Ligneo" style={{ width: size, height: size }} />
      </div>
      <span className="lb-bar"><b /></span>
      {label && <p className="lb-label">{label}</p>}
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
