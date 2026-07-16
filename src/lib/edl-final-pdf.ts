/**
 * PDF final mission — dossier complet EDL (design v2 "Dossier de mission").
 *
 * Rendu par HTML → canvas → jsPDF pour reproduire fidèlement le design
 * (fond sombre, glassmorphism, dégradé bleu/cyan). Aucune valeur commerciale,
 * pas de prix ni tarif, uniquement traçabilité.
 *
 * L'API publique (EdlFinalPdfData + generateEdlFinalPdf) reste identique
 * pour ne pas casser les appelants existants.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

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
}

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
  roue_secours: "Roue de secours — kit anti‑crevaison",
  roue_de_secours: "Roue de secours — kit anti‑crevaison",
  tapis_sol: "Tapis de sol",
  tapis_de_sol: "Tapis de sol",
  extincteur: "Extincteur",
  cable_charge: "Câble de charge",
  cable_de_charge: "Câble de charge",
  doubles_cles: "Doubles clés",
  double_cles: "Doubles clés",
  kit_securite: "Kit sécurité",
  triangle: "Triangle de sécurité",
  gilet: "Gilet réfléchissant",
  cric: "Cric",
};
const DEFAULT_EQUIP_KEYS = ["roue_secours", "tapis_sol", "extincteur", "cable_charge", "doubles_cles", "kit_securite"];

const SIG_LABELS: Record<string, string> = {
  driver_start: "Convoyeur — Départ",
  client_start: "Client — Départ",
  driver_end: "Convoyeur — Arrivée",
  client_end: "Client — Arrivée",
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
};

const initialsOf = (prenom?: string | null, nom?: string | null) =>
  `${(prenom?.[0] ?? "").toUpperCase()}${(nom?.[0] ?? "").toUpperCase()}` || "—";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Sépare une adresse "6 rue X, 37520 La Riche" → { street, city }. */
function splitAddress(addr: string): { street: string; city: string } {
  if (!addr) return { street: "—", city: "" };
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { street: addr, city: "" };
  const last = parts[parts.length - 1];
  const cityMatch = last.match(/\d{4,5}\s+(.+)/);
  const city = cityMatch ? cityMatch[1] : last;
  const street = parts.slice(0, -1).join(", ");
  return { street, city };
}

function isTruthy(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "string") return ["true", "oui", "yes", "ok", "présent", "present"].includes(v.toLowerCase());
  if (typeof v === "number") return v > 0;
  return false;
}

/** Icônes SVG inline utilisées dans le template (reprises 1:1 du HTML source). */
const ICONS = {
  camera:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 15l-5-4-4 3-3-2-3 3"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  car:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 17h14M6 17l1-5h10l1 5M8 12V8a4 4 0 0 1 8 0v4"/><circle cx="8" cy="19" r="1.4"/><circle cx="16" cy="19" r="1.4"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>',
  bolt:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
  target:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>',
  pulse:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.4 2.1L8 10.2a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.4c1 .4 2 .6 3 .7a2 2 0 0 1 1.7 2z"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  spare:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/></svg>',
  mat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18"/></svg>',
  fire:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v13M12 22v-2M5 9l14 6M19 9L5 15"/></svg>',
  keys:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  sign:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8M21 7v6"/></svg>',
};

const EQUIP_ICON: Record<string, string> = {
  roue_secours: ICONS.spare,
  tapis_sol: ICONS.mat,
  extincteur: ICONS.fire,
  cable_charge: ICONS.bolt,
  doubles_cles: ICONS.keys,
  kit_securite: ICONS.shield,
};

/** Charge une URL image en dataURL (contourne CORS pour html2canvas). */
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

/** Chunk un tableau en pages de N éléments pour découper la grille photos. */
function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------- Rendu HTML des blocs ----------

function renderHead(logoData: string, m: EdlFinalPdfData): string {
  return `
    <div class="pg-head">
      <div class="pg-brand">
        <img class="pg-logo" src="${logoData}" alt="Transports Ligneo">
        <div>
          <div class="pg-brand-name">Transports Ligneo</div>
          <div class="pg-brand-tag">Dossier de mission</div>
        </div>
      </div>
      <div class="pg-ref">Réf. <b>${escape(m.numero)}</b><br>${escape(fmtDate(m.date_mission))}</div>
    </div>`;
}

