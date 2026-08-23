/**
 * PDF final mission — dossier "État des lieux" (design v3 institutionnel).
 *
 * Document 4 pages fixes, rendu HTML → canvas → jsPDF :
 *  1. Couverture + informations mission + équipements + sommaire
 *  2. Photos départ (grille 4 colonnes)
 *  3. Photos arrivée (grille 4 colonnes)
 *  4. Signatures 2×2 + mention légale
 *
 * Palette : navy #0B1338, or #C9A227, panneaux #F7F8FC, texte #0B1338.
 * L'API publique (EdlFinalPdfData + generateEdlFinalPdf) reste identique.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { LIGNEO_BRAND_LOGO as logoLigneo } from "@/lib/brand-assets";
import { applyLigneoFonts } from "@/lib/pdf-fonts";

export interface EdlFinalPdfPhoto {
  vue_type: string;
  url: string;
  label?: string;
}

export interface EdlFinalPdfData {
  numero: string;
  date_mission?: string | null;
  depart: string;
  arrivee: string;
  vehicule?: {
    marque?: string | null;
    modele?: string | null;
    immatriculation?: string | null;
    vin?: string | null;
    energie?: string | null;
    categorie?: string | null;
  } | null;
  convoyeur?: { prenom?: string | null; nom?: string | null; telephone?: string | null } | null;
  contactArrivee?: { nom?: string | null; telephone?: string | null; instructions?: string | null } | null;
  equipements?: Record<string, unknown> | null;
  kilometrage_depart?: number | null;
  kilometrage_arrivee?: number | null;
  photosDepart: EdlFinalPdfPhoto[];
  photosArrivee: EdlFinalPdfPhoto[];
  signatures?: { kind: string; url?: string | null }[];
  incidents?: { titre: string; description: string; gravite: string; created_at: string }[];
  /** Documents scannés (PV de livraison, carte grise…) rendus en pleine page. */
  documents?: EdlFinalPdfDocument[];
}

export interface EdlFinalPdfDocument {
  /** Libellé affiché en bandeau (ex : « PV de livraison signé »). */
  label: string;
  url: string;
  /** Sous-titre optionnel (date, origine…). */
  meta?: string | null;
}

export interface EdlFinalPdfOptions {
  /** Mode « dossier complet » : couverture + sommaire adaptés. */
  dossier?: boolean;
}

/** Types de vues considérés comme des documents scannés (rendus en pleine page). */
const DOC_VUE_RE = /(pv_livraison|pv_restitution|carte_grise|cpi|bon_commande|bon_livraison|mandat)/i;
export const isScannedDocumentVue = (vueType: string) => DOC_VUE_RE.test(vueType);


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
  photos_cles: "Clés du véhicule",
  kit_securite: "Kit sécurité",
  pv_livraison: "PV livraison",
  carte_grise: "Carte grise",
};
const labelOf = (v: string) => VUE_LABELS[v] ?? v.replace(/_/g, " ");

const EQUIP_LABELS: Record<string, string> = {
  roue_secours: "Roue de secours / kit anti-crevaison",
  roue_de_secours: "Roue de secours / kit anti-crevaison",
  tapis_sol: "Tapis de sol",
  tapis_de_sol: "Tapis de sol",
  extincteur: "Extincteur",
  cable_charge: "Câble de charge",
  cable_de_charge: "Câble de charge",
  doubles_cles: "Doubles clés",
  double_cles: "Doubles clés",
  kit_securite: "Kit de sécurité",
  triangle: "Triangle",
  gilet: "Gilet réfléchissant",
  cric: "Cric",
};
const DEFAULT_EQUIP_KEYS = ["roue_secours", "tapis_sol", "extincteur", "cable_charge", "doubles_cles", "kit_securite"];


const SIG_LABELS: Record<string, { role: string; step: string }> = {
  driver_start: { role: "Convoyeur", step: "Départ" },
  client_start: { role: "Client", step: "Départ" },
  driver_end: { role: "Convoyeur", step: "Arrivée" },
  client_end: { role: "Client", step: "Arrivée" },
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function splitAddress(addr: string): { street: string; city: string } {
  if (!addr) return { street: "—", city: "" };
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { street: addr, city: "" };
  const last = parts[parts.length - 1];
  const cityMatch = last.match(/(\d{4,5})\s+(.+)/);
  const city = cityMatch ? `${cityMatch[1]} ${cityMatch[2]}` : last;
  const street = parts.slice(0, -1).join(", ");
  return { street, city };
}

function isTruthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    // Valeurs négatives explicites
    if (["", "false", "non", "no", "aucun", "absent", "absente", "0", "ko", "null"].includes(s)) return false;
    // Valeurs positives connues + variantes métier (roue : "secours" / "kit")
    return true;
  }
  if (typeof v === "number") return v > 0;
  return false;
}


