import { type ReactNode } from "react";

type StatusKind =
  | "neutral"
  | "info"
  | "electric"
  | "success"
  | "warning"
  | "danger"
  | "gold"
  | "violet";

/**
 * Palette opérationnelle (suivi missions / véhicules) :
 * fond saturé + texte blanc pour lisibilité immédiate, identifiable d'un coup d'œil.
 * Conserve un fallback navy/doré pour les contextes premium hors métier.
 */
const styles: Record<StatusKind, string> = {
  neutral: "bg-slate-500/90 text-white border-slate-400/40",
  info: "bg-[#00AEEF] text-white border-[#00AEEF]",
  electric: "bg-[#00AEEF] text-white border-[#00AEEF]",
  success: "bg-[#22C55E] text-white border-[#22C55E]",
  warning: "bg-[#F59E0B] text-white border-[#F59E0B]",
  danger: "bg-[#EF4444] text-white border-[#EF4444]",
  violet: "bg-[#8B5CF6] text-white border-[#8B5CF6]",
  gold: "bg-primary text-navy border-primary",
};

interface Props {
  kind?: StatusKind;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ kind = "neutral", children, size = "sm", className = "" }: Props) {
  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-semibold uppercase tracking-wider shadow-sm ${styles[kind]} ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
}

/** Mapping métier — couleurs opérationnelles requises */
export function missionStatusKind(statut: string): StatusKind {
  switch (statut) {
    case "en_attente": return "warning";            // Orange
    case "confirmee":
    case "planifiee":
    case "attribuee":
    case "propose":
    case "accepte":
    case "acceptee": return "electric";              // Bleu électrique
    case "en_cours": return "violet";                // Violet
    case "en_attente_validation": return "info";    // Bleu (livré, en attente validation)
    case "livree":
    case "validee":
    case "termine":
    case "terminee": return "success";               // Vert
    case "annulee":
    case "annule":
    case "refuse":
    case "refusee": return "danger";                 // Rouge
    case "urgente": return "danger";
    default: return "neutral";
  }
}

export function missionStatusLabel(statut: string): string {
  return {
    en_attente: "En attente",
    confirmee: "Planifiée",
    planifiee: "Planifiée",
    attribuee: "Planifiée",
    propose: "Convoyeur attribué",
    accepte: "Mission acceptée",
    acceptee: "Mission acceptée",
    en_cours: "En cours",
    en_attente_validation: "Livré — validation en cours",
    livree: "Livrée",
    validee: "Validée",
    termine: "Terminée",
    terminee: "Terminée",
    annulee: "Annulée",
    annule: "Annulée",
    refuse: "Refusée",
    refusee: "Refusée",
    urgente: "Urgente",
  }[statut] ?? statut.replace(/_/g, " ");
}

/** Mapping véhicule (Disponible / En mission / Maintenance / Hors service) */
export function vehiculeStatusKind(statut: string): StatusKind {
  switch (statut) {
    case "disponible":
    case "actif": return "success";
    case "en_mission":
    case "en_cours": return "violet";
    case "maintenance":
    case "en_attente": return "warning";
    case "hors_service":
    case "indisponible":
    case "suspendu": return "danger";
    default: return "neutral";
  }
}

export function vehiculeStatusLabel(statut: string): string {
  return {
    disponible: "Disponible",
    actif: "Disponible",
    en_mission: "En mission",
    en_cours: "En mission",
    maintenance: "Maintenance",
    en_attente: "Maintenance",
    hors_service: "Hors service",
    indisponible: "Hors service",
    suspendu: "Hors service",
  }[statut] ?? statut;
}
