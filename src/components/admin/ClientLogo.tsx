import { Building2, User } from "lucide-react";

interface ClientLogoProps {
  /** URL du logo société (organizations.logo_url) ou avatar profil (profiles.avatar_url). */
  src?: string | null;
  /** Raison sociale ou nom complet, utilisé pour les initiales fallback. */
  name?: string | null;
  /** True si c'est une entreprise (icône Building au lieu de User). */
  isCompany?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: { box: "w-6 h-6", text: "text-[9px]", icon: 12 },
  sm: { box: "w-8 h-8", text: "text-[10px]", icon: 14 },
  md: { box: "w-12 h-12", text: "text-xs", icon: 18 },
  lg: { box: "w-20 h-20", text: "text-base", icon: 32 },
};

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/**
 * Logo client réutilisable : affiche le logo société/avatar s'il existe,
 * sinon un fallback élégant (initiales sur fond navy/doré).
 */
export function ClientLogo({ src, name, isCompany, size = "sm", className = "" }: ClientLogoProps) {
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
  return (
    <div
      className={`${s.box} rounded bg-navy/80 border border-primary/20 flex items-center justify-center text-primary font-heading ${s.text} shrink-0 ${className}`}
      aria-label={name || "Client"}
      title={name || undefined}
    >
      {name ? (
        initials(name)
      ) : isCompany ? (
        <Building2 size={s.icon} />
      ) : (
        <User size={s.icon} />
      )}
    </div>
  );
}
