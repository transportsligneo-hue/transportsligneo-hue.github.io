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
  actions,
  stats,
}: Props) {
  return (
    <header className="adm-hero relative mb-5 overflow-hidden rounded-[22px] px-5 py-6 sm:px-[30px] sm:py-7">
      <span aria-hidden className="adm-hero-ghost">{breadcrumb}</span>
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="adm-hero-icon">
            <LayoutGrid size={28} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="adm-hero-crumb">
              <span>Ligneo</span>
              <span className="opacity-60">›</span>
              <span>{eyebrow}</span>
            </div>
            <h1 className="adm-hero-title">
              {title}
              {highlight ? <> <span className="adm-hero-hl">{highlight}</span></> : null}
              {badge ? <span className="fleet-header-badge">{badge}</span> : null}
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
                style={{ color: s.tone === "warn" ? "#ffd27a" : s.tone === "accent" ? "#37e6ff" : "#fff" }}
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
