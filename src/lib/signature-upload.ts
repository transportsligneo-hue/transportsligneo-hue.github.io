/**
 * Sauvegarde robuste des signatures de mission.
 *
 * - Retry automatique (3 tentatives, backoff progressif) sur l'upload storage
 *   ET sur l'écriture en base (mission_signatures).
 * - Messages d'erreur explicites (réseau, taille, permissions).
 * - Anti-empilement : un seul toast d'erreur signature à la fois (id fixe).
 */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const SIGNATURE_TOAST_ID = "signature-save";

/** Taille max acceptée pour un PNG de signature (2 Mo). */
const MAX_BYTES = 2 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function explain(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();
  if (!navigator.onLine) return "Aucune connexion internet. Reconnectez-vous puis revalidez.";
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout"))
    return "Réseau instable : la signature n'a pas pu être transmise. Réessayez dans quelques secondes.";
  if (msg.includes("payload") || msg.includes("too large") || msg.includes("413"))
    return "Signature trop volumineuse pour être envoyée. Effacez puis resignez plus simplement.";
  if (msg.includes("row-level security") || msg.includes("permission") || msg.includes("401") || msg.includes("403"))
    return "Accès refusé : votre session a peut-être expiré. Reconnectez-vous puis revalidez.";
  return raw || "Erreur inconnue lors de l'enregistrement.";
}

/** Affiche une erreur signature sans jamais empiler plusieurs toasts identiques. */
export function toastSignatureError(err: unknown) {
  toast.error("Signature non enregistrée", {
    id: SIGNATURE_TOAST_ID,
    description: explain(err),
  });
}

export function toastSignatureSuccess(message = "Signature enregistrée") {
  toast.success(message, { id: SIGNATURE_TOAST_ID });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(600 * (i + 1));
    }
  }
  throw lastErr ?? new Error("Échec après plusieurs tentatives");
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Lecture de la signature impossible"));
    r.readAsDataURL(file);
  });
}

export interface SaveSignatureInput {
  attributionId: string;
  kind: string;
  signerName: string;
  file: File;
  signedByUserId?: string;
  /** Upload aussi le PNG dans le bucket mission-documents. */
  uploadToStorage?: boolean;
}

/**
 * Enregistre une signature (storage optionnel + base). Lance en cas d'échec réel
 * après retries — l'appelant décide de l'UI, mais l'erreur est déjà explicite.
 */
export async function saveMissionSignature(input: SaveSignatureInput): Promise<void> {
  const { attributionId, kind, signerName, file, signedByUserId, uploadToStorage } = input;

  if (file.size > MAX_BYTES) {
    throw new Error("Signature trop volumineuse (payload too large)");
  }

  if (uploadToStorage) {
    const path = `${attributionId}/signature_${kind}_${Date.now()}.png`;
    await withRetry(async () => {
      const { error } = await supabase.storage
        .from("mission-documents")
        .upload(path, file, { upsert: true, contentType: "image/png" });
      if (error) throw error;
    });
  }

  const dataUrl = await fileToDataUrl(file);
  if (!dataUrl) throw new Error("Signature illisible, resignez svp");

  await withRetry(async () => {
    const payload: Record<string, unknown> = {
      attribution_id: attributionId,
      kind,
      signer_name: signerName,
      signature_data: dataUrl,
    };
    if (signedByUserId) payload.signed_by_user_id = signedByUserId;
    const { error } = await supabase
      .from("mission_signatures" as never)
      .upsert(payload as never, { onConflict: "attribution_id,kind" });
    if (error) throw error;
  });
}
