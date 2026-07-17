import { useState } from "react";

interface OrgLogoProps {
  /** Nom de l'organisation (raison sociale / nom commercial). Utilisé pour les initiales. */
  name?: string | null;
  /** URL publique du logo. */
  url?: string | null;
  /** Taille en pixels (largeur = hauteur). Défaut 48. */
  size?: number;
  /** Coins arrondis Tailwind. Défaut `rounded-xl`. */
  rounded?: string;
  className?: string;
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  return letters || "?";
}

/**
 * Affichage cohérent d'un logo d'organisation.
 * - Si `url` présent : image `object-contain` sur fond blanc + fine bordure.
 * - Sinon : dégradé v3 bleu → violet avec les initiales en typo display.
 * - Si l'image casse : fallback automatique sur les initiales.
 */
export function OrgLogo({ name, url, size = 48, rounded = "rounded-xl", className = "" }: OrgLogoProps) {
  const [broken, setBroken] = useState(false);
  const dim = { width: size, height: size };
  const showImage = !!url && !broken;

  if (showImage) {
    return (
      <div
        style={dim}
        className={`shrink-0 ${rounded} overflow-hidden bg-white border border-v3-border flex items-center justify-center ${className}`}
      >
        <img
          src={url!}
          alt={name ? `Logo ${name}` : "Logo"}
          className="w-full h-full object-contain p-1"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  const fontSize = Math.max(11, Math.round(size * 0.36));
  return (
    <div
      style={dim}
      className={`shrink-0 ${rounded} flex items-center justify-center text-white font-v3-display font-semibold tracking-wide ${className}`}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, var(--v3-blue) 0%, var(--v3-blue-deep) 55%, var(--v3-violet) 100%)",
          borderRadius: "inherit",
          fontSize,
          letterSpacing: "0.04em",
        }}
      >
        {initialsOf(name)}
      </div>
    </div>
  );
}