async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ---------- Blocs HTML ----------

/**
 * En-tête premium identique sur TOUTES les pages :
 * bande navy 30mm + liseré bleu électrique néon, logo + wordmark à gauche,
 * badge de référence + contexte de page à droite.
 */
function renderHeader(logoData: string, m: EdlFinalPdfData, right: string): string {
  return `
    <div class="pdf-head">
      <div class="brand">
        ${logoData ? `<img class="brand-logo" src="${logoData}" alt="Transports Ligneo">` : ""}
        <div>
          <div class="brand-name"><span class="bn-1">TRANSPORTS</span> <span class="bn-2">LIGNEO</span></div>
          <div class="brand-tag">Convoyage automobile</div>
        </div>
      </div>
      <div class="ref-block">
        <div class="ref-pill">${escape(m.numero)}</div>
        <div class="ref-date">${escape(right)}</div>
      </div>
    </div>`;
}

function renderCoverHeader(logoData: string, m: EdlFinalPdfData): string {
  return renderHeader(logoData, m, `Édité le ${fmtDate(m.date_mission ?? new Date().toISOString())}`);
}

function renderPageHeader(logoData: string, m: EdlFinalPdfData, section: string, _pageNum: number, _total: number): string {
  return renderHeader(logoData, m, section);
}

function renderFoot(pageNum?: number, total?: number): string {
  return `<div class="pg-foot"><span>Transports Ligneo — Document confidentiel — Aucune valeur commerciale</span>${
    pageNum && total ? `<span class="pg-foot-num">Page ${pageNum}/${total}</span>` : ""
  }</div>`;
}