function renderFoot(page: number, total: number): string {
  return `<div class="pg-foot"><span>Transports Ligneo — Document confidentiel — Aucune valeur commerciale</span><span>Page ${page}/${total}</span></div>`;
}

function renderHero(m: EdlFinalPdfData, distance: number | null): string {
  const dep = splitAddress(m.depart);
  const arr = splitAddress(m.arrivee);
  const vehName = [m.vehicule?.marque, m.vehicule?.modele].filter(Boolean).join(" ") || "Véhicule";
  const conv = `${m.convoyeur?.prenom ?? ""} ${m.convoyeur?.nom ?? ""}`.trim();
  const badges: string[] = [];
  if (distance != null) badges.push(`${distance} km parcourus`);
  if (m.vehicule?.immatriculation) badges.push(m.vehicule.immatriculation);
  if (conv) badges.push(conv);

  return `
    <div class="hero">
      <div class="status-pill"><span class="dot"></span>Mission terminée</div>
      <div class="hero-title">État des lieux — ${escape(vehName)}</div>
      <div class="hero-sub">Contrôle qualité départ / arrivée, avant et après convoyage</div>
      <div class="hero-badges">${badges.map((b) => `<span>${escape(b)}</span>`).join("")}</div>

      <div class="road-wrap">
        <div class="road-stop start"><b>${escape(dep.city || dep.street)}</b>${escape(dep.street)}</div>
        <div class="road-stop end"><b>${escape(arr.city || arr.street)}</b>${escape(arr.street)}</div>
        <svg viewBox="0 0 320 64" class="road-svg" preserveAspectRatio="none">
          <path d="M6,52 C60,52 60,12 120,12 C180,12 180,44 240,44 C280,44 290,20 314,20" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="3" stroke-linecap="round"/>
          <path d="M6,52 C60,52 60,12 120,12 C180,12 180,44 240,44 C280,44 290,20 314,20" fill="none" stroke="url(#roadGrad)" stroke-width="3" stroke-linecap="round"/>
          <circle cx="6" cy="52" r="4.5" fill="#2FD8FF"/><circle cx="314" cy="20" r="4.5" fill="#E8C077"/>
          <defs><linearGradient id="roadGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#2F6BFF"/><stop offset="100%" stop-color="#2FD8FF"/></linearGradient></defs>
        </svg>
        ${distance != null ? `<div class="road-mid-badge">${distance} KM</div>` : ""}
      </div>
    </div>`;
}

function renderVehicleCard(m: EdlFinalPdfData): string {
  const name = [m.vehicule?.marque, m.vehicule?.modele].filter(Boolean).join(" ") || "Véhicule";
  const badges: string[] = [];
  if (m.vehicule?.energie) badges.push(`<span class="meta-badge">${ICONS.bolt} ${escape(m.vehicule.energie)}</span>`);
  if (m.vehicule?.categorie) badges.push(`<span class="meta-badge">${escape(m.vehicule.categorie)}</span>`);
  return `
    <div class="vehicle-card">
      <div class="vehicle-top-row">
        <div class="vehicle-top">${ICONS.car} Véhicule</div>
        <div class="verified-tag">${ICONS.shield} Contrôlé</div>
      </div>
      <div class="vehicle-name">${escape(name)}</div>
      ${badges.length ? `<div class="vehicle-badges">${badges.join("")}</div>` : ""}
      <div class="id-grid">
        <div class="copy-field"><span><span class="copy-field-label">Immatriculation</span><span class="copy-field-value">${escape(m.vehicule?.immatriculation || "—")}</span></span></div>
        <div class="copy-field"><span><span class="copy-field-label">VIN</span><span class="copy-field-value">${escape(m.vehicule?.vin || "—")}</span></span></div>
      </div>
      <div class="vehicle-footer">
        <span class="footer-stat">${ICONS.target} Départ ${m.kilometrage_depart != null ? m.kilometrage_depart + " km" : "—"}</span>
        <span class="footer-divider"></span>
        <span class="footer-stat">${ICONS.pulse} Arrivée ${m.kilometrage_arrivee != null ? m.kilometrage_arrivee + " km" : "—"}</span>
      </div>
    </div>`;
}

