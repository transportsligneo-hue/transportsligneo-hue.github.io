import { type ReactNode } from "react";

import { LgBadge } from "@/components/ui/LgBadge";

type StatusKind =
  | "neutral" | "info" | "electric" | "success" | "warning" | "danger" | "gold" | "violet"
  | "pending" | "proposed" | "accepted" | "running" | "review" | "validated" | "done" | "cancelled" | "refused";

/** Une couleur par statut (aucun doublon entre statuts de mission). */
const COLORS: Record<StatusKind, string> = {
  neutral: "#64748B",
  info: "#00AEEF",
  electric: "#2F5FFF",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  gold: "#D4A017",
  violet: "#8B5CF6",
  pending: "#F59E0B",
  proposed: "#00AEEF",
  accepted: "#2F5FFF",
  running: "#8B5CF6",
  review: "#EC4899",
  validated: "#0EA5A4",
  done: "#22C55E",
  cancelled: "#EF4444",
  refused: "#64748B",
};

interface Props {
  kind?: StatusKind;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ kind = "neutral", children, size = "sm", className = "" }: Props) {
  return (
    <LgBadge color={COLORS[kind]} size={size} className={className}>
      {children}
    </LgBadge>
  );
}

/** Mapping métier · couleurs opérationnelles requises */
export function missionStatusKind(statut: string): StatusKind {
  switch (statut) {
    case "en_attente": return "pending";             // Orange
    case "propose": return "proposed";               // Cyan
    case "confirmee":
    case "planifiee":
    case "attribuee":
    case "accepte":
    case "acceptee": return "accepted";              // Bleu électrique
    case "en_cours": return "running";               // Violet
    case "en_attente_validation": return "review";   // Rose
    case "validee": return "validated";              // Turquoise
    case "livree":
    case "termine":
    case "terminee": return "done";                  // Vert
    case "annulee":
    case "annule": return "cancelled";               // Rouge
    case "refuse":
    case "refusee": return "refused";                // Gris
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
    propose: "Proposée",
    accepte: "Acceptée",
    acceptee: "Acceptée",
    en_cours: "En cours",
    en_attente_validation: "En attente de validation",
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
