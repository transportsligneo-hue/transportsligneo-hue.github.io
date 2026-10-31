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
  attribution_refusee: { label: "Mission refusée par un convoyeur", icon: AlertTriangle, tone: "danger", category: "operations" },
  attribution_acceptee: { label: "Mission acceptée par un convoyeur", icon: CheckCircle2, tone: "success", category: "operations" },
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

/* ======================================================================
 * Familles de couleur : une couleur par grand sujet, lisible d'un coup d'œil.
 *   Demandes (bleu électrique) · Clients (bleu néon) · Convoyeurs (vert néon)
 *   Problèmes (rouge) · Messages (turquoise) · Finance (violet) · Missions (indigo)
 * ==================================================================== */
export type NotifFamille = "demande" | "client" | "convoyeur" | "probleme" | "message" | "finance" | "mission" | "systeme";

export const FAMILLES: { key: NotifFamille; label: string; c1: string; c2: string; soft: string; ink: string }[] = [
  { key: "demande", label: "Demandes & devis", c1: "#2f5fff", c2: "#5b83ff", soft: "#ebf0ff", ink: "#1f3fcc" },
  { key: "client", label: "Clients", c1: "#0ea5e9", c2: "#5de0ff", soft: "#e6f7fe", ink: "#0369a1" },
  { key: "convoyeur", label: "Convoyeurs", c1: "#10b981", c2: "#34d399", soft: "#e7f8f1", ink: "#047857" },
  { key: "probleme", label: "Problèmes", c1: "#ef4444", c2: "#ff6b6b", soft: "#fff0f0", ink: "#b91c1c" },
  { key: "message", label: "Messages", c1: "#14b8a6", c2: "#5eead4", soft: "#e6faf7", ink: "#0f766e" },
  { key: "finance", label: "Finance", c1: "#7c5cff", c2: "#a78bfa", soft: "#f1edff", ink: "#5b3fd6" },
  { key: "mission", label: "Missions", c1: "#4f46e5", c2: "#818cf8", soft: "#eef0ff", ink: "#3730a3" },
  { key: "systeme", label: "Autres", c1: "#64748b", c2: "#94a3b8", soft: "#f1f5f9", ink: "#475569" },
];

const FAMILLE_PAR_TYPE: Record<string, NotifFamille> = {
  demande: "demande", estimation: "demande", devis: "demande", b2b: "demande", b2b_lead: "demande",
  demo_request: "demande", message: "demande", devis_accepte: "demande",
  client_action: "client", inscription_client: "client",
  driver_action: "convoyeur", mission_offre: "convoyeur", attribution_acceptee: "convoyeur", mission_acceptee: "convoyeur",
  convoyeur_waitlist: "convoyeur", contrat_signe: "convoyeur", contrat_a_envoyer: "convoyeur",
  contrat_nouvelle_version: "convoyeur", dossier_valide: "convoyeur", document_depose: "convoyeur",
  incident: "probleme", attribution_refusee: "probleme", alerte: "probleme", mission_alert: "probleme", retard: "probleme",
  chat_message: "message", chat: "message", message_conseiller: "message", message_admin: "message",
  paiement: "finance", b2b_paiement: "finance", facture: "finance", facture_paiement: "finance", facture_pro: "finance",
  mission_terminee: "mission", mission: "mission",
};

const MOTS_PROBLEME = /(retard|incident|probl[eè]me|refus|sans code|alerte|annul|d[ée]gât|sinistre|bloqu|[ée]chec|impay)/i;

export function familleOf(n: { type: string; titre?: string | null }): (typeof FAMILLES)[number] {
  let key: NotifFamille = FAMILLE_PAR_TYPE[n.type] ?? (n.type.startsWith("chat") ? "message" : "systeme");
  // un « problème » reste rouge, quel que soit l'émetteur (ex. retard signalé par un convoyeur)
  if (key !== "finance" && MOTS_PROBLEME.test(n.titre ?? "")) key = "probleme";
  return FAMILLES.find((f) => f.key === key)!;
}