function renderConvoyeurCard(m: EdlFinalPdfData): string {
  const name = `${m.convoyeur?.prenom ?? ""} ${m.convoyeur?.nom ?? ""}`.trim() || "—";
  const init = initialsOf(m.convoyeur?.prenom, m.convoyeur?.nom);
  return `
    <div class="glass-card">
      <div class="conv-head">
        <div class="avatar">${escape(init)}</div>
        <div><div class="conv-name">${escape(name)}</div><div class="conv-role">Convoyeur</div></div>
      </div>
      <div class="contact-line">${ICONS.phone} ${escape(m.convoyeur?.telephone || "—")}</div>
    </div>`;
}

function renderKmCard(m: EdlFinalPdfData, distance: number | null): string {
  return `
    <div class="glass-card">
      <div class="km-top">${ICONS.pulse} Distance parcourue</div>
      <div><span class="km-big">${distance ?? "—"}</span> <span class="km-unit">km</span></div>
      <div class="km-range">
        <span>Départ <b>${m.kilometrage_depart != null ? m.kilometrage_depart + " km" : "—"}</b></span>
        <span>Arrivée <b>${m.kilometrage_arrivee != null ? m.kilometrage_arrivee + " km" : "—"}</b></span>
      </div>
    </div>`;
}

function renderRouteCard(m: EdlFinalPdfData): string {
  const dep = splitAddress(m.depart);
  const arr = splitAddress(m.arrivee);
  const depDisp = dep.city ? `${dep.street}, ${dep.city}` : dep.street;
  const arrDisp = arr.city ? `${arr.street}, ${arr.city}` : arr.street;
  return `
    <div class="glass-card">
      <div class="route-point">
        <div class="route-line-v"></div>
        <div class="route-marker pickup">${ICONS.pin}</div>
        <div><div class="route-label">Enlèvement</div><div class="route-address">${escape(depDisp)}</div></div>
      </div>
      <div class="route-point">
        <div class="route-marker delivery">${ICONS.pin}</div>
        <div><div class="route-label">Livraison</div><div class="route-address">${escape(arrDisp)}</div></div>
      </div>
    </div>`;
}

function renderEquipList(m: EdlFinalPdfData): string {
  const eq = m.equipements ?? {};
  const keys = new Set<string>([...DEFAULT_EQUIP_KEYS, ...Object.keys(eq)]);
  const rows: { key: string; label: string; ok: boolean }[] = [];
  for (const k of keys) {
    const label = EQUIP_LABELS[k] ?? k.replace(/_/g, " ");
    const ok = k in eq ? isTruthy((eq as Record<string, unknown>)[k]) : false;
    rows.push({ key: k, label, ok });
  }
  const okCount = rows.filter((r) => r.ok).length;
  return `
    <div class="section">
      <div class="section-title">
        <div class="ic">${ICONS.check}</div>
        <h2>Équipements véhicule</h2>
        <span class="count">${okCount}/${rows.length} présents</span>
      </div>
      <div class="doc-list">
        ${rows
          .map((r) => {
            const ic = EQUIP_ICON[r.key] ?? ICONS.shield;
            const cls = r.ok ? "ok" : "missing";
            const lab = r.ok ? "Présent" : "Absent";
            return `<div class="doc-row">
              <div class="doc-row-icon ${cls}">${ic}</div>
              <div class="doc-row-title">${escape(r.label)}</div>
              <span class="doc-status ${cls}">${lab}</span>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;
}

function renderPhotoGrid(photos: EdlFinalPdfPhoto[], startIndex: number, total: number): string {
  return `
    <div class="doc-grid">
      ${photos
        .map((p, i) => {
          const idx = startIndex + i;
          const num = String(idx).padStart(2, "0");
          const tot = String(total).padStart(2, "0");
          const label = p.label ?? labelOf(p.vue_type);
          const inner = p.url
            ? `<img src="${p.url}" alt="${escape(label)}" crossorigin="anonymous" />`
            : ICONS.camera;
          return `<div class="shot"><div class="frame">${inner}</div><div class="cap">${escape(label)} <small>${num}/${tot}</small></div></div>`;
        })
        .join("")}
    </div>`;
}

function renderPhotosSection(title: string, photos: EdlFinalPdfPhoto[], chunkPart: EdlFinalPdfPhoto[], startIndex: number, showTitle: boolean): string {
  return `
    <div class="section">
      ${showTitle
        ? `<div class="section-title"><div class="ic">${ICONS.camera}</div><h2>${escape(title)}</h2></div>`
        : ""}
      ${renderPhotoGrid(chunkPart, startIndex, photos.length)}
    </div>`;
}

