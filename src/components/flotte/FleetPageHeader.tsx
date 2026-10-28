import type { ReactNode } from "react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

export type FleetHeaderStat = {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "warn";
};

type Props = {
  breadcrumb: string;
  /** Racine du fil d'Ariane (par défaut « Espace Flotte ») */
  space?: string;
  eyebrow: string;
  title: ReactNode;
  /** Mot-clé souligné en bleu */
  highlight?: string;
  subtitle?: ReactNode;
  badge?: string | null;
  /** Logo de l'organisation affiché à côté du titre (à la place du badge) */
  logoUrl?: string | null;
  logoAlt?: string;
  actions?: ReactNode;
  stats?: FleetHeaderStat[];
};

export default function FleetPageHeader({
  breadcrumb, space = "Espace Flotte", eyebrow, title, highlight, badge, logoUrl, logoAlt, actions, stats,
}: Props) {
  return (
    <AdminSectionHeader
      variant="violet"
      space={space}
      breadcrumb={breadcrumb}
      eyebrow={eyebrow}
      title={title}
      highlight={highlight}
      badge={badge}
      logoUrl={logoUrl}
      logoAlt={logoAlt}
      actions={actions}
      stats={stats}
    />
  );
}

export function FleetHeaderButton({
  variant = "solid",
  accent = "violet",
  children,
  onClick,
  type = "button",
}: {
  variant?: "solid" | "ghost";
  accent?: "violet" | "blue";
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        variant === "solid"
          ? `flex items-center gap-1.5 rounded-[9px] ${accent === "blue" ? "client-btn-blue" : "fleet-btn-violet"} px-4 py-2.5 text-[12.5px] font-semibold transition-colors`
          : "flex items-center gap-1.5 rounded-[9px] border border-white/25 bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
      }
    >
      {children}
    </button>
  );
}
