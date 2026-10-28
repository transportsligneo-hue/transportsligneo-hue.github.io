/**
 * Auto-facture convoyeur : facture établie automatiquement par Transports Ligneo
 * au nom et pour le compte du convoyeur (mandat de facturation prévu au contrat, art. 289 I-2 du CGI).
 * Générée à la demande à partir d'un lot de paiement : le convoyeur n'a rien à envoyer.
 */
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { drawDriverDocHeader, loadDriverLogo } from "@/lib/driver-pdf-header";
import { applyLigneoFonts } from "@/lib/pdf-fonts";
import { companyAddressLine, fetchCompanyInfo, type CompanyInfo } from "@/lib/doc-branding";
import { decomposer, type Ajustement, type PaiementConvoyeur, type Remuneration } from "@/lib/finances-convoyeurs";

type RGB = [number, number, number];
const NAVY: RGB = [6, 18, 56];
const BLUE: RGB = [47, 95, 255];
const INK: RGB = [17, 24, 44];
const TEXT: RGB = [50, 60, 82];
const MUTED: RGB = [128, 134, 148];
const LINE: RGB = [223, 228, 238];
const PANEL: RGB = [246, 248, 252];
const NEON: RGB = [0, 170, 255];
const BLUE_SOFT: RGB = [226, 236, 255];

export interface AutofactureMission {
  remu: Remuneration;
  depart?: string | null;
  arrivee?: string | null;
  vehicule?: string | null;
  lignes: ReturnType<typeof decomposer>;
}
export interface AutofactureData {
  paiement: PaiementConvoyeur;
  convoyeur: { nom: string; email?: string | null; siret?: string | null; adresse?: string | null; iban?: string | null; titulaire?: string | null };
  missions: AutofactureMission[];
  company: CompanyInfo | null;
}

export const autofactureNumero = (p: Pick<PaiementConvoyeur, "numero" | "id">) =>
  `AF-${(p.numero ?? p.id.slice(0, 8)).replace(/^PAY-/, "")}`;

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n).replace(/[  ]/g, " ");
const dFr = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const maskIban = (i?: string | null) => {
  const s = (i ?? "").replace(/\s+/g, "");
  return s.length > 8 ? `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}` : s || "—";
};

/** Charge tout ce qu'il faut pour un lot de paiement (admin ou convoyeur concerné : droits d'accès de la session). */
export async function loadAutofactureData(paiementId: string): Promise<AutofactureData> {
  const { data: p, error } = await supabase.from("paiements_convoyeurs").select("*").eq("id", paiementId).maybeSingle();
  if (error || !p) throw new Error("Paiement introuvable");
  const paiement = p as unknown as PaiementConvoyeur;
  const { data: rows } = await supabase.from("remunerations_missions").select("*").eq("paiement_id", paiementId).order("date_mission");
  const remus = (rows ?? []) as unknown as Remuneration[];
  const ids = remus.map((r) => r.id);
  const { data: aj } = ids.length ? await supabase.from("remuneration_ajustements").select("*").in("remuneration_id", ids) : { data: [] };
  const ajust = (aj ?? []) as unknown as Ajustement[];

  const trajetIds = remus.map((r) => r.trajet_id).filter(Boolean);
  const tr = new Map<string, any>();
  if (trajetIds.length) {
    let t: any[] | null = null;
    try {
      const a = await supabase.from("trajets_assigned_safe").select("id, depart, arrivee, marque, modele, immatriculation").in("id", trajetIds);
      t = a.data as any[] | null;
    } catch { /* repli ci-dessous */ }
    if (!t || !t.length) {
      const b = await supabase.from("trajets").select("id, depart, arrivee, marque, modele, immatriculation").in("id", trajetIds);
      t = b.data as any[] | null;
    }
    (t ?? []).forEach((x) => tr.set(x.id, x));
  }

  const { data: cv } = await (supabase as any).from("convoyeurs")
    .select("nom, prenom, email, iban, titulaire_compte, siret, adresse").eq("id", paiement.convoyeur_id).maybeSingle();
  const company = await fetchCompanyInfo();
  return {
    paiement,
    company,
    convoyeur: {
      nom: [cv?.prenom, cv?.nom].filter(Boolean).join(" ") || "Convoyeur",
      email: cv?.email, siret: cv?.siret, adresse: cv?.adresse, iban: cv?.iban, titulaire: cv?.titulaire_compte,
    },
    missions: remus.map((r) => {
      const t = tr.get(r.trajet_id);
      return {
        remu: r,
        depart: t?.depart, arrivee: t?.arrivee,
        vehicule: t ? [t.marque, t.modele, t.immatriculation].filter(Boolean).join(" ") : null,
        lignes: decomposer(r, ajust.filter((a) => a.remuneration_id === r.id)),
      };
    }),
  };
}

