import { Link } from "@tanstack/react-router";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { ReactNode } from "react";

interface Props {
  title?: string;
  /** Action affichée à droite (ex: bouton, icône) */
  right?: ReactNode;
  /** Affiche le logo Ligneo (par défaut) ou un titre texte */
  showLogo?: boolean;
  /** Variant transparent (au-dessus d'un hero) ou solide */
  transparent?: boolean;
}

/**
 * Header mobile compact, sticky, app-like.
 * Visible uniquement < md. Le desktop garde sa Navbar habituelle.
 */
export default function MobileTopBar({ title, right, showLogo = true, transparent = false }: Props) {
  return (
    <header
      className={`md:hidden sticky top-0 z-40 safe-top ${
        transparent ? "bg-transparent" : "glass-bar border-b border-primary/15"
      }`}
    >
      <div className="h-14 px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 tap-scale">
          {showLogo ? (
            <img src={logoLigneo} alt="Transports Ligneo" className="h-9 w-auto object-contain" loading="lazy" />
          ) : (
            <span className="font-heading text-primary text-sm tracking-[0.15em] uppercase">
              {title}
            </span>
          )}
        </Link>
        {title && showLogo && (
          <span className="font-heading text-cream/80 text-xs tracking-[0.15em] uppercase truncate px-2">
            {title}
          </span>
        )}
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
