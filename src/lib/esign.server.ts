/**
 * Cœur serveur de la signature électronique Ligneo.
 * Jamais importé côté navigateur (service_role, secrets, pdf-lib).
 *
 * Niveau : signature électronique SIMPLE au sens du règlement eIDAS n°910/2014
 * (art. 25 : recevable en justice) et de l'art. 1367 du Code civil, renforcée par :
 * lien unique, code à usage unique (SMS/e-mail), consentement explicite,
 * empreinte SHA-256, journal horodaté chaîné et scellement HMAC.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin as typedAdmin } from "@/integrations/supabase/client.server";

// Les tables esign_* ne figurent pas encore dans les types générés.
const supabaseAdmin = typedAdmin as any;

export const BUCKET = "esign-docs";
export const CONSENT_VERSION = "v1-2026-10";
export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_SEND_LIMIT = 3;
export const OTP_VERIFIED_VALID_MIN = 30;
export const SITE_URL = (process.env["PUBLIC_SITE_URL"] || "https://transportsligneo.fr").replace(/\/$/, "");

export function consentText(title: string, hash: string): string {
  return (
    `J'ai lu l'intégralité du document « ${title} » (empreinte numérique SHA-256 : ${hash.slice(0, 16)}…). ` +
    `Je déclare avoir la capacité et le pouvoir de m'engager, et j'accepte de le signer électroniquement en apposant ma signature manuscrite. ` +
    `Je reconnais que cette signature électronique a la même valeur qu'une signature manuscrite (articles 1366 et 1367 du Code civil, règlement européen eIDAS n°910/2014) ` +
    `et j'accepte que les éléments de preuve (journal horodaté, adresse IP, identifiants techniques) soient conservés.`
  );
}

/* ---------------------------- utilitaires crypto ---------------------------- */
export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf as ArrayBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
}
export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}
export function newToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function newOtp(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 1_000_000).padStart(6, "0");
}
export async function hmacSeal(message: string): Promise<string> {
  const secret = process.env["ESIGN_SEAL_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  if (!secret) throw new Error("Clé de scellement absente (ESIGN_SEAL_SECRET).");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("ligneo-esign|" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}
export function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!d) return e;
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}
export function maskPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  return `•• •• •• ${d.slice(-4, -2)} ${d.slice(-2)}`;
}

/* ------------------------------- journal ----------------------------------- */
export async function logEvent(
  requestId: string,
  type: string,
  payload: Record<string, unknown> = {},
  meta: { ip?: string | null; ua?: string | null } = {},
) {
  const { error } = await supabaseAdmin.from("esign_events").insert({
    request_id: requestId,
    type,
    payload,
    ip_address: meta.ip ?? null,
    user_agent: meta.ua ?? null,
    // seq / prev_hash / hash / created_at sont posés par le trigger
    seq: 0,
    prev_hash: "",
    hash: "",
  } as never);
  if (error) throw new Error(`Journal de signature : ${error.message}`);
}

export async function findByToken(token: string) {
  if (!token || token.length < 20) return null;
  const hash = await sha256Text(token);
  const { data } = await supabaseAdmin.from("esign_requests").select("*").eq("token_hash", hash).maybeSingle();
  if (!data) return null;
  // expiration paresseuse
  if ((data.status === "sent" || data.status === "opened") && new Date(data.expires_at) < new Date()) {
    await supabaseAdmin.from("esign_requests").update({ status: "expired" }).eq("id", data.id);
    await logEvent(data.id, "expired", {});
    return { ...data, status: "expired" };
  }
  return data;
}

/* ------------------------------ PDF helpers -------------------------------- */
function win(s: string): string {
  // Helvetica standard = WinAnsi : on remplace ce qui ne passe pas.
  return s
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[→]/g, "->").replace(/[…]/g, "...").replace(/[  ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ€Œœ–—]/g, "?");
}
function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, max: number): string[] {
  const words = win(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
const paris = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "medium" });