function renderSignatures(sigs: EdlFinalPdfData["signatures"]): string {
  const byKind = new Map<string, string | null | undefined>();
  for (const s of sigs ?? []) byKind.set(s.kind, s.url);
  const slots: { kind: string; url?: string | null }[] = [
    { kind: "driver_start", url: byKind.get("driver_start") ?? byKind.get("depart") },
    { kind: "client_start", url: byKind.get("client_start") ?? byKind.get("client_depart") },
    { kind: "driver_end", url: byKind.get("driver_end") ?? byKind.get("arrivee") },
    { kind: "client_end", url: byKind.get("client_end") ?? byKind.get("client_arrivee") },
  ];
  return `
    <div class="section">
      <div class="section-title"><div class="ic">${ICONS.sign}</div><h2>Signatures</h2></div>
      <div class="sig-grid">
        ${slots
          .map((s) => {
            const signed = !!s.url;
            const status = signed
              ? `<span class="sig-status">${ICONS.check}Signé</span>`
              : `<span class="sig-status missing">Non signé</span>`;
            const pad = signed
              ? `<div class="sig-pad"><img src="${s.url}" alt="signature" crossorigin="anonymous" /></div>`
              : `<div class="sig-pad"></div>`;
            return `<div class="sig-card"><div class="sig-top"><b>${escape(SIG_LABELS[s.kind] ?? s.kind)}</b>${status}</div>${pad}</div>`;
          })
          .join("")}
      </div>
    </div>`;
}

// ---------- CSS ----------

