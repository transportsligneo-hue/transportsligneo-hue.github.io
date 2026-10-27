import { supabase } from "@/integrations/supabase/client";

// Tables créées par la migration 20261026000500 (types Supabase pas encore régénérés).
export const rdb = supabase as unknown as { from: (t: string) => any; rpc: (n: string, a?: Record<string, unknown>) => Promise<{ data: any; error: any }> };

export const STEPS = ["Dossier confié", "Prise en charge", "Bilan et devis", "Trajets entre prestataires", "Réparations", "Contrôle et préparation", "Parc partenaire", "Livraison"] as const;
export const SHORT = ["Confié", "Pris en charge", "Bilan / devis", "Trajets", "Réparations", "Contrôle", "Parc", "Livraison"] as const;
export const MOTIFS: Record<string, string> = { fin_leasing: "Fin de leasing", nouveau_collaborateur: "Nouveau collaborateur", remise_vente: "Remise en vente" };

export interface Prestataire { id: string; nom: string; specialite: string | null; ville: string | null; delai_moyen_jours: number | null; note: number | null; contact_email: string | null; contact_tel: string | null; actif: boolean; user_id?: string | null; rayon_km?: number; garantie_mois?: number; tarifs?: Record<string, number>; is_demo?: boolean }
export interface Parc { id: string; nom: string; ville: string | null; capacite: number; occupees: number; cameras: boolean; actif: boolean; is_demo?: boolean }
export interface Facture { ref: string; emetteur: string; objet: string; statut: "a_regler" | "payee" | "offert"; ttc: number }
export interface LigneHT { label: string; type: string; qte: number; prix_ht: number }
export interface DevisRecu {
  id: string; statut: "recu" | "retenu" | "refuse"; lignes: LigneHT[]; total_ht: number; total_ttc: number; delai_jours: number | null; debut_possible: string | null;
  validite_jours: number; garantie_mois: number | null; peinture_cabine: boolean; courtoisie: boolean; commentaire: string | null; repondu_le: string | null;
  prestataire: { id: string; nom: string; ville: string | null; specialite: string | null; note: number | null; delai_moyen_jours: number | null; chantiers: number };
}
export interface PrestaDemande {
  devis_id: string; statut: "demande" | "recu"; date_limite: string | null; dossier_id: string; modele: string; immatriculation: string; motif: string; dommages: string[];
  remarques: string | null; kilometrage: number | null; lieu: string | null; lignes: LigneHT[]; total_ttc: number | null; delai_jours: number | null; garantie_mois: number | null;
  validite_jours: number | null; peinture_cabine: boolean; courtoisie: boolean; commentaire: string | null; debut_possible: string | null;
}
export interface PrestaChantier {
  dossier_id: string; ref: string; modele: string; immatriculation: string; etape: number; chantier_step: number; chantier_note: string | null; chantier_maj: string | null;
  chantier_prevu: string | null; montant: number | null; lignes: DevisLigne[] | null; dommages: string[]; created_at: string; events: Array<{ at: string; message: string; acteur: string | null }>;
}
export interface PrestaOverview {
  prestataire: { id: string; nom: string; specialite: string | null; ville: string | null; rayon_km: number; garantie_mois: number; tarifs: Record<string, number>; delai_moyen_jours: number | null; note: number | null };
  demandes: PrestaDemande[]; chantiers: PrestaChantier[]; devis_envoyes_30j: number; devis_acceptes_30j: number;
}
/** Étapes du chantier, mises à jour par le prestataire. */
export const CHANTIER = ["Reçu", "Diagnostic", "Pièces", "Réparation", "Peinture", "Contrôle", "Prêt"] as const;
export const TVA = 0.2;
export const lineTtc = (l: LigneHT) => Math.round(Number(l.qte || 1) * Number(l.prix_ht || 0) * (1 + TVA) * 100) / 100;
export const eur2 = (n: number | null | undefined) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Number(n ?? 0));
/** Score Ligneo (sur 100) : 40 % qualité (note), 35 % prix, 25 % délai, relatifs aux devis comparés. */
export function scoreDevis(q: DevisRecu, all: DevisRecu[]) {
  const minP = Math.min(...all.map((x) => Number(x.total_ttc) || Infinity));
  const dels = all.map((x) => x.delai_jours).filter((x): x is number => !!x);
  const minD = dels.length ? Math.min(...dels) : null;
  const quality = ((q.prestataire.note ?? 4) / 5) * 40;
  const price = (minP / Math.max(1, Number(q.total_ttc))) * 35;
  const delai = minD && q.delai_jours ? (minD / q.delai_jours) * 25 : 15;
  return Math.max(0, Math.min(100, Math.round(quality + price + delai)));
}
export interface DevisLigne { label: string; montant: number }
export interface Dossier {
  id: string; ref: string; organization_id: string; immatriculation: string; modele: string; motif: keyof typeof MOTIFS | string;
  etape: number; statut: "en_cours" | "livre" | "annule"; adresse_enlevement: string | null; date_enlevement: string | null; contact_site: string | null; remarques: string | null;
  dommages: string[]; devis_statut: "en_attente" | "valide" | "refuse" | null; devis_classique: number | null; devis_ligneo: number | null; devis_lignes: DevisLigne[];
  prestataire_id: string | null; parc_id: string | null; livraison: Record<string, string> | null; facture_ref: string | null; facture_statut: "a_regler" | "payee" | null;
  notes_internes: string | null; livre_le: string | null; created_at: string; updated_at: string;
  chantier_step: number | null; chantier_note: string | null; chantier_maj: string | null; chantier_prevu: string | null; factures: Facture[]; kilometrage: number | null; devis_retenu_id: string | null;
  organizations?: { legal_name: string; commercial_name: string | null } | null;
}
export interface RmkEvent { id: string; dossier_id: string | null; kind: string; message: string; acteur: string | null; visible_client: boolean; planifie_le: string | null; lieu: string | null; created_at: string; remarketing_dossiers?: { ref: string; modele: string; immatriculation: string } | null }
export interface RmkSettings { trajets_charge_ligneo: boolean; devis_obligatoire: boolean; livraison_sur_demande: boolean; relance_devis: boolean; notif_etapes: boolean; tarif_livraison: string; delai_relance_h: number; seuil_auto_eur: number }
export const DEFAULT_SETTINGS: RmkSettings = { trajets_charge_ligneo: true, devis_obligatoire: true, livraison_sur_demande: true, relance_devis: true, notif_etapes: false, tarif_livraison: "49 €", delai_relance_h: 48, seuil_auto_eur: 300 };

