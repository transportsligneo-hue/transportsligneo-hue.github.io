/**
 * Taxonomie des notifications admin.
 * Centralise libellés, icônes, tonalités et regroupement par famille
 * afin que le flux /admin/notifications reste lisible même avec
 * des types insérés côté base (triggers) hors whitelist RPC.
 */
import {
  AlertTriangle, Bell, CheckCircle2, CreditCard, FileText, Handshake,
  Inbox, MailOpen, Truck, UserPlus, Wallet, type LucideIcon,
} from "lucide-react";

export type NotifTone = "danger" | "warning" | "success" | "info" | "accent" | "neutral";

export interface NotifTypeMeta {
  label: string;
  icon: LucideIcon;
  tone: NotifTone;
  category: NotifCategoryKey;
}

export type NotifCategoryKey = "demandes" | "operations" | "comptes" | "finance" | "autre";

export const NOTIF_TYPES: Record<string, NotifTypeMeta> = {
  demande: { label: "Demande de convoyage", icon: Inbox, tone: "accent", category: "demandes" },
  estimation: { label: "Estimation", icon: FileText, tone: "info", category: "demandes" },
  devis: { label: "Devis", icon: FileText, tone: "info", category: "demandes" },
  message: { label: "Message de contact", icon: MailOpen, tone: "info", category: "demandes" },
  b2b: { label: "Demande professionnelle", icon: Handshake, tone: "accent", category: "demandes" },
  b2b_lead: { label: "Lead B2B", icon: Handshake, tone: "accent", category: "demandes" },

  incident: { label: "Incident", icon: AlertTriangle, tone: "danger", category: "operations" },
  mission_offre: { label: "Offre convoyeur", icon: Truck, tone: "warning", category: "operations" },
  mission_acceptee: { label: "Mission acceptée", icon: Truck, tone: "success", category: "operations" },
  mission_terminee: { label: "Mission terminée", icon: CheckCircle2, tone: "success", category: "operations" },

  client_action: { label: "Action client", icon: UserPlus, tone: "neutral", category: "comptes" },
  driver_action: { label: "Action convoyeur", icon: UserPlus, tone: "neutral", category: "comptes" },

  b2b_paiement: { label: "Paiement B2B", icon: CreditCard, tone: "success", category: "finance" },
  paiement: { label: "Paiement", icon: Wallet, tone: "success", category: "finance" },
  facture: { label: "Facture", icon: Wallet, tone: "info", category: "finance" },
};

export function notifMeta(type: string): NotifTypeMeta {
  return (
    NOTIF_TYPES[type] ?? {
      label: type.replace(/_/g, " "),
      icon: Bell,
      tone: "neutral" as NotifTone,
      category: "autre" as NotifCategoryKey,
    }
  );
}

export const NOTIF_CATEGORIES: { key: NotifCategoryKey; label: string; icon: LucideIcon }[] = [
  { key: "demandes", label: "Demandes & devis", icon: Inbox },
  { key: "operations", label: "Opérations", icon: Truck },
  { key: "comptes", label: "Comptes", icon: UserPlus },
  { key: "finance", label: "Finance", icon: Wallet },
  { key: "autre", label: "Autres", icon: Bell },
];

export const TONE_CLASSES: Record<NotifTone, { chip: string; dot: string }> = {
  danger: { chip: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  warning: { chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  success: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  info: { chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  accent: { chip: "bg-[#2F5FFF]/10 text-[#2F5FFF] border-[#2F5FFF]/25", dot: "bg-[#2F5FFF]" },
  neutral: { chip: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

/** Regroupe des dates ISO en libellés lisibles (Aujourd'hui / Hier / date longue). */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 7) return `Il y a ${diff} jours`;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
