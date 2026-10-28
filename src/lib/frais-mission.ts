/**
 * Frais de mission (péage / carburant) · helpers communs convoyeur + admin.
 * Capture par la caméra uniquement, horodatage + GPS, empreintes anti-doublon.
 */
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

export type FraisType = "peage" | "carburant";
export type FraisStatut = "attente" | "valide" | "refuse";

export interface FraisControles {
  camera?: boolean;
  gps?: boolean;
  recent?: boolean;
  tva_ok?: boolean;
  doublons?: string[];
  /** Score 0–1 du détecteur d'IA (null = non analysé). */
  ia?: number | null;
}

export interface FraisMission {
  id: string;
  trajet_id: string;
  attribution_id: string | null;
  convoyeur_id: string;
  type: FraisType;
  montant_ttc: number;
  montant_tva: number;
  photo_path: string | null;
  capture_at: string | null;
  capture_lat: number | null;
  capture_lng: number | null;
  capture_source: string;
  image_sha256: string | null;
  image_ahash: string | null;
  controles: FraisControles;
  statut: FraisStatut;
  motif_refus: string | null;
  refacturer_client: boolean;
  saisi_par_admin: boolean;
  decided_at: string | null;
  created_at: string;
}

export const FRAIS_LABEL: Record<FraisType, string> = { peage: "Péage", carburant: "Carburant" };
export const FRAIS_STATUT_LABEL: Record<FraisStatut, string> = {
  attente: "À valider",
  valide: "Validé",
  refuse: "Refusé",
};

export const eur = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** TVA incluse dans un TTC à 20 % (arrondie au centime). */
export const tvaFromTtc = (ttc: number) => Math.round((ttc / 6) * 100) / 100;

/** Liste lisible des anomalies d'un frais (vide = rien à signaler). */
export function fraisAlertes(f: Pick<FraisMission, "controles" | "saisi_par_admin">): string[] {
  const c = f.controles ?? {};
  const out: string[] = [];
  if (c.camera === false) out.push("Photo non prise par la caméra");
  if (c.gps === false) out.push("Pas de position GPS");
  if (c.recent === false) out.push("Photo trop ancienne");
  if (c.tva_ok === false) out.push("TVA incohérente avec le total");
  if ((c.doublons?.length ?? 0) > 0) out.push("Ticket déjà envoyé (doublon)");
  if (typeof c.ia === "number" && c.ia >= 0.5) out.push(`Image probablement générée par IA (${Math.round(c.ia * 100)} %)`);
  return out;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Empreinte perceptuelle 8x8 (aHash) : détecte un même ticket re-photographié. */
async function aHash(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = 8; c.height = 8;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, 8, 8);
    bmp.close?.();
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const g: number[] = [];
    for (let i = 0; i < 64; i++) g.push((d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000);
    const avg = g.reduce((a, b) => a + b, 0) / 64;
    let bits = "";
    for (const v of g) bits += v >= avg ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export interface PreparedTicket {
  file: File;
  sha256: string;
  ahash: string | null;
  captureAt: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Prépare une photo prise à l'instant : refuse un fichier ancien (galerie),
 * compresse, calcule les empreintes, relève la position.
 */
export async function prepareTicket(raw: File): Promise<PreparedTicket> {
  const ageMin = (Date.now() - raw.lastModified) / 60000;
  if (raw.lastModified && ageMin > 10) {
    throw new Error("Cette photo n'a pas été prise à l'instant. Prenez le ticket avec l'appareil photo.");
  }
  const [file, pos] = await Promise.all([compressImage(raw, { maxDimension: 1800, quality: 0.8 }), getPosition()]);
  const [sha256, ah] = await Promise.all([sha256Hex(file), aHash(file)]);
  return {
    file,
    sha256,
    ahash: ah,
    captureAt: new Date().toISOString(),
    lat: pos?.lat ?? null,
    lng: pos?.lng ?? null,
  };
}

export async function uploadTicket(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  let lastErr: unknown = null;
  for (let i = 0; i < 3; i++) {
    const { error } = await supabase.storage
      .from("frais-tickets")
      .upload(path, file, { contentType: "image/jpeg", upsert: false });
    if (!error) return path;
    lastErr = error;
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Envoi de la photo impossible");
}

export async function signedTicketUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("frais-tickets").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function createFrais(args: {
  trajetId: string;
  attributionId: string;
  convoyeurId: string;
  userId: string;
  type: FraisType;
  ttc: number;
  tva: number;
  ticket: PreparedTicket;
}): Promise<void> {
  const photo_path = await uploadTicket(args.userId, args.ticket.file);
  const { error } = await supabase.from("frais_mission" as never).insert({
    trajet_id: args.trajetId,
    attribution_id: args.attributionId,
    convoyeur_id: args.convoyeurId,
    type: args.type,
    montant_ttc: args.ttc,
    montant_tva: args.tva,
    photo_path,
    capture_at: args.ticket.captureAt,
    capture_lat: args.ticket.lat,
    capture_lng: args.ticket.lng,
    capture_source: "camera",
    image_sha256: args.ticket.sha256,
    image_ahash: args.ticket.ahash,
  } as never);
  if (error) throw new Error(error.message);
}
