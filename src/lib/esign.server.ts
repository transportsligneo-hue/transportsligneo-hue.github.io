/**
 * Cœur serveur de la signature électronique Ligneo.
 * Jamais importé côté navigateur (service_role, secrets, pdf-lib).
 *
 * Niveau : signature électronique SIMPLE au sens du règlement eIDAS n°910/2014
 * (art. 25 : recevable en justice) et de l'art. 1367 du Code civil, renforcée par :
 * lien unique, code à usage unique (SMS/e-mail), consentement explicite,
 * empreinte SHA-256, journal horodaté chaîné et scellement HMAC.
 */
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { CONTRAT_BOX_X_RIGHT_MM, CONTRAT_BOX_Y_MM } from "@/lib/contrat-signature-field";
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
  /** Paraphe (initiales) apposé en bas à droite de chaque page du document d'origine. */
  initialsPng?: Uint8Array;
  req: { id: string; title: string; signer_name: string; signer_email: string; signer_company?: string | null; doc_sha256: string; consent_version: string };
  signedAt: string; ip: string | null; method: string;
  /** "contrat_convoyeur" : la signature est aussi apposée dans l'encadré « Pour le prestataire » de la dernière page du contrat. */
  kind?: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(opts.original);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  if (opts.initialsPng) {
    try {
      const ini = await pdf.embedPng(opts.initialsPng);
      const all = pdf.getPages();
      const maxW = 78, maxH = 34;
      const sc = Math.min(maxW / ini.width, maxH / ini.height);
      const iw = ini.width * sc, ih = ini.height * sc;
      // paraphe « au stylo » : encre seule (fond transparent), en bas à droite, juste au-dessus du pied de page
      // légère variation d'une page à l'autre, comme un vrai paraphe fait à la main
      const tilt = [-2.5, 1.2, -1, 2];
      const dy = [0, 2, -1, 1];
      all.forEach((pg, i) => {
        pg.drawImage(ini, { x: pg.getWidth() - iw - 52 + (i % 3), y: 38 + dy[i % 4]!, width: iw, height: ih, rotate: degrees(tilt[i % 4]!) });
      });
    } catch (e) { console.error("[esign] apposition des paraphes", e); }
  }
  if (opts.kind === "contrat_convoyeur") {
    try {
      const pages = pdf.getPages();
      const sp = pages[pages.length - 1]!;
      const k = 72 / 25.4;
      const H = sp.getHeight();
      const bx = CONTRAT_BOX_X_RIGHT_MM, by0 = CONTRAT_BOX_Y_MM; // mêmes repères que le PDF du contrat (mm, depuis le haut)
      const img0 = await pdf.embedPng(opts.signaturePng);
      const maxW = 68 * k, maxH = 19 * k;
      const sc = Math.min(maxW / img0.width, maxH / img0.height);
      const iw = img0.width * sc, ih = img0.height * sc;
      sp.drawImage(img0, { x: (bx + 5) * k, y: H - (by0 + 17) * k - ih, width: iw, height: ih });
      const nav = rgb(0.18, 0.37, 1), mut = rgb(0.5, 0.52, 0.58);
      sp.drawText("Signe electroniquement - lu et approuve", { x: (bx + 5) * k, y: H - (by0 + 36) * k, size: 7.8, font: b, color: nav });
      sp.drawText(win(`Nom : ${opts.req.signer_name}`), { x: (bx + 5) * k, y: H - (by0 + 40.5) * k, size: 6.8, font: f, color: mut });
      sp.drawText(win(`Horodatage : ${paris(opts.signedAt)}${opts.ip ? ` - IP ${opts.ip}` : ""}`), { x: (bx + 5) * k, y: H - (by0 + 44.5) * k, size: 6.8, font: f, color: mut, maxWidth: 70 * k });
    } catch (e) { console.error("[esign] apposition signature sur le contrat", e); }
  }
  const page = pdf.addPage([595, 842]);
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
  const { data: docs } = await supabaseAdmin.from("documents_convoyeurs").select("type_document, statut_validation, created_at").eq("convoyeur_id", convoyeurId);
  const { getDocRenewal, CONVOYEUR_DOC_TYPES } = await import("@/lib/convoyeur-documents");
  const have = new Set(
    (docs ?? [])
      .filter((d: any) => d.statut_validation !== "refuse" && d.statut_validation !== "a_renvoyer")
      // document à renouveler (attestation de vigilance, 6 mois) : périmé = comme absent
      .filter((d: any) => {
        const spec = CONVOYEUR_DOC_TYPES.find((s) => s.key === normalizeConvoyeurDocType(d.type_document));
        const r = spec ? getDocRenewal(spec, d.created_at) : null;
        return !r?.expired;
      })
      .map((d: any) => normalizeConvoyeurDocType(d.type_document)),
  );
  return getRequiredConvoyeurDocTypes(conv?.type_convoyeur).filter((d) => !have.has(d.key)).map((d) => d.label);
}

/* ======================================================================== */
/*  Rétroactivité : re-rendu du paraphe « au stylo » sur les documents déjà signés */
/* ======================================================================== */
import zlib from "node:zlib";

function crc32(buf: Uint8Array): number {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function encodePngRgba(w: number, h: number, rgba: Uint8Array): Uint8Array {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (type: string, data: Uint8Array) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), Buffer.from(data)]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", new Uint8Array())]));
}

