import type { ReactNode } from "react";
import { LayoutGrid } from "lucide-react";

export type AdminHeaderStat = {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "warn";
};

type Props = {
  /** Nom de la section (fil d'ariane) */
  breadcrumb: string;
  eyebrow: string;
  title: ReactNode;
  /** Mot-clé souligné en bleu */
  highlight?: string;
  subtitle?: ReactNode;
  badge?: string | null;
  /** "violet" = espace flotte / pro ; "blue" = admin (défaut) */
  variant?: "blue" | "violet";
  /** Racine du fil d'ariane (défaut « Ligneo ») */
  space?: string;
  logoUrl?: string | null;
  logoAlt?: string;
  actions?: ReactNode;
  stats?: AdminHeaderStat[];
};

/**
 * Bandeau d'en-tête premium pour toutes les sections de l'espace Admin.
 * Même langage visuel que FleetPageHeader (Espace Flotte), accent bleu Ligneo.
 */
export default function AdminSectionHeader({
  breadcrumb,
  eyebrow,
  title,
  highlight,
  subtitle,
  badge,
  variant = "blue",
  space = "Ligneo",
  logoUrl,
  logoAlt,
  actions,
  stats,
}: Props) {
  return (
    <header className={`adm-hero ${variant === "violet" ? "adm-hero--violet" : ""} relative mb-5 overflow-hidden rounded-[22px] px-5 py-6 sm:px-[30px] sm:py-7`}>
      <span aria-hidden className="adm-hero-ghost">{breadcrumb}</span>
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="adm-hero-icon">
            <LayoutGrid size={28} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="adm-hero-crumb">
              <span>{space}</span>
              <span className="opacity-60">›</span>
              <span>{eyebrow}</span>
            </div>
            <h1 className="adm-hero-title">
              {title}
              {highlight ? <> <span className="adm-hero-hl">{highlight}</span></> : null}
              {logoUrl ? <img src={logoUrl} alt={logoAlt ?? "Logo"} className="ml-3 inline-block h-8 w-auto max-w-[120px] rounded-md bg-white/90 p-1 align-middle object-contain" loading="lazy" /> : badge ? <span className="fleet-header-badge">{badge}</span> : null}
            </h1>
          </div>
        </div>
        {actions ? (
          <div className="adm-hero-actions flex min-w-0 max-w-full shrink flex-wrap items-center gap-2.5 sm:flex-shrink-0">
            {actions}
          </div>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="relative z-[1] mt-5 flex flex-wrap gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="adm-hero-stat">
              <small>{s.label}</small>
              <b
                className="font-grotesk"
                style={{ color: s.tone === "warn" ? "#ffd27a" : s.tone === "accent" ? (variant === "violet" ? "#d4b8ff" : "#37e6ff") : "#fff" }}
              >
                {s.value}
              </b>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