function renderCoverBody(
  m: EdlFinalPdfData,
  distance: number | null,
  totalPhotos: { dep: number; arr: number },
  docs: EdlFinalPdfDocument[] = [],
  dossier = false,
): string {
  const dep = splitAddress(m.depart);
  const arr = splitAddress(m.arrivee);
  const veh = [m.vehicule?.marque, m.vehicule?.modele].filter(Boolean).join(" ") || "—";
  const conv = `${m.convoyeur?.prenom ?? ""} ${m.convoyeur?.nom ?? ""}`.trim() || "—";

  const stats: [string, string][] = [
    ["VÉHICULE", veh],
    ["IMMATRICULATION", m.vehicule?.immatriculation || "—"],
    ["VIN", m.vehicule?.vin || "Non renseigné"],
    ["DISTANCE PARCOURUE", distance != null ? `${distance} km` : "—"],
  ];

  const eq = (m.equipements ?? {}) as Record<string, unknown>;
  // Normalise les alias (roue, roue_secours, kit_anti_crevaison… -> roue_secours)
  const normalizeKey = (k: string): string | null => {
    const n = k.toLowerCase().replace(/[\s-]/g, "_");
    if (/^roue(_|$)/.test(n) || n.includes("crevaison") || n === "roue_de_secours") return "roue_secours";
    if (n.includes("tapis")) return "tapis_sol";
    if (n.includes("extincteur")) return "extincteur";
    if (n.includes("cable")) return "cable_charge";
    if (n.includes("cle")) return "doubles_cles";
    if (n.includes("kit_securite") || n.includes("securite")) return "kit_securite";
    if (n.includes("triangle")) return "triangle";
    if (n.includes("gilet")) return "gilet";
    if (n === "cric") return "cric";
    return null; // clé inconnue : on n'affiche pas de ligne parasite
  };

  const presence = new Map<string, boolean>();
  const details = new Map<string, string>();
  for (const key of DEFAULT_EQUIP_KEYS) presence.set(key, false);
  for (const [k, v] of Object.entries(eq)) {
    const nk = normalizeKey(k);
    if (!nk) continue;
    const ok = isTruthy(v);
    presence.set(nk, (presence.get(nk) ?? false) || ok);
    if (ok && nk === "roue_secours" && typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "secours") details.set(nk, "Roue de secours");
      else if (s === "kit") details.set(nk, "Kit anti-crevaison");
    }
  }

  const equipItems = Array.from(presence.entries()).map(([k, ok]) => ({
    label: EQUIP_LABELS[k] ?? k.replace(/_/g, " "),
    sub: ok ? (details.get(k) ?? "Présent") : "Absent",
    ok,
  }));



  return `
    <div class="cover-title">${dossier ? "Dossier complet de mission" : "État des lieux"}</div>
    <div class="cover-accent"></div>
    <div class="cover-sub">${dossier ? "État des lieux, PV de livraison signé &amp; documents du véhicule" : "Dossier de convoyage complet — départ &amp; arrivée"}</div>


    <div class="stats-row">
      ${stats
        .map(
          ([l, v]) => `
        <div class="stat-card">
          <div class="stat-label">${escape(l)}</div>
          <div class="stat-value ${l === "IMMATRICULATION" || l === "VIN" ? "mono" : ""}">${escape(v)}</div>
        </div>`,
        )
        .join("")}
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="panel-title">INFORMATIONS DE MISSION</div>
        <div class="kv-row"><span class="kv-l">Adresse de départ</span><span class="kv-v">${escape(dep.street)}${dep.city ? `,<br>${escape(dep.city)}` : ""}</span></div>
        <div class="kv-row"><span class="kv-l">Adresse d'arrivée</span><span class="kv-v">${escape(arr.street)}${arr.city ? `,<br>${escape(arr.city)}` : ""}</span></div>
        <div class="kv-row"><span class="kv-l">Convoyeur</span><span class="kv-v">${escape(conv)}</span></div>
        <div class="kv-row"><span class="kv-l">Téléphone convoyeur</span><span class="kv-v">${escape(m.convoyeur?.telephone || "—")}</span></div>
      </div>

      <div class="panel">
        <div class="panel-title">KILOMÉTRAGE</div>
        <div class="km-row">
          <div class="km-col"><span class="km-dot dot-dep"></span><div class="km-label">DÉPART</div><div class="km-value">${m.kilometrage_depart != null ? `${m.kilometrage_depart} km` : "—"}</div></div>
          <div class="km-col"><span class="km-dot dot-arr"></span><div class="km-label">ARRIVÉE</div><div class="km-value">${m.kilometrage_arrivee != null ? `${m.kilometrage_arrivee} km` : "—"}</div></div>
        </div>

        <div class="equip-title">ÉQUIPEMENTS VÉHICULE</div>
        <div class="equip-grid">
          ${equipItems
            .map(
              (it) => `
            <div class="equip-item">
              <div class="equip-icon ${it.ok ? "ok" : "ko"}">${it.ok ? "✓" : "✗"}</div>
              <div>
                <div class="equip-label">${escape(it.label)}</div>
                <div class="equip-sub">${escape(it.sub)}</div>
              </div>
            </div>`,
            )
            .join("")}
        </div>
      </div>
    </div>

    <div class="toc">
      ${[
        "Informations &amp; équipements",
        `État des lieux — Départ (${totalPhotos.dep} photos)`,
        `État des lieux — Arrivée (${totalPhotos.arr} photos)`,
        "Signatures &amp; validation",
        ...docs.map((d) => `${escape(d.label)} (document scanné)`),
      ]
        .map(
          (t, i) =>
            `<div class="toc-row"><span class="toc-num">${i + 1}</span><span class="toc-text">${t}</span></div>`,
        )
        .join("")}
    </div>

  `;
}

function renderSectionBand(title: string, right: string): string {
  return `
    <div class="section-band">
      <div class="section-band-title">${escape(title)}</div>
      <div class="section-band-right">${escape(right)}</div>
    </div>`;
}