/** Retrouve l'image du paraphe dans un PDF signé (première image de la page 1). */
export async function extractInitialsFromSigned(signed: Uint8Array): Promise<Uint8Array | null> {
  const { PDFName, PDFDict, PDFRef, PDFRawStream, PDFNumber } = await import("pdf-lib");
  const pdf = await PDFDocument.load(signed);
  const res = pdf.getPage(0).node.Resources();
  const xo = res?.lookup(PDFName.of("XObject"));
  if (!(xo instanceof PDFDict)) return null;
  for (const [, ref] of xo.entries()) {
    if (!(ref instanceof PDFRef)) continue;
    const st = pdf.context.lookup(ref);
    if (!(st instanceof PDFRawStream)) continue;
    const d = st.dict;
    if (d.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    const w = (d.lookup(PDFName.of("Width")) as any as typeof PDFNumber.prototype).asNumber();
    const h = (d.lookup(PDFName.of("Height")) as any as typeof PDFNumber.prototype).asNumber();
    const rgb3 = zlib.inflateSync(st.contents);
    if (rgb3.length !== w * h * 3) continue;
    const sm = d.get(PDFName.of("SMask"));
    const smStream = sm instanceof PDFRef ? pdf.context.lookup(sm) : null;
    const alpha = smStream instanceof PDFRawStream ? zlib.inflateSync(smStream.contents) : null;
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = rgb3[i * 3]!; rgba[i * 4 + 1] = rgb3[i * 3 + 1]!; rgba[i * 4 + 2] = rgb3[i * 3 + 2]!;
      rgba[i * 4 + 3] = alpha && alpha.length === w * h ? alpha[i]! : 255;
    }
    return encodePngRgba(w, h, rgba);
  }
  return null;
}

/**
 * Document déjà signé avec l'ancien rendu du paraphe (cadre blanc + texte) : le reconstruit une fois,
 * à partir du document d'origine, de la signature et du paraphe retrouvés, puis re-scelle le dossier de preuve.
 * Sans effet si le document est déjà au nouveau rendu ou n'a pas de paraphe.
 */
export async function ensureModernParaphe(requestId: string, meta: { ip?: string | null; ua?: string | null } = {}): Promise<boolean> {
  const { data: r } = await supabaseAdmin.from("esign_requests").select("*").eq("id", requestId).maybeSingle();
  if (!r || r.status !== "signed" || !r.signed_doc_path || !r.signature_path) return false;
  const { data: evs } = await supabaseAdmin.from("esign_events").select("type, ip_address, payload").eq("request_id", requestId).order("seq");
  const events = (evs ?? []) as Array<{ type: string; ip_address: string | null; payload: any }>;
  if (!events.some((e) => e.type === "initials_applied") || events.some((e) => e.type === "paraphe_restyled")) return false;

  const dl = async (p: string) => {
    const x = await supabaseAdmin.storage.from(BUCKET).download(p);
    return x.error || !x.data ? null : new Uint8Array(await x.data.arrayBuffer());
  };
  const [original, oldSigned, sig] = await Promise.all([dl(r.doc_path), dl(r.signed_doc_path), dl(r.signature_path)]);
  if (!original || !oldSigned || !sig) return false;
  const initials = (await dl(`${requestId}/paraphe.png`)) ?? (await extractInitialsFromSigned(oldSigned));
  if (!initials) return false;

  const signedEv = events.find((e) => e.type === "signed");
  const method = signedEv?.payload?.auth === "sms" ? "Lien personnel + code SMS a usage unique" : "Lien personnel + code e-mail a usage unique";
  const rebuilt = await buildSignedPdf({ original, signaturePng: sig, initialsPng: initials, req: r, signedAt: r.signed_at, ip: signedEv?.ip_address ?? null, method, kind: r.kind });
  const newHash = await sha256Bytes(rebuilt);
  await supabaseAdmin.storage.from(BUCKET).upload(`${requestId}/paraphe.png`, initials, { contentType: "image/png", upsert: true });
  const up = await supabaseAdmin.storage.from(BUCKET).upload(r.signed_doc_path, rebuilt, { contentType: "application/pdf", upsert: true });
  if (up.error) return false;
  await supabaseAdmin.from("esign_requests").update({ signed_doc_sha256: newHash }).eq("id", requestId);
  await logEvent(requestId, "paraphe_restyled", { previous_signed_doc_sha256: r.signed_doc_sha256, signed_doc_sha256: newHash, note: "Nouveau rendu du paraphe (encre seule, bas de page)" }, meta);
  const { data: head } = await supabaseAdmin.from("esign_events").select("hash").eq("request_id", requestId).order("seq", { ascending: false }).limit(1).single();
  const seal = await hmacSeal(`${requestId}|${newHash}|${head?.hash}|${r.signed_at}`);
  await supabaseAdmin.from("esign_requests").update({ seal }).eq("id", requestId);
  await logEvent(requestId, "sealed", { chain_head: head?.hash, seal }, meta);
  const { data: fresh } = await supabaseAdmin.from("esign_requests").select("*").eq("id", requestId).single();
  const { data: allEv } = await supabaseAdmin.from("esign_events").select("*").eq("request_id", requestId).order("seq");
  const dossier = await buildDossierPdf({ req: fresh, events: allEv ?? [], chainOk: await chainOk(requestId) });
  const dp = r.dossier_path ?? `${requestId}/dossier-preuve.pdf`;
  await supabaseAdmin.storage.from(BUCKET).upload(dp, dossier, { contentType: "application/pdf", upsert: true });
  await supabaseAdmin.from("esign_requests").update({ dossier_path: dp, dossier_sha256: await sha256Bytes(dossier) }).eq("id", requestId);
  return true;
}