const CSS = `
:root{
  --bg:#06070c;
  --panel: rgba(255,255,255,0.045);
  --border: rgba(120,180,255,0.14);
  --border-strong: rgba(120,180,255,0.24);
  --blue:#2F6BFF; --cyan:#2FD8FF;
  --text:#EAF3FF; --text-soft:#C7CCDA; --text-mute:#8A93AC; --text-dim:#576388;
  --ok:#34E8B0; --missing:#FF5C7A; --gold:#E8C077;
  --radius:14px;
}
.edl-pdf-root{ font-family:'Inter',system-ui,sans-serif; color:var(--text); -webkit-font-smoothing:antialiased; }
.edl-pdf-root *{ box-sizing:border-box; }
.edl-pdf-root .page{
  width:210mm; min-height:297mm; position:relative;
  background: radial-gradient(520px 320px at 10% -6%, rgba(47,107,255,0.16), transparent 60%),
              radial-gradient(460px 300px at 100% 8%, rgba(47,216,255,0.09), transparent 55%),
              var(--bg);
  padding:16mm 16mm 20mm; overflow:hidden;
}
.edl-pdf-root .pg-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid var(--border);}
.edl-pdf-root .pg-brand{display:flex;align-items:center;gap:11px;}
.edl-pdf-root .pg-logo{width:38px;height:38px;border-radius:10px;object-fit:cover;border:1px solid var(--border-strong);}
.edl-pdf-root .pg-brand-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:var(--text);}
.edl-pdf-root .pg-brand-tag{font-size:9.5px;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;}
.edl-pdf-root .pg-ref{text-align:right;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text-mute);}
.edl-pdf-root .pg-ref b{color:var(--cyan);}
.edl-pdf-root .pg-foot{position:absolute;bottom:10mm;left:16mm;right:16mm;display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border);font-size:9px;color:var(--text-dim);}

.edl-pdf-root .hero{position:relative;margin-bottom:18px;padding:22px 24px 18px;border-radius:18px;background:linear-gradient(160deg, rgba(47,107,255,0.15), rgba(47,216,255,0.05) 60%, rgba(255,255,255,0.02));border:1px solid var(--border-strong);}
.edl-pdf-root .status-pill{display:inline-flex;align-items:center;gap:6px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--ok);background:rgba(52,232,176,0.12);border:1px solid rgba(52,232,176,0.3);padding:5px 11px;border-radius:20px;margin-bottom:12px;}
.edl-pdf-root .status-pill .dot{width:5px;height:5px;border-radius:50%;background:var(--ok);}
.edl-pdf-root .hero-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:21px;letter-spacing:-0.01em;margin-bottom:5px;color:var(--text);}
.edl-pdf-root .hero-sub{font-size:12px;color:var(--text-soft);margin-bottom:14px;}
.edl-pdf-root .hero-badges{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px;}
.edl-pdf-root .hero-badges span{font-size:10.5px;font-weight:600;color:var(--text-soft);background:rgba(255,255,255,0.05);border:1px solid var(--border);padding:4px 10px;border-radius:20px;}

.edl-pdf-root .road-wrap{position:relative;height:56px;margin:0 -4px;}
.edl-pdf-root .road-svg{width:100%;height:100%;overflow:visible;}
.edl-pdf-root .road-stop{position:absolute;top:-2px;font-size:9.5px;color:var(--text-mute);}
.edl-pdf-root .road-stop.start{left:0;}
.edl-pdf-root .road-stop.end{right:0;text-align:right;}
.edl-pdf-root .road-stop b{display:block;color:var(--text);font-size:11px;font-weight:700;margin-bottom:1px;}
.edl-pdf-root .road-mid-badge{position:absolute;left:50%;top:50%;transform:translate(-50%,-58%);font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:#06070c;background:linear-gradient(120deg,#2F6BFF,#2FD8FF);padding:3px 9px;border-radius:20px;}

.edl-pdf-root .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;}
.edl-pdf-root .glass-card{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:15px 17px;}

.edl-pdf-root .section-title{display:flex;align-items:center;gap:8px;margin-bottom:11px;}
.edl-pdf-root .section-title .ic{width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,0.06);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--cyan);}
.edl-pdf-root .section-title .ic svg{width:11px;height:11px;}
.edl-pdf-root .section-title h2{font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;margin:0;color:var(--text);}
.edl-pdf-root .section-title .count{margin-left:auto;font-size:10px;color:var(--text-dim);font-weight:600;background:var(--panel);border:1px solid var(--border);padding:2px 9px;border-radius:20px;}

.edl-pdf-root .vehicle-card{grid-column:1/-1;background:linear-gradient(155deg, rgba(47,107,255,0.11), rgba(255,255,255,0.03));border:1px solid var(--border-strong);border-radius:var(--radius);padding:16px 18px;}
.edl-pdf-root .vehicle-top-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.edl-pdf-root .vehicle-top{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--text-mute);text-transform:uppercase;letter-spacing:.4px;}
.edl-pdf-root .vehicle-top svg{width:12px;height:12px;}
.edl-pdf-root .verified-tag{display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:700;color:var(--ok);background:rgba(52,232,176,0.1);border:1px solid rgba(52,232,176,0.3);padding:3px 8px;border-radius:20px;}
.edl-pdf-root .verified-tag svg{width:10px;height:10px;}
.edl-pdf-root .vehicle-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;margin-bottom:10px;color:var(--text);}
.edl-pdf-root .vehicle-badges{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:13px;}
.edl-pdf-root .meta-badge{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:var(--text-soft);background:rgba(255,255,255,0.05);border:1px solid var(--border);padding:4px 9px;border-radius:20px;}
.edl-pdf-root .meta-badge svg{width:10px;height:10px;}
.edl-pdf-root .id-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:13px;}
.edl-pdf-root .copy-field{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(6,7,12,0.4);border:1px solid var(--border);border-radius:10px;padding:9px 12px;}
.edl-pdf-root .copy-field-label{font-size:8.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:2px;}
.edl-pdf-root .copy-field-value{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text);font-weight:600;letter-spacing:.3px;}
.edl-pdf-root .vehicle-footer{display:flex;align-items:center;gap:9px;padding-top:11px;border-top:1px dashed var(--border);}
.edl-pdf-root .footer-stat{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-soft);font-weight:600;}
.edl-pdf-root .footer-stat svg{width:12px;height:12px;color:var(--cyan);}
.edl-pdf-root .footer-divider{width:1px;height:11px;background:var(--border);}

.edl-pdf-root .conv-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.edl-pdf-root .avatar{width:34px;height:34px;border-radius:10px;flex-shrink:0;background:linear-gradient(140deg,#2F6BFF,#2FD8FF);color:#06070c;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12px;}
.edl-pdf-root .conv-name{font-size:12.5px;font-weight:700;color:var(--text);}
.edl-pdf-root .conv-role{font-size:9.5px;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-top:1px;}
.edl-pdf-root .contact-line{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;color:var(--text-soft);}
.edl-pdf-root .contact-line svg{width:12px;height:12px;color:var(--cyan);}

.edl-pdf-root .km-top{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--text-mute);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;}
.edl-pdf-root .km-top svg{width:12px;height:12px;}
.edl-pdf-root .km-big{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:26px;color:#EAF3FF;}
.edl-pdf-root .km-unit{font-size:11px;color:var(--text-mute);}
.edl-pdf-root .km-range{display:flex;justify-content:space-between;margin-top:11px;font-size:10.5px;color:var(--text-soft);}
.edl-pdf-root .km-range b{color:var(--text);font-family:'JetBrains Mono',monospace;font-weight:600;}

.edl-pdf-root .route-point{position:relative;display:flex;gap:10px;padding-bottom:12px;}
.edl-pdf-root .route-point:last-child{padding-bottom:0;}
.edl-pdf-root .route-line-v{position:absolute;left:11px;top:22px;bottom:-2px;width:0;border-left:1.5px dashed var(--border);}
.edl-pdf-root .route-marker{width:22px;height:22px;border-radius:50%;flex-shrink:0;z-index:1;display:flex;align-items:center;justify-content:center;}
.edl-pdf-root .route-marker.pickup{background:rgba(47,107,255,0.16);color:var(--cyan);border:1px solid rgba(47,107,255,0.4);}
.edl-pdf-root .route-marker.delivery{background:rgba(232,192,119,0.16);color:var(--gold);border:1px solid rgba(232,192,119,0.4);}
.edl-pdf-root .route-marker svg{width:11px;height:11px;}
.edl-pdf-root .route-label{font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);font-weight:700;}
.edl-pdf-root .route-address{font-size:11px;color:var(--text);font-weight:600;margin-top:1px;}

.edl-pdf-root .doc-list{display:flex;flex-direction:column;gap:7px;}
.edl-pdf-root .doc-row{display:flex;align-items:center;gap:11px;background:var(--panel);border:1px solid var(--border);border-radius:11px;padding:10px 13px;}
.edl-pdf-root .doc-row-icon{width:26px;height:26px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.edl-pdf-root .doc-row-icon svg{width:12px;height:12px;}
.edl-pdf-root .doc-row-icon.ok{background:rgba(52,232,176,0.14);color:var(--ok);}
.edl-pdf-root .doc-row-icon.missing{background:rgba(255,92,122,0.14);color:var(--missing);}
.edl-pdf-root .doc-row-title{font-size:11.5px;font-weight:600;color:var(--text);flex:1;}
.edl-pdf-root .doc-status{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:2px 8px;border-radius:6px;}
.edl-pdf-root .doc-status.ok{background:rgba(52,232,176,0.14);color:var(--ok);}
.edl-pdf-root .doc-status.missing{background:rgba(255,92,122,0.14);color:var(--missing);}

.edl-pdf-root .doc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;}
.edl-pdf-root .shot{border-radius:11px;overflow:hidden;border:1px solid var(--border);background:var(--panel);}
.edl-pdf-root .shot .frame{aspect-ratio:4/3;background:repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 14px);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.edl-pdf-root .shot .frame img{width:100%;height:100%;object-fit:cover;display:block;}
.edl-pdf-root .shot .frame svg{width:18px;height:18px;color:var(--text-dim);}
.edl-pdf-root .shot .cap{padding:7px 9px;font-size:10px;font-weight:600;color:var(--text-soft);display:flex;justify-content:space-between;align-items:center;}
.edl-pdf-root .shot .cap small{font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--text-dim);font-weight:500;}

.edl-pdf-root .sig-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
.edl-pdf-root .sig-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
.edl-pdf-root .sig-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.edl-pdf-root .sig-top b{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-soft);font-weight:700;}
.edl-pdf-root .sig-status{display:flex;align-items:center;gap:4px;font-size:8.5px;font-weight:800;color:var(--ok);background:rgba(52,232,176,0.12);padding:2px 8px;border-radius:20px;}
.edl-pdf-root .sig-status.missing{color:var(--missing);background:rgba(255,92,122,0.12);}
.edl-pdf-root .sig-status svg{width:9px;height:9px;}
.edl-pdf-root .sig-pad{height:56px;border:1px dashed var(--border);border-radius:9px;background:rgba(6,7,12,0.3);overflow:hidden;display:flex;align-items:center;justify-content:center;}
.edl-pdf-root .sig-pad img{max-width:100%;max-height:100%;object-fit:contain;filter:invert(1) brightness(1.1);}
.edl-pdf-root .section{margin-bottom:20px;}
`;