function renderPhotoGrid(photos: EdlFinalPdfPhoto[], startIndex: number): string {
  // Grille dynamique : par défaut 4 colonnes. Si beaucoup de photos, augmenter le nb de lignes.
  const count = photos.length;
  if (count === 0) {
    return `<div class="photo-empty">Aucune photo d'état des lieux disponible pour cette étape.</div>`;
  }
  const cols = count <= 4 ? Math.max(2, count) : 4;
  const rows = Math.ceil(count / cols);
  return `
    <div class="photo-grid" style="grid-template-columns:repeat(${cols},1fr);grid-auto-rows:calc((215mm - ${(rows - 1) * 4}mm) / ${Math.max(rows, 4)});">
      ${photos
        .map((p, i) => {
          const num = String(startIndex + i).padStart(2, "0");
          const label = p.label ?? labelOf(p.vue_type);
          const inner = p.url
            ? `<img src="${p.url}" alt="${escape(label)}" crossorigin="anonymous" />`
            : `<div class="ph-empty">—</div>`;
          return `
            <div class="photo-card">
              <div class="photo-frame">${inner}</div>
              <div class="photo-cap"><span class="cap-num">${num}</span><span class="cap-lbl">${escape(label)}</span></div>
            </div>`;
        })
        .join("")}
    </div>`;
}

function renderSignatures(sigs: EdlFinalPdfData["signatures"]): string {
  const byKind = new Map<string, string | null | undefined>();
  for (const s of sigs ?? []) byKind.set(s.kind, s.url);
  const slots = [
    { kind: "driver_start", url: byKind.get("driver_start") ?? byKind.get("depart") },
    { kind: "client_start", url: byKind.get("client_start") ?? byKind.get("client_depart") },
    { kind: "driver_end", url: byKind.get("driver_end") ?? byKind.get("arrivee") },
    { kind: "client_end", url: byKind.get("client_end") ?? byKind.get("client_arrivee") },
  ];
  return `
    ${renderSectionBand("SIGNATURES", "Validation départ & arrivée")}
    <div class="sig-grid">
      ${slots
        .map((s) => {
          const meta = SIG_LABELS[s.kind];
          const inner = s.url
            ? `<img src="${s.url}" alt="signature" crossorigin="anonymous" />`
            : `<div class="sig-empty">Non signé</div>`;
          return `
            <div class="sig-card">
              <div class="sig-pad">${inner}</div>
              <div class="sig-caption"><b>${meta.role}</b> <span>${meta.step}</span></div>
            </div>`;
        })
        .join("")}
    </div>
    <div class="mention">
      Ce document atteste de l'état du véhicule constaté contradictoirement par le convoyeur et le client aux points de départ et d'arrivée. Les signatures ci-dessus valent accord des deux parties sur les éléments consignés dans ce dossier.
    </div>
  `;
}

// ---------- CSS ----------

