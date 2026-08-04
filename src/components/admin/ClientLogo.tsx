import ligneoMark from "@/assets/logo-transports-ligneo-officiel.png";

/** Nature du compte — pilote la couleur du logo Ligneo de repli. */
export type ClientLogoKind = "convoyeur" | "particulier" | "b2b" | "flotte" | "admin" | "auto";

interface ClientLogoProps {
  /** URL du logo société (organizations.logo_url) ou avatar profil (profiles.avatar_url). */
  src?: string | null;
  /** Raison sociale ou nom complet (accessibilité / infobulle). */
  name?: string | null;
  /** True si c'est une entreprise. */
  isCompany?: boolean;
  /** Type de compte : détermine la teinte du logo Ligneo affiché à défaut de logo propre. */
  kind?: ClientLogoKind;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: { box: "w-6 h-6", pad: "p-[3px]" },
  sm: { box: "w-8 h-8", pad: "p-1" },
  md: { box: "w-12 h-12", pad: "p-1.5" },
  lg: { box: "w-20 h-20", pad: "p-2.5" },
};

/** Palette par nature de compte (identité Ligneo : bleu = client, violet = flotte, vert = convoyeur, doré = admin). */
const KIND_TONES: Record<Exclude<ClientLogoKind, "auto">, string> = {
  convoyeur: "bg-emerald-50 border-emerald-300/70 ring-emerald-400/30",
  particulier: "bg-sky-50 border-sky-300/70 ring-sky-400/30",
  b2b: "bg-blue-50 border-blue-300/70 ring-blue-400/30",
  flotte: "bg-violet-50 border-violet-300/70 ring-violet-400/30",
  admin: "bg-amber-50 border-amber-300/70 ring-amber-400/30",
};

/**
 * Logo client réutilisable :
 * - s'il existe un logo société / une photo de profil → on l'affiche tel quel ;
 * - sinon → logo Transports Ligneo, teinté selon la nature du compte
 *   (convoyeur, particulier, B2B, flotte, admin) plutôt que des initiales.
 */
export function ClientLogo({
  src,
  name,
  isCompany,
  kind = "auto",
  size = "sm",
  className = "",
}: ClientLogoProps) {
  const s = SIZES[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Logo client"}
        loading="lazy"
        className={`${s.box} rounded object-contain bg-white border border-primary/15 shrink-0 ${className}`}
      />
    );
  }

  const resolved: Exclude<ClientLogoKind, "auto"> =
    kind !== "auto" ? kind : isCompany ? "b2b" : "particulier";
  const tone = KIND_TONES[resolved];

  return (
    <div
      className={`${s.box} ${s.pad} rounded border ring-1 flex items-center justify-center shrink-0 ${tone} ${className}`}
      aria-label={name || "Transports Ligneo"}
      title={name || undefined}
    >
      <img
        src={ligneoMark}
        alt=""
        loading="lazy"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
