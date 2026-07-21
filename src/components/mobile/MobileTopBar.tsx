import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";
import mobileHeaderBanner from "@/assets/mobile-header-ligneo.jpg.asset.json";

interface Props {
  title?: string;
  /** Action affichée à droite (ex: bouton, icône) superposée sur la bannière */
  right?: ReactNode;
  /** Conservé pour compat — non utilisé (la bannière remplace le logo texte) */
  showLogo?: boolean;
  /** Variant transparent (au-dessus d'un hero) ou solide */
  transparent?: boolean;
}

/**
 * Header mobile premium : bannière navy Transports Ligneo (logo + wordmark)
 * en pleine largeur, sticky en haut. Utilisé partout sur mobile.
 */
export default function MobileTopBar({ title, right, transparent = false }: Props) {
  return (
    <header
      className={`md:hidden sticky top-0 z-40 safe-top ${
        transparent ? "bg-transparent" : "bg-[#0b1026]"
      }`}
    >
      <div className="relative">
        <Link to="/" aria-label="Transports Ligneo — Accueil" className="block tap-scale">
          <img
            src={mobileHeaderBanner.url}
            alt="Transports Ligneo"
            className="w-full h-14 object-cover object-left"
            loading="eager"
            decoding="async"
          />
        </Link>
        {(right || title) && (
          <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
            {title && (
              <span className="font-heading text-cream/85 text-[11px] tracking-[0.18em] uppercase truncate max-w-[40vw]">
                {title}
              </span>
            )}
            {right}
          </div>
        )}
      </div>
    </header>
  );
}