// ---------- Rendu principal ----------

export async function generateEdlFinalPdf(m: EdlFinalPdfData): Promise<Blob> {
  // 1) Précharger toutes les images en dataURL (logo + photos + signatures)
  const logoData = (await toDataUrl(logoLigneo)) ?? "";
  const dep = await Promise.all(
    m.photosDepart.map(async (p) => ({ ...p, url: (await toDataUrl(p.url)) ?? p.url })),
  );
  const arr = await Promise.all(
    m.photosArrivee.map(async (p) => ({ ...p, url: (await toDataUrl(p.url)) ?? p.url })),
  );
  const sigs = await Promise.all(
    (m.signatures ?? []).map(async (s) => ({ ...s, url: s.url ? ((await toDataUrl(s.url)) ?? s.url) : s.url })),
  );
  const data: EdlFinalPdfData = { ...m, photosDepart: dep, photosArrivee: arr, signatures: sigs };

  const distance =
    data.kilometrage_depart != null && data.kilometrage_arrivee != null
      ? Math.max(0, data.kilometrage_arrivee - data.kilometrage_depart)
      : null;

  // 2) Découper les photos en pages max 9 (grille 3x3) pour rester dans A4
  const depChunks = data.photosDepart.length ? chunk(data.photosDepart, 9) : [];
  const arrChunks = data.photosArrivee.length ? chunk(data.photosArrivee, 9) : [];

  // Pages : 1 (mission) + N (photos départ) + M (photos arrivée + signatures sur la dernière)
  const photoPages = depChunks.length + arrChunks.length;
  const totalPages = 1 + Math.max(1, photoPages);

  // 3) Construire le HTML complet
  const pagesHtml: string[] = [];
  let pageNum = 1;

  // Page 1 - Mission
  pagesHtml.push(`
    <div class="page">
      ${renderHead(logoData, data)}
      ${renderHero(data, distance)}
      <div class="grid2">
        ${renderVehicleCard(data)}
        ${renderConvoyeurCard(data)}
        ${renderKmCard(data, distance)}
        ${renderRouteCard(data)}
      </div>
      ${renderEquipList(data)}
      ${renderFoot(pageNum, totalPages)}
    </div>`);
  pageNum++;

  // Pages photos départ
  let cursor = 1;
  depChunks.forEach((c, i) => {
    pagesHtml.push(`
      <div class="page">
        ${renderHead(logoData, data)}
        ${renderPhotosSection("Constat photographique — Départ", data.photosDepart, c, cursor, i === 0)}
        ${renderFoot(pageNum, totalPages)}
      </div>`);
    cursor += c.length;
    pageNum++;
  });

  // Pages photos arrivée (signatures sur la dernière page)
  cursor = 1;
  arrChunks.forEach((c, i) => {
    const isLast = i === arrChunks.length - 1;
    pagesHtml.push(`
      <div class="page">
        ${renderHead(logoData, data)}
        ${renderPhotosSection("Constat photographique — Arrivée", data.photosArrivee, c, cursor, i === 0)}
        ${isLast ? renderSignatures(data.signatures) : ""}
        ${renderFoot(pageNum, totalPages)}
      </div>`);
    cursor += c.length;
    pageNum++;
  });

  // Si aucune photo, ajouter au moins une page signatures pour ne pas avoir un doc à 1 page
  if (photoPages === 0) {
    pagesHtml.push(`
      <div class="page">
        ${renderHead(logoData, data)}
        ${renderSignatures(data.signatures)}
        ${renderFoot(pageNum, totalPages)}
      </div>`);
  }

  // 4) Monter hors-écran dans le DOM
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
    // Charger fonts + images
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

    // 5) Canvas → jsPDF (A4 210x297)
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = 210;
    const pageH = 297;
    const pages = Array.from(root.querySelectorAll<HTMLElement>(".page"));

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        backgroundColor: "#06070c",
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