const CSS = `
:root{
  --navy:#0B1338;
  --navy-2:#141c47;
  --gold:#00BEFF;
  --gold-soft:#7FE0FF;
  --neon:#00BEFF;
  --neon-deep:#2F5FFF;
  --bg:#ffffff;
  --panel:#F7F8FC;
  --panel-border:#E4E7F2;
  --text:#0B1338;
  --text-soft:#3E466B;
  --text-mute:#7A8199;
  --ok:#1E9E6C;
  --ko:#C4483A;
  --radius:8px;
}
.edl-pdf-root{ font-family:'Arial','Liberation Sans','Helvetica',sans-serif; color:var(--text); -webkit-font-smoothing:antialiased; }
.edl-pdf-root *{ box-sizing:border-box; }
.edl-pdf-root .page{
  width:210mm; min-height:297mm; position:relative;
  background:var(--bg);
  padding:38mm 14mm 18mm;
  overflow:hidden;
}

/* ===== HEADER PREMIUM (identique sur toutes les pages) ===== */
.edl-pdf-root .pdf-head{
  position:absolute;top:0;left:0;right:0;height:30mm;
  background:#0A1638;border-bottom:1.2mm solid var(--neon);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 12mm;
}
.edl-pdf-root .brand{display:flex;align-items:center;gap:10px;}
.edl-pdf-root .brand-logo{width:16mm;height:16mm;border-radius:8px;object-fit:cover;background:#0A1638;}
.edl-pdf-root .brand-name{font-weight:800;font-size:14px;letter-spacing:.6px;line-height:1.1;}
.edl-pdf-root .bn-1{color:#ffffff;}
.edl-pdf-root .bn-2{color:var(--neon);}
.edl-pdf-root .brand-tag{font-size:9.5px;color:#C3CBE4;margin-top:3px;}
.edl-pdf-root .ref-block{text-align:right;}
.edl-pdf-root .ref-pill{display:inline-block;background:var(--neon);color:#0A1638;font-weight:800;font-size:11px;letter-spacing:.4px;padding:5px 14px;border-radius:20px;}
.edl-pdf-root .ref-date{font-size:9.5px;color:var(--neon);margin-top:5px;font-weight:600;}

.edl-pdf-root .pg-foot{position:absolute;bottom:8mm;left:14mm;right:14mm;padding-top:8px;border-top:1px solid var(--panel-border);display:flex;justify-content:space-between;font-size:9px;color:var(--text-mute);}
.edl-pdf-root .pg-foot-num{font-weight:700;color:var(--navy);}

/* ===== COVER ===== */
.edl-pdf-root .cover-accent{width:70px;height:3px;background:var(--neon);border-radius:3px;margin:10px 0 0;}
.edl-pdf-root .cover-title{font-size:28px;font-weight:800;color:var(--navy);letter-spacing:-.5px;margin-top:4px;}
.edl-pdf-root .cover-sub{font-size:11.5px;color:var(--text-mute);margin-top:2px;margin-bottom:14px;}

.edl-pdf-root .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;}
.edl-pdf-root .stat-card{background:#fff;color:var(--navy);border:1px solid var(--panel-border);border-left:3px solid var(--neon-deep);border-radius:var(--radius);padding:12px 14px;}
.edl-pdf-root .stat-label{font-size:8.5px;font-weight:700;letter-spacing:.6px;color:var(--text-mute);margin-bottom:6px;}
.edl-pdf-root .stat-value{font-size:13px;font-weight:700;color:var(--navy);line-height:1.15;}
.edl-pdf-root .stat-value.mono{font-family:'Menlo','Consolas','Liberation Mono',monospace;font-size:12.5px;letter-spacing:.5px;}

.edl-pdf-root .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.edl-pdf-root .panel{background:var(--panel);border:1px solid var(--panel-border);border-radius:var(--radius);padding:14px 16px;}
.edl-pdf-root .panel-title{font-size:10px;font-weight:800;letter-spacing:.8px;color:var(--neon-deep);text-transform:uppercase;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid var(--panel-border);}

.edl-pdf-root .kv-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:6px 0;font-size:10.5px;border-bottom:1px dashed #E4E7F2;}
.edl-pdf-root .kv-row:last-child{border-bottom:none;}
.edl-pdf-root .kv-l{color:var(--text-mute);flex-shrink:0;}
.edl-pdf-root .kv-v{color:var(--navy);font-weight:700;text-align:right;}

.edl-pdf-root .km-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-bottom:12px;margin-bottom:10px;border-bottom:1px solid var(--panel-border);}
.edl-pdf-root .km-col{position:relative;padding-left:12px;}
.edl-pdf-root .km-dot{position:absolute;left:0;top:6px;width:7px;height:7px;border-radius:50%;}
.edl-pdf-root .dot-dep{background:var(--navy);}
.edl-pdf-root .dot-arr{background:var(--gold);}
.edl-pdf-root .km-label{font-size:8.5px;font-weight:700;color:var(--text-mute);letter-spacing:.6px;}
.edl-pdf-root .km-value{font-size:14px;font-weight:800;color:var(--navy);margin-top:3px;}

.edl-pdf-root .equip-title{font-size:10px;font-weight:800;letter-spacing:.8px;color:var(--neon-deep);margin-bottom:8px;}
.edl-pdf-root .equip-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.edl-pdf-root .equip-item{display:flex;align-items:flex-start;gap:8px;background:#fff;border:1px solid var(--panel-border);border-radius:6px;padding:8px 10px;}
.edl-pdf-root .equip-icon{width:16px;height:16px;border-radius:50%;color:#fff;font-weight:800;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.edl-pdf-root .equip-icon.ok{background:var(--ok);}
.edl-pdf-root .equip-icon.ko{background:var(--ko);}
.edl-pdf-root .equip-label{font-size:10px;font-weight:700;color:var(--navy);line-height:1.15;}
.edl-pdf-root .equip-sub{font-size:8.5px;color:var(--text-mute);margin-top:1px;}

.edl-pdf-root .toc{margin-top:20px;}
.edl-pdf-root .toc-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px dashed var(--panel-border);}
.edl-pdf-root .toc-num{width:22px;height:22px;border-radius:50%;background:var(--navy);color:#fff;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.edl-pdf-root .toc-text{font-size:11px;color:var(--navy);font-weight:600;}

/* ===== SECTION BAND (pages 2/3/4) ===== */
.edl-pdf-root .section-band{display:flex;justify-content:space-between;align-items:center;background:var(--navy);color:#fff;padding:10px 16px;border-radius:6px;margin-bottom:12px;border-left:4px solid var(--gold);}
.edl-pdf-root .section-band-title{font-weight:800;font-size:12px;letter-spacing:1px;text-transform:uppercase;}
.edl-pdf-root .section-band-right{font-size:10px;color:var(--gold-soft);font-weight:700;}

/* ===== PHOTO GRID ===== */
.edl-pdf-root .photo-grid{display:grid;gap:4mm;}
.edl-pdf-root .photo-empty{border:1px dashed var(--panel-border);border-radius:8px;background:var(--panel);padding:24px;text-align:center;font-size:11px;color:var(--text-mute);}
.edl-pdf-root .photo-card{border:1px solid var(--panel-border);border-radius:6px;overflow:hidden;background:#fff;display:flex;flex-direction:column;}
.edl-pdf-root .photo-frame{flex:1;background:#F0F1F5;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:0;}
.edl-pdf-root .photo-frame img{width:100%;height:100%;object-fit:cover;display:block;}
.edl-pdf-root .ph-empty{font-size:10px;color:var(--text-mute);}
.edl-pdf-root .photo-cap{display:flex;align-items:center;gap:6px;padding:5px 8px;background:#fff;border-top:1px solid var(--panel-border);}
.edl-pdf-root .cap-num{font-family:'Menlo','Consolas','Liberation Mono',monospace;font-size:8.5px;color:var(--gold);font-weight:800;}
.edl-pdf-root .cap-lbl{font-size:9px;color:var(--navy);font-weight:600;}

/* ===== SIGNATURES ===== */
.edl-pdf-root .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;}
.edl-pdf-root .sig-card{border:1.2px solid var(--gold);border-radius:8px;padding:10px 12px 12px;background:#fff;}
.edl-pdf-root .sig-pad{height:110px;border-radius:4px;background:#FBFBFD;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:8px;}
.edl-pdf-root .sig-pad img{max-width:100%;max-height:100%;object-fit:contain;}
.edl-pdf-root .sig-empty{font-size:10px;color:var(--text-mute);font-style:italic;}
.edl-pdf-root .sig-caption{font-size:11px;color:var(--navy);}
.edl-pdf-root .sig-caption b{font-weight:800;margin-right:6px;}
.edl-pdf-root .sig-caption span{color:var(--text-mute);font-weight:600;}

.edl-pdf-root .mention{background:#EAF7FF;border-left:3px solid var(--neon-deep);border-radius:4px;padding:12px 14px;font-size:10px;color:var(--text-soft);line-height:1.5;}

/* ===== DOCUMENTS SCANNÉS (pleine page) ===== */
.edl-pdf-root .doc-frame{
  height:222mm;border:1px solid var(--panel-border);border-radius:8px;background:#fff;
  display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4mm;
}
.edl-pdf-root .doc-frame img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;}
.edl-pdf-root .doc-empty{font-size:11px;color:var(--text-mute);font-style:italic;}
.edl-pdf-root .doc-meta{margin-top:6px;font-size:9.5px;color:var(--text-mute);text-align:right;}
`;