export async function generateAutofacturePdf(d: AutofactureData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  applyLigneoFonts(doc);
  const logo = await loadDriverLogo();
  const W = 210, H = 297, L = 18, R = W - 18, CW = R - L;
  const c = d.company;
  const numero = autofactureNumero(d.paiement);
  const set = (size: number, bold = false, color: RGB = TEXT) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
  };
  let y = 0;
  let page = 1;

  const footer = () => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(L, H - 16, R, H - 16);
    set(6.8, false, MUTED);
    const l1 = [c?.raison_sociale ?? "Transports Ligneo", c?.siret ? `SIRET ${c.siret}` : "", companyAddressLine(c)].filter(Boolean).join(" · ");
    doc.text(l1, L, H - 11.5, { maxWidth: CW - 20 });
    doc.text(`${numero} · page ${page}`, R, H - 11.5, { align: "right" });
  };
  const newPage = () => { footer(); doc.addPage(); page += 1; y = 24; miniHeader(); };
  const miniHeader = () => {
    if (logo) { try { doc.addImage(logo, "PNG", L, 9, 9, 9, "logo-driver-doc", "FAST"); } catch { /* optionnel */ } }
    set(7.2, true, MUTED); doc.text(`AUTO-FACTURE ${numero}`, R, 14.5, { align: "right" });
    y = 24;
  };
  const need = (h: number) => { if (y + h > H - 22) newPage(); };

  // ---------- En-tête (même style que les factures clients, logo Driver) ----------
  drawDriverDocHeader(doc, {
    logo, raisonSociale: c?.raison_sociale, sousTitre: "Driver · Convoyeurs partenaires · Tours (37)",
    titre: "AUTO-FACTURE", numero, ligne: `Émise le ${dFr(d.paiement.created_at)}`, L, R,
  });
  y = 48;

  // ---------- Parties ----------
  const bw = (CW - 6) / 2;
  const box = (x: number, titre: string, lignes: string[]) => {
    doc.setFillColor(...PANEL); doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.rect(x, y, bw, 40, "FD");
    doc.setFillColor(...BLUE_SOFT); doc.rect(x, y, bw, 10, "F");
    doc.setFillColor(...BLUE); doc.rect(x, y, 1.4, 10, "F");
    doc.setFillColor(...NEON); doc.rect(x + 1.4, y, 0.7, 10, "F");
    set(7, true, BLUE); doc.text(titre, x + 5, y + 7, { charSpace: 0.4 });
    let yy = y + 16;
    lignes.forEach((t, i) => {
      set(i === 0 ? 10 : 8.2, i === 0, i === 0 ? INK : TEXT);
      const parts = doc.splitTextToSize(t, bw - 10) as string[];
      parts.forEach((pt) => { doc.text(pt, x + 5, yy); yy += i === 0 ? 5 : 4.1; });
    });
  };
  box(L, "PRESTATAIRE (ÉMETTEUR DE LA FACTURE)", [
    d.convoyeur.nom,
    d.convoyeur.siret ? `SIRET ${d.convoyeur.siret}` : "SIRET : à compléter sur la fiche",
    d.convoyeur.adresse ?? "Adresse : à compléter sur la fiche",
    d.convoyeur.email ?? "",
  ].filter(Boolean));
  box(L + bw + 6, "CLIENT (DONNEUR D'ORDRE)", [
    c?.raison_sociale ?? "TRANSPORTS LIGNEO",
    c?.siret ? `SIRET ${c.siret}` : "",
    companyAddressLine(c),
    c?.tva_intra ? `TVA ${c.tva_intra}` : "",
  ].filter(Boolean));
  y += 46;

  set(8, false, TEXT);
  const info = `Période : du ${dFr(d.paiement.periode_debut)} au ${dFr(d.paiement.periode_fin)}  ·  ${d.missions.length} mission(s)  ·  Règlement par virement`;
  doc.text(info, L, y);
  y += 5;
  set(7.4, false, MUTED);
  (doc.splitTextToSize(
    `Facture établie par ${c?.raison_sociale ?? "Transports Ligneo"} au nom et pour le compte du prestataire, en application du mandat de facturation (auto-facturation) accepté dans le contrat de partenariat (article 289, I-2 du CGI). Le prestataire peut contester son contenu par écrit sous 7 jours.`,
    CW,
  ) as string[]).forEach((t) => { doc.text(t, L, y); y += 3.6; });
  y += 4;

  // ---------- Missions ----------
  const head = () => {
    doc.setFillColor(...BLUE); doc.rect(L, y, CW, 7.5, "F");
    doc.setFillColor(...NEON); doc.rect(L, y + 7.5, CW, 0.7, "F");
    set(7.4, true, [255, 255, 255]);
    doc.text("PRESTATION", L + 3, y + 5);
    doc.text("MONTANT HT", R - 3, y + 5, { align: "right" });
    y += 8.2;
  };
  head();
  let total = 0;
  d.missions.forEach((m, idx) => {
    const trajet = m.depart || m.arrivee ? `${m.depart ?? "?"}  -  ${m.arrivee ?? "?"}` : "";
    const nLines = m.lignes.length;
    need(14 + nLines * 5);
    if (y < 30) head();
    set(9.2, true, BLUE);
    doc.text(`Convoyage ${m.remu.numero_mission ?? ""} · ${dFr(m.remu.date_mission)}`.trim(), L + 3, y + 6);
    set(9.2, true, INK); doc.text(eur(Number(m.remu.montant_total)), R - 3, y + 6, { align: "right" });
    let yy = y + 6;
    if (trajet) { yy += 4.5; set(8, false, TEXT); doc.text(trajet, L + 3, yy, { maxWidth: CW - 40 }); }
    if (m.vehicule) { yy += 4.5; set(8, false, MUTED); doc.text(`Véhicule : ${m.vehicule}`, L + 3, yy); }
    y = yy + 4;
    m.lignes.forEach((l) => {
      need(6);
      set(8, false, TEXT);
      doc.text(`• ${l.label}${l.detail ? ` (${l.detail})` : ""}`, L + 6, y, { maxWidth: CW - 40 });
      set(8, false, l.montant < 0 ? [200, 50, 50] : TEXT);
      doc.text(eur(l.montant), R - 3, y, { align: "right" });
      y += 4.6;
    });
    y += 2;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(L, y, R, y); y += 2.5;
    total += Number(m.remu.montant_total);
  });

  // ---------- Totaux ----------
  need(52);
  y += 3;
  const tx = R - 80;
  set(9, false, TEXT); doc.text("Total HT", tx, y); doc.text(eur(total), R - 3, y, { align: "right" }); y += 5.5;
  doc.text("TVA", tx, y); doc.text("non applicable", R - 3, y, { align: "right" }); y += 3.8;
  set(7, false, MUTED); doc.text("TVA non applicable, art. 293 B du CGI (franchise en base)", tx, y); y += 4;
  doc.setFillColor(...BLUE); doc.roundedRect(tx - 4, y, 84, 11, 2, 2, "F");
  doc.setFillColor(...NEON); doc.rect(tx - 4, y + 3, 1.4, 5, "F");
  set(9.5, true, [255, 255, 255]); doc.text("NET À PAYER", tx, y + 7);
  set(12, true, [255, 255, 255]); doc.text(eur(total), R - 3, y + 7.3, { align: "right" });
  y += 18;

  // ---------- Règlement ----------
  need(36);
  doc.setFillColor(...BLUE_SOFT); doc.setDrawColor(...LINE); doc.rect(L, y, CW, 24, "FD");
  doc.setFillColor(...BLUE); doc.rect(L, y, 1.4, 24, "F"); doc.setFillColor(...NEON); doc.rect(L + 1.4, y, 0.7, 24, "F");
  set(7, true, BLUE); doc.text("RÈGLEMENT", L + 5, y + 6.5, { charSpace: 0.4 });
  set(8.4, false, TEXT);
  doc.text(`Virement sur le compte de ${d.convoyeur.titulaire || d.convoyeur.nom} : ${maskIban(d.convoyeur.iban)}`, L + 5, y + 12.5);
  doc.text(
    d.paiement.date_execution
      ? `Payé le ${dFr(d.paiement.date_execution)}${d.paiement.reference_bancaire ? ` · réf. ${d.paiement.reference_bancaire}` : ""}`
      : "Paiement programmé selon le calendrier affiché dans l'application.",
    L + 5, y + 17.5);
  doc.text(`Lot de paiement ${d.paiement.numero ?? ""}`, L + 5, y + 22);
  y += 30;
  set(7, false, MUTED);
  (doc.splitTextToSize(
    "Pénalités de retard : trois fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. L.441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.",
    CW,
  ) as string[]).forEach((t) => { need(5); doc.text(t, L, y); y += 3.6; });
  footer();
  return doc.output("blob");
}

export async function downloadAutofacture(paiementId: string) {
  const data = await loadAutofactureData(paiementId);
  const blob = await generateAutofacturePdf(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${autofactureNumero(data.paiement)}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