export const eur = (n: number | null | undefined) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n ?? 0));
export const dateFr = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—");
export const dateTimeFr = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const saving = (d: Dossier) => Math.max(0, Number(d.devis_classique ?? 0) - Number(d.devis_ligneo ?? 0));
export const devisEnAttente = (d: Dossier) => d.devis_statut === "en_attente" && d.etape === 3 && d.statut === "en_cours";
export const isDone = (d: Dossier) => d.statut === "livre";
export const errText = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Erreur");

export function statusOf(d: Dossier): { tone: "b" | "w" | "k" | "x" | "n"; label: string } {
  if (d.statut === "livre") return { tone: "k", label: "Livré" };
  if (d.statut === "annule") return { tone: "x", label: "Annulé" };
  if (d.devis_statut === "refuse") return { tone: "x", label: "Devis refusé" };
  if (devisEnAttente(d)) return { tone: "w", label: "Devis à valider" };
  if (d.etape === 3) return { tone: "b", label: "Bilan en cours" };
  if (d.etape === 1) return { tone: "n", label: "À prendre en charge" };
  if (d.etape === 8) return { tone: "b", label: "Livraison demandée" };
  return { tone: "b", label: SHORT[d.etape - 1] };
}

export async function logEvent(dossierId: string | null, message: string, opts: { kind?: string; acteur?: string; visible?: boolean; planifie_le?: string | null; lieu?: string | null } = {}) {
  await rdb.from("remarketing_events").insert({ dossier_id: dossierId, kind: opts.kind ?? "info", message, acteur: opts.acteur ?? "Admin", visible_client: opts.visible ?? true, planifie_le: opts.planifie_le ?? null, lieu: opts.lieu ?? null });
}

/** Devis / facture : petit document HTML imprimable (enregistrable en PDF depuis le navigateur). */
export function downloadDoc(d: Dossier, kind: "devis" | "facture") {
  const lignes = (d.devis_lignes?.length ? d.devis_lignes : d.dommages.map((x) => ({ label: x, montant: Math.round(Number(d.devis_ligneo ?? 0) / Math.max(1, d.dommages.length)) })));
  const titre = kind === "devis" ? "Devis" : "Facture";
  const num = kind === "devis" ? `DEV-${d.ref}` : d.facture_ref ?? `FAC-${d.ref}`;
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${titre} ${num}</title><body style="font-family:Poppins,Arial,sans-serif;max-width:720px;margin:40px auto;color:#14161c"><h1 style="color:#2f5fff">Transports Ligneo · ${titre}</h1><p><b>${num}</b> · ${d.modele} · ${d.immatriculation}<br>Motif : ${MOTIFS[d.motif] ?? d.motif}</p><table style="width:100%;border-collapse:collapse">${lignes.map((l) => `<tr><td style="padding:8px;border-bottom:1px solid #e7ebf3">${l.label}</td><td style="padding:8px;border-bottom:1px solid #e7ebf3;text-align:right">${eur(l.montant)}</td></tr>`).join("")}<tr><td style="padding:8px">Trajets entre prestataires</td><td style="padding:8px;text-align:right">À la charge de Ligneo</td></tr><tr><td style="padding:10px;font-weight:700">Total</td><td style="padding:10px;text-align:right;font-weight:700">${eur(d.devis_ligneo)}</td></tr></table><p style="color:#667599;font-size:12px">Transports Ligneo · Tours · contact@transportsligneo.fr · 07 82 45 61 81</p></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${num}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
