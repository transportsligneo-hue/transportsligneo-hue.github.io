/**
 * PDF final mission — récapitulatif EDL complet pour admin (et client si autorisé).
 *
 * Contenu :
 *  - En-tête mission (n°, date, départ/arrivée, véhicule)
 *  - Convoyeur assigné
 *  - Équipements + kilométrages départ/arrivée
 *  - Toutes les photos EDL (grille 2 colonnes)
 *  - Signatures départ + arrivée
 *  - Incidents éventuels
 *
 * AUCUN prix / tarif mentionné — destiné à la traçabilité opérationnelle.
 */
import jsPDF from "jspdf";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export interface EdlFinalPdfPhoto {
  vue_type: string;
  url: string; // URL signée déjà résolue
  label?: string;
}

export interface EdlFinalPdfData {
  numero: string;
  date_mission?: string | null;
  depart: string;
  arrivee: string;
  vehicule?: { marque?: string | null; modele?: string | null; immatriculation?: string | null; vin?: string | null } | null;
  convoyeur?: { prenom?: string | null; nom?: string | null; telephone?: string | null } | null;
  contactArrivee?: { nom?: string | null; telephone?: string | null; instructions?: string | null } | null;
  equipements?: Record<string, unknown> | null;
  kilometrage_depart?: number | null;
  kilometrage_arrivee?: number | null;
  photosDepart: EdlFinalPdfPhoto[];
  photosArrivee: EdlFinalPdfPhoto[];
  signatures?: { kind: string; url?: string | null }[];
  incidents?: { titre: string; description: string; gravite: string; created_at: string }[];
}

const NAVY: [number, number, number] = [11, 16, 38];
const GOLD: [number, number, number] = [212, 175, 55];
const TEXT: [number, number, number] = [40, 40, 50];
const MUTED: [number, number, number] = [110, 110, 120];
const WHITE: [number, number, number] = [255, 255, 255];

async function loadAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR"); } catch { return d; }
};

const VUE_LABELS: Record<string, string> = {
  face_avant: "Face avant",
  face_arriere: "Face arrière",
  trois_quart_avant_droite: "3/4 avant droit",
  trois_quart_avant_gauche: "3/4 avant gauche",
  trois_quart_arriere_droite: "3/4 arrière droit",
  trois_quart_arriere_gauche: "3/4 arrière gauche",
  jante_avant_droite: "Jante AV droite",
  jante_avant_gauche: "Jante AV gauche",
  jante_arriere_droite: "Jante AR droite",
  jante_arriere_gauche: "Jante AR gauche",
  coffre_ouvert: "Coffre",
  cable_electrique: "Câble électrique",
  siege_avant: "Intérieur avant",
  siege_arriere: "Intérieur arrière",
  compteur: "Compteur",
  kit_securite: "Kit sécurité",
  pv_livraison: "PV livraison",
  carte_grise: "Carte grise",
};

const labelOf = (vue: string) => VUE_LABELS[vue] ?? vue.replace(/_/g, " ");