// ---------- Rendu principal ----------

export async function generateEdlFinalPdf(m: EdlFinalPdfData, opts: EdlFinalPdfOptions = {}): Promise<Blob> {
  // 0) Extraire les documents scannés des grilles photos : ils sont illisibles
  //    en vignette et sont désormais rendus en pleine page.
  const isDoc = (p: EdlFinalPdfPhoto) => isScannedDocumentVue(p.vue_type);
  const extractedDocs: EdlFinalPdfDocument[] = [
    ...m.photosDepart.filter(isDoc).map((p) => ({ label: `${p.label ?? labelOf(p.vue_type)} — départ`, url: p.url })),
    ...m.photosArrivee.filter(isDoc).map((p) => ({ label: `${p.label ?? labelOf(p.vue_type)} — arrivée`, url: p.url })),
  ];
  const gridDepart = m.photosDepart.filter((p) => !isDoc(p));
  const gridArrivee = m.photosArrivee.filter((p) => !isDoc(p));
  const allDocsRaw = [...(m.documents ?? []), ...extractedDocs].filter((d) => !!d.url);

  // 1) Précharger images en dataURL
  const logoData = (await toDataUrl(logoLigneo)) ?? "";
  const dep = await Promise.all(
    gridDepart.map(async (p) => ({ ...p, url: (await toDataUrl(p.url)) ?? p.url })),
  );
  const arr = await Promise.all(
    gridArrivee.map(async (p) => ({ ...p, url: (await toDataUrl(p.url)) ?? p.url })),
  );
  const sigs = await Promise.all(
    (m.signatures ?? []).map(async (s) => ({ ...s, url: s.url ? ((await toDataUrl(s.url)) ?? s.url) : s.url })),
  );
  const docs = await Promise.all(
    allDocsRaw.map(async (d) => ({ ...d, url: (await toDataUrl(d.url)) ?? d.url })),
  );
  const data: EdlFinalPdfData = { ...m, photosDepart: dep, photosArrivee: arr, signatures: sigs, documents: docs };

  const distance =
    data.kilometrage_depart != null && data.kilometrage_arrivee != null
      ? Math.max(0, data.kilometrage_arrivee - data.kilometrage_depart)
      : null;

  const totalPages = 4 + docs.length;

  // 2) Construction des pages
  const pagesHtml: string[] = [];

  // Page 1 : Couverture
  pagesHtml.push(`
    <div class="page">
      ${renderCoverHeader(logoData, data)}
      ${renderCoverBody(data, distance, { dep: data.photosDepart.length, arr: data.photosArrivee.length }, docs, !!opts.dossier)}
      ${renderFoot(1, totalPages)}
    </div>`);

  // Page 2 : Photos départ
  pagesHtml.push(`
    <div class="page">
      ${renderPageHeader(logoData, data, "État des lieux — Départ", 2, totalPages)}
      ${renderSectionBand("ÉTAT DES LIEUX — DÉPART", `${data.photosDepart.length} photos`)}
      ${renderPhotoGrid(data.photosDepart, 1)}
      ${renderFoot(2, totalPages)}
    </div>`);

  // Page 3 : Photos arrivée
  const arrStart = data.photosDepart.length + 1;
  pagesHtml.push(`
    <div class="page">
      ${renderPageHeader(logoData, data, "État des lieux — Arrivée", 3, totalPages)}
      ${renderSectionBand("ÉTAT DES LIEUX — ARRIVÉE", `${data.photosArrivee.length} photos`)}
      ${renderPhotoGrid(data.photosArrivee, arrStart)}
      ${renderFoot(3, totalPages)}
    </div>`);

  // Page 4 : Signatures
  pagesHtml.push(`
    <div class="page">
      ${renderPageHeader(logoData, data, "Signatures", 4, totalPages)}
      ${renderSignatures(data.signatures)}
      ${renderFoot(4, totalPages)}
    </div>`);

  // Pages suivantes : documents scannés, un par page, en grand format
  docs.forEach((d, i) => {
    pagesHtml.push(`
      <div class="page">
        ${renderPageHeader(logoData, data, d.label, 5 + i, totalPages)}
        ${renderSectionBand(d.label.toUpperCase(), "Document scanné")}
        <div class="doc-frame">${
          d.url ? `<img src="${d.url}" alt="${escape(d.label)}" crossorigin="anonymous" />` : `<div class="doc-empty">Document indisponible</div>`
        }</div>
        ${d.meta ? `<div class="doc-meta">${escape(d.meta)}</div>` : ""}
        ${renderFoot(5 + i, totalPages)}
      </div>`);
  });


  // 3) Monter dans le DOM hors-écran
  const root = document.createElement("div");
  root.className = "edl-pdf-root";
  root.style.cssText = "position:fixed;left:-99999px;top:0;z-index:-1;";
  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);
  const holder = document.createElement("div");
  holder.innerHTML = pagesHtml.join("");
  root.appendChild(holder);
  document.body.appendChild(root);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    );

    // 4) Canvas → jsPDF (A4 210x297)
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    applyLigneoFonts(doc);
    const pageW = 210;
    const pageH = 297;
    const pages = Array.from(root.querySelectorAll<HTMLElement>(".page"));

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) doc.addPage("a4", "portrait");
      doc.addImage(img, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
    }

    return doc.output("blob");
  } finally {
    document.body.removeChild(root);
  }
}
