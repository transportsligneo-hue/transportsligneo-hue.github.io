/**
 * Finalisation d'inscription côté client.
 *
 * La confirmation d'email étant active, `signUp` ne renvoie pas de session :
 * les uploads de documents, les emails et la notification admin doivent passer
 * par le endpoint serveur. Best-effort : ne casse jamais le parcours utilisateur.
 */
export type SignupKind = "convoyeur" | "client" | "pro" | "flotte";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 8;
export const ACCEPTED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

/** Pré-validation d'un fichier avant envoi. Retourne un message d'erreur ou null. */
export function validateUploadFile(file: File): string | null {
  const mime = file.type || "";
  const isImage = mime.startsWith("image/");
  if (!isImage && mime !== "application/pdf") {
    return "Format non accepté : utilisez une image (JPG, PNG, HEIC) ou un PDF.";
  }
  if (file.size === 0) return "Le fichier semble vide.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} Mo) — 5 Mo maximum.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export async function finalizeSignup(
  userId: string,
  kind: SignupKind,
  documents?: Record<string, File | null>,
  onProgress?: (percent: number) => void,
): Promise<void> {
  try {
    const form = new FormData();
    form.append("userId", userId);
    form.append("kind", kind);
    let count = 0;
    for (const [type, file] of Object.entries(documents ?? {})) {
      if (!file) continue;
      if (count >= MAX_UPLOAD_FILES) break;
      if (validateUploadFile(file)) continue;
      form.append(`doc_${type}`, file, file.name);
      count += 1;
    }

    if (!onProgress || typeof XMLHttpRequest === "undefined") {
      await fetch("/api/public/signup/finalize", { method: "POST", body: form });
      onProgress?.(100);
      return;
    }

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/public/signup/finalize");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      xhr.onload = () => { onProgress(100); resolve(); };
      xhr.onerror = () => resolve();
      xhr.onabort = () => resolve();
      xhr.send(form);
    });
  } catch (err) {
    console.warn("[finalizeSignup] failed", err);
  }
}
