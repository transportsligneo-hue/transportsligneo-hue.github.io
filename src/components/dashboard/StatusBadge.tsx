import { type ReactNode } from "react";

type StatusKind = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

const styles: Record<StatusKind, string> = {
  neutral: "bg-cream/10 text-cream/70 border-cream/20",
  info: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  success: "bg-green-500/15 text-green-300 border-green-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  gold: "bg-primary/15 text-primary border-primary/30",
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
      className={`inline-flex items-center gap-1 rounded border font-medium uppercase tracking-wider ${styles[kind]} ${sizeClass} ${className}`}
    >
      {children}
    </span>
  );
}

/** Mapping pratique pour les statuts métier */
export function missionStatusKind(statut: string): StatusKind {
  switch (statut) {
    case "en_attente": return "neutral";
    case "confirmee": return "info";
    case "en_cours": return "gold";
    case "livree":
    case "terminee": return "success";
    case "annulee":
    case "refuse": return "danger";
    default: return "neutral";
  }
}

export function missionStatusLabel(statut: string): string {
  return {
    en_attente: "En attente",
    confirmee: "Confirmée",
    en_cours: "En cours",
    livree: "Livrée",
    terminee: "Terminée",
    annulee: "Annulée",
    refuse: "Refusée",
  }[statut] ?? statut;
}