export async function buildSignedPdf(opts: {
  original: Uint8Array;
  signaturePng: Uint8Array;
  req: { id: string; title: string; signer_name: string; signer_email: string; signer_company?: string | null; doc_sha256: string; consent_version: string };
  signedAt: string; ip: string | null; method: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(opts.original);
  const page = pdf.addPage([595, 842]);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.18, 0.37, 1), ink = rgb(0.08, 0.11, 0.2), mute = rgb(0.4, 0.44, 0.52);
  let y = 790;
  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: blue });
  page.drawText("Transports Ligneo", { x: 40, y: 815, size: 14, font: b, color: rgb(1, 1, 1) });
  page.drawText("Certificat de signature electronique", { x: 330, y: 816, size: 10, font: f, color: rgb(1, 1, 1) });
  y -= 20;
  page.drawText("Document signe electroniquement", { x: 40, y, size: 18, font: b, color: ink });
  y -= 28;
  const rows: [string, string][] = [
    ["Document", opts.req.title],
    ["Signataire", opts.req.signer_name + (opts.req.signer_company ? ` (${opts.req.signer_company})` : "")],
    ["E-mail du signataire", opts.req.signer_email],
    ["Date et heure de signature", paris(opts.signedAt) + " (heure de Paris)"],
    ["Authentification", opts.method],
    ["Adresse IP", opts.ip ?? "non disponible"],
    ["Empreinte SHA-256 du document avant signature", opts.req.doc_sha256],
    ["Texte de consentement", `version ${opts.req.consent_version} (conserve dans le dossier de preuve)`],
    ["Reference de preuve", opts.req.id],
  ];
  for (const [k, v] of rows) {
    page.drawText(win(k), { x: 40, y, size: 8.5, font: f, color: mute });
    y -= 13;
    for (const line of wrap(v, f, 10, 515)) { page.drawText(line, { x: 40, y, size: 10, font: b, color: ink }); y -= 13; }
    y -= 6;
  }
  y -= 4;
  page.drawText("Signature manuscrite apposee", { x: 40, y, size: 9, font: f, color: mute });
  const img = await pdf.embedPng(opts.signaturePng);
  const w = Math.min(240, img.width), h = (img.height / img.width) * w;
  const hh = Math.min(h, 110), ww = (img.width / img.height) * hh;
  page.drawRectangle({ x: 40, y: y - 14 - hh - 10, width: Math.max(ww, 240) + 20, height: hh + 20, borderColor: rgb(0.82, 0.86, 0.95), borderWidth: 1 });
  page.drawImage(img, { x: 50, y: y - 14 - hh, width: ww, height: hh });
  y -= hh + 50;
  const note = "Cette signature electronique est une signature electronique simple au sens du reglement europeen eIDAS n°910/2014 (art. 25) et de l'article 1367 du Code civil. Le signataire a ete authentifie par un lien personnel a usage unique et un code de verification envoye par " +
    (opts.method.toLowerCase().includes("sms") ? "SMS" : "e-mail") + ". Toute modification ulterieure de ce document est detectable : verifiez-le sur transportsligneo.fr/verifier-signature.";
  for (const line of wrap(note, f, 8.5, 515)) { page.drawText(line, { x: 40, y, size: 8.5, font: f, color: mute }); y -= 11.5; }
  return pdf.save();
}

