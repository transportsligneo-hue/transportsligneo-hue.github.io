/**
 * StatutConvoyeurBadge · badge unifié pour le statut convoyeur.
 * Couleurs et libellés cohérents partout dans la plateforme.
 *
 *  🟢 valide       · Profil validé
 *  🟡 en_attente   · Documents en attente
 *  🟠 a_corriger   · Documents à corriger (au moins un refusé)
 *  🔵 en_verif     · En cours de vérification
 *  🔴 refuse       · Profil refusé
 *  ⚫ suspendu     · Compte suspendu
 */
import * as React from "react";
import { CheckCircle2, Clock, AlertTriangle, Search, XCircle, Ban } from "lucide-react";

export type StatutConvoyeur = "valide" | "en_attente" | "a_corriger" | "en_verif" | "refuse" | "suspendu";

const CONFIG: Record<StatutConvoyeur, { label: string; dot: string; bg: string; text: string; ring: string; Icon: typeof CheckCircle2 }> = {
  valide:     { label: "Profil validé",           dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700",  ring: "ring-emerald-200",  Icon: CheckCircle2 },
  en_attente: { label: "Documents en attente",    dot: "bg-amber-400",   bg: "bg-amber-50",    text: "text-amber-700",    ring: "ring-amber-200",    Icon: Clock },
  a_corriger: { label: "Documents à corriger",    dot: "bg-orange-500",  bg: "bg-orange-50",   text: "text-orange-700",   ring: "ring-orange-200",   Icon: AlertTriangle },
  en_verif:   { label: "En cours de vérification",dot: "bg-blue-500",    bg: "bg-blue-50",     text: "text-blue-700",     ring: "ring-blue-200",     Icon: Search },
  refuse:     { label: "Profil refusé",           dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700",      ring: "ring-red-200",      Icon: XCircle },
  suspendu:   { label: "Compte suspendu",         dot: "bg-slate-700",   bg: "bg-slate-100",   text: "text-slate-700",    ring: "ring-slate-300",    Icon: Ban },
};

/**
 * Résout un statut convoyeur unifié depuis la ligne DB + ses documents.
 * - suspendu prime toujours ;
 * - refuse ensuite ;
 * - valide reste explicite ;
 * - sinon on regarde les documents pour distinguer a_corriger / en_verif / en_attente.
 */
export function resolveStatutConvoyeur(
  statutDb: string | null | undefined,
  docs?: Array<{ statut_validation?: string | null }>,
): StatutConvoyeur {
  const s = (statutDb ?? "").toLowerCase();
  if (s === "suspendu") return "suspendu";
  if (s === "refuse") return "refuse";
  if (s === "valide") return "valide";
  if (docs && docs.length > 0) {
    if (docs.some((d) => d.statut_validation === "refuse")) return "a_corriger";
    if (docs.some((d) => (d.statut_validation ?? "en_attente") === "en_attente")) return "en_verif";
  }
  return "en_attente";
}

interface Props {
  statut: StatutConvoyeur;
  size?: "sm" | "md";
  withIcon?: boolean;
  className?: string;
}

export function StatutConvoyeurBadge({ statut, size = "sm", withIcon = true, className = "" }: Props) {
  const cfg = CONFIG[statut] ?? CONFIG.en_attente;
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring} ${pad} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {withIcon && <Icon size={size === "md" ? 12 : 11} />}
      {cfg.label}
    </span>
  );
}

/** Badge court (juste le libellé + point) pour tableaux denses. */
export function StatutConvoyeurDot({ statut }: { statut: StatutConvoyeur }) {
  const cfg = CONFIG[statut] ?? CONFIG.en_attente;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}