function header(doc: jsPDF, logo: string | null, m: EdlFinalPdfData) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 38, "F");
  if (logo) { try { doc.addImage(logo, "PNG", 10, 5, 28, 28); } catch { /* ignore */ } }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("ÉTAT DES LIEUX — DOSSIER COMPLET", pageW - 12, 14, { align: "right" });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageW - 78, 19, 66, 9, 1.5, 1.5, "S");
  doc.setTextColor(...GOLD);
  doc.setFontSize(10);
  doc.text(m.numero, pageW - 45, 25, { align: "center" });
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Date : ${fmtDate(m.date_mission)}`, pageW - 12, 33, { align: "right" });
}

function footer(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(10, pageH - 12, pageW - 10, pageH - 12);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Transports Ligneo — Document confidentiel — Aucune valeur commerciale", pageW / 2, pageH - 7, { align: "center" });
}

function sectionTitle(doc: jsPDF, label: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(10, y, pageW - 20, 7, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(label.toUpperCase(), 13, y + 5);
  return y + 11;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, logo: string | null, m: EdlFinalPdfData): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 18) {
    footer(doc);
    doc.addPage();
    header(doc, logo, m);
    return 44;
  }
  return y;
}

async function drawPhotoGrid(
  doc: jsPDF,
  photos: EdlFinalPdfPhoto[],
  startY: number,
  logo: string | null,
  m: EdlFinalPdfData,
): Promise<number> {
  if (!photos.length) return startY;
  const pageW = doc.internal.pageSize.getWidth();
  const cols = 2;
  const gap = 6;
  const margin = 10;
  const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = cellW * 0.72;
  let y = startY;
  let col = 0;

  for (const ph of photos) {
    y = ensureSpace(doc, y, cellH + 12, logo, m);
    const x = margin + col * (cellW + gap);
    const data = await loadAsDataUrl(ph.url);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cellW, cellH, 1.5, 1.5, "S");
    if (data) {
      try {
        const fmt = data.includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(data, fmt, x + 1, y + 1, cellW - 2, cellH - 2);
      } catch { /* ignore */ }
    }
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(ph.label ?? labelOf(ph.vue_type), x + 2, y + cellH + 5);
    col++;
    if (col >= cols) {
      col = 0;
      y += cellH + 12;
    }
  }
  if (col !== 0) y += cellH + 12;
  return y;
}

export async function generateEdlFinalPdf(m: EdlFinalPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadAsDataUrl(logoLigneo);

  header(doc, logo, m);
  let y = 44;

  // === Bloc INFOS MISSION ===
  y = sectionTitle(doc, "Mission", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  const rows: Array<[string, string]> = [
    ["Départ", m.depart],
    ["Arrivée", m.arrivee],
    ["Véhicule", [m.vehicule?.marque, m.vehicule?.modele].filter(Boolean).join(" ") || "—"],
    ["Immatriculation", m.vehicule?.immatriculation || "—"],
    ["VIN", m.vehicule?.vin || "—"],
    ["Convoyeur", `${m.convoyeur?.prenom ?? ""} ${m.convoyeur?.nom ?? ""}`.trim() || "—"],
    ["Téléphone convoyeur", m.convoyeur?.telephone || "—"],
    ["Kilométrage départ", m.kilometrage_depart != null ? `${m.kilometrage_depart} km` : "—"],
    ["Kilométrage arrivée", m.kilometrage_arrivee != null ? `${m.kilometrage_arrivee} km` : "—"],
  ];
  if (m.kilometrage_depart != null && m.kilometrage_arrivee != null) {
    rows.push(["Distance parcourue", `${Math.max(0, m.kilometrage_arrivee - m.kilometrage_depart)} km`]);
  }
  for (const [k, v] of rows) {
    y = ensureSpace(doc, y, 6, logo, m);
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text(k, 12, y);
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold");
    doc.text(v, pageW - 12, y, { align: "right" });
    y += 5.5;
  }

  // === Équipements (si jsonb fourni) ===
  if (m.equipements && Object.keys(m.equipements).length > 0) {
    y += 3;
    y = ensureSpace(doc, y, 14, logo, m);
    y = sectionTitle(doc, "Équipements véhicule", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const [k, v] of Object.entries(m.equipements)) {
      y = ensureSpace(doc, y, 6, logo, m);
      doc.setTextColor(...MUTED);
      doc.text(k.replace(/_/g, " "), 12, y);
      doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold");
      doc.text(String(v ?? "—"), pageW - 12, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5.5;
    }
  }

  // === Contact livraison ===
  if (m.contactArrivee && (m.contactArrivee.nom || m.contactArrivee.telephone)) {
    y += 3;
    y = ensureSpace(doc, y, 22, logo, m);
    y = sectionTitle(doc, "Contact livraison", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    const cRows: Array<[string, string]> = [
      ["Nom", m.contactArrivee.nom || "—"],
      ["Téléphone", m.contactArrivee.telephone || "—"],
    ];
    for (const [k, v] of cRows) {
      y = ensureSpace(doc, y, 6, logo, m);
      doc.setTextColor(...MUTED); doc.text(k, 12, y);
      doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold");
      doc.text(v, pageW - 12, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5.5;
    }
    if (m.contactArrivee.instructions) {
      y = ensureSpace(doc, y, 14, logo, m);
      doc.setTextColor(...MUTED); doc.text("Instructions :", 12, y); y += 5;
      doc.setTextColor(...TEXT);
      const lines = doc.splitTextToSize(m.contactArrivee.instructions, pageW - 24) as string[];
      for (const line of lines) {
        y = ensureSpace(doc, y, 5, logo, m);
        doc.text(line, 12, y);
        y += 4.5;
      }
    }
  }

  // === Photos départ ===
  if (m.photosDepart.length > 0) {
    y += 4;
    y = ensureSpace(doc, y, 14, logo, m);
    y = sectionTitle(doc, "État des lieux — Départ", y);
    y = await drawPhotoGrid(doc, m.photosDepart, y, logo, m);
  }

  // === Photos arrivée ===
  if (m.photosArrivee.length > 0) {
    y += 4;
    y = ensureSpace(doc, y, 14, logo, m);
    y = sectionTitle(doc, "État des lieux — Arrivée", y);
    y = await drawPhotoGrid(doc, m.photosArrivee, y, logo, m);
  }

  // === Signatures (Départ + Arrivée, convoyeur + client) ===
  {
    const SIG_LABELS: Record<string, string> = {
      driver_start: "Convoyeur — Départ",
      client_start: "Client — Départ",
      driver_end: "Convoyeur — Arrivée",
      client_end: "Client — Arrivée",
    };
    const byKind = new Map<string, string | null | undefined>();
    for (const s of m.signatures ?? []) byKind.set(s.kind, s.url);
    const slots: { kind: string; url?: string | null }[] = [
      { kind: "driver_start", url: byKind.get("driver_start") ?? byKind.get("depart") },
      { kind: "client_start", url: byKind.get("client_start") ?? byKind.get("client_depart") },
      { kind: "driver_end", url: byKind.get("driver_end") ?? byKind.get("arrivee") },
      { kind: "client_end", url: byKind.get("client_end") ?? byKind.get("client_arrivee") },
    ];

    y += 4;
    y = ensureSpace(doc, y, 60, logo, m);
    y = sectionTitle(doc, "Signatures", y);
    const sigW = 88;
    const sigH = 38;
    let sx = 12;
    for (const sig of slots) {
      if (sx + sigW > pageW - 10) {
        sx = 12; y += sigH + 12;
        y = ensureSpace(doc, y, sigH + 14, logo, m);
      }
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.3);
      doc.roundedRect(sx, y, sigW, sigH, 1.5, 1.5, "S");
      let drawn = false;
      if (sig.url) {
        const data = await loadAsDataUrl(sig.url);
        if (data) {
          try {
            const fmt = data.includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(data, fmt, sx + 1, y + 1, sigW - 2, sigH - 2);
            drawn = true;
          } catch { /* ignore */ }
        }
      }
      if (!drawn) {
        doc.setTextColor(...MUTED); doc.setFont("helvetica", "italic"); doc.setFontSize(8);
        doc.text(sig.url ? "(signature indisponible)" : "Non signée", sx + sigW / 2, y + sigH / 2 + 1, { align: "center" });
        doc.setFont("helvetica", "normal");
      }
      doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(SIG_LABELS[sig.kind] ?? sig.kind, sx + 2, y + sigH + 4);
      doc.setFont("helvetica", "normal");
      sx += sigW + 8;
    }
    y += sigH + 12;
  }

  // === Incidents ===
  if (m.incidents?.length) {
    y += 4;
    y = ensureSpace(doc, y, 16, logo, m);
    y = sectionTitle(doc, "Incidents signalés", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const inc of m.incidents) {
      y = ensureSpace(doc, y, 14, logo, m);
      doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold");
      doc.text(`• ${inc.titre} (${inc.gravite})`, 12, y); y += 5;
      doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(new Date(inc.created_at).toLocaleString("fr-FR"), 12, y); y += 4;
      doc.setTextColor(...TEXT); doc.setFontSize(9);
      const lines = doc.splitTextToSize(inc.description, pageW - 24) as string[];
      for (const line of lines) {
        y = ensureSpace(doc, y, 5, logo, m);
        doc.text(line, 14, y); y += 4.5;
      }
      y += 2;
    }
  }

  footer(doc);
  return doc.output("blob");
}