export async function buildDossierPdf(opts: {
  req: Record<string, any>; events: Record<string, any>[]; chainOk: boolean;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const ink = rgb(0.08, 0.11, 0.2), mute = rgb(0.4, 0.44, 0.52), blue = rgb(0.18, 0.37, 1);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const ensure = (n: number) => { if (y - n < 50) { page = pdf.addPage([595, 842]); y = 800; } };
  const text = (t: string, x: number, size: number, font = f, color = ink) => { page.drawText(win(t), { x, y, size, font, color }); };
  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: blue });
  page.drawText("Transports Ligneo - Dossier de preuve", { x: 40, y: 815, size: 14, font: b, color: rgb(1, 1, 1) });
  y = 775;
  const r = opts.req;
  const info: [string, string][] = [
    ["Document", r.title], ["Reference", r.id], ["Signataire", `${r.signer_name} <${r.signer_email}>`],
    ["Statut", r.status], ["Envoye le", r.sent_at ? paris(r.sent_at) : "-"],
    ["Signe le", r.signed_at ? paris(r.signed_at) : "-"],
    ["Empreinte SHA-256 (document d'origine)", r.doc_sha256], ["Empreinte SHA-256 (document signe)", r.signed_doc_sha256 ?? "-"],
    ["Version du consentement", r.consent_version],
    ["Integrite du journal (chaine d'empreintes)", opts.chainOk ? "VALIDE - aucune modification detectee" : "ALERTE - chaine rompue"],
  ];
  for (const [k, v] of info) {
    ensure(40);
    text(k, 40, 8.5, f, mute); y -= 12;
    for (const l of wrap(v, v.length > 60 ? mono : f, 9, 515)) { ensure(14); page.drawText(l, { x: 40, y, size: 9, font: v.length > 60 ? mono : b, color: ink }); y -= 12; }
    y -= 4;
  }
  ensure(60);
  text("Texte de consentement accepte", 40, 8.5, f, mute); y -= 12;
  for (const l of wrap(r.consent_text, f, 9, 515)) { ensure(14); text(l, 40, 9); y -= 12; }
  y -= 10; ensure(40);
  text("Journal des evenements (horodatage UTC)", 40, 11, b); y -= 18;
  for (const e of opts.events) {
    ensure(70);
    text(`#${e.seq}  ${e.type}`, 40, 9.5, b, blue);
    text(new Date(e.created_at).toISOString(), 330, 8.5, mono, mute); y -= 12;
    const det = [e.ip_address ? `IP ${e.ip_address}` : "", Object.keys(e.payload ?? {}).length ? JSON.stringify(e.payload) : ""].filter(Boolean).join("  ");
    for (const l of wrap(det || "-", f, 8, 515)) { ensure(11); text(l, 52, 8, f, mute); y -= 10; }
    if (e.user_agent) for (const l of wrap(`Appareil : ${e.user_agent}`, f, 7.5, 515).slice(0, 2)) { ensure(10); text(l, 52, 7.5, f, mute); y -= 9; }
    ensure(12); page.drawText(`empreinte ${e.hash}`, { x: 52, y, size: 6.5, font: mono, color: mute }); y -= 14;
  }
  if (r.seal) { ensure(40); y -= 6; text("Sceau (HMAC-SHA256 serveur)", 40, 8.5, f, mute); y -= 12; page.drawText(r.seal, { x: 40, y, size: 7.5, font: mono, color: ink }); }
  return pdf.save();
}

export async function chainOk(requestId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("esign_verify_chain" as never, { _request_id: requestId } as never);
  return data === true;
}

/** Pièces obligatoires manquantes d'un convoyeur (identité, permis, RIB, assurance, KBIS si indépendant). */
export async function missingConvoyeurDocs(convoyeurId: string): Promise<string[]> {
  const { getRequiredConvoyeurDocTypes, normalizeConvoyeurDocType } = await import("@/lib/convoyeur-documents");
  const { data: conv } = await supabaseAdmin.from("convoyeurs").select("type_convoyeur").eq("id", convoyeurId).maybeSingle();
  const { data: docs } = await supabaseAdmin.from("documents_convoyeurs").select("type_document, statut_validation").eq("convoyeur_id", convoyeurId);
  const have = new Set(
    (docs ?? [])
      .filter((d: any) => d.statut_validation !== "refuse" && d.statut_validation !== "a_renvoyer")
      .map((d: any) => normalizeConvoyeurDocType(d.type_document)),
  );
  return getRequiredConvoyeurDocTypes(conv?.type_convoyeur).filter((d) => !have.has(d.key)).map((d) => d.label);
}
