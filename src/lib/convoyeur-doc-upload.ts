/**
 * Dépôt de documents convoyeur : contrôles avant envoi, préparation du fichier
 * et envoi fiable (reprise automatique si le réseau coupe).
 * Les mêmes garde-fous existent en base (propriétaire, statut, doublons).
 */

export const DOC_MAX_OCTETS = 10 * 1024 * 1024;
const DOC_MIN_OCTETS = 8 * 1024;
const IMAGE_MIN_PX = 700;
const IMAGE_MAX_PX = 2400;

export type FichierPrepare = { file: File; mime: string; sha256: string; taille: number };

/** Type réel du fichier, lu dans ses premiers octets (un .pdf renommé en .jpg est détecté). */
async function typeReel(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(8, 4))) return "image/heic";
  return null;
}

function chargerImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });
}

/** Photo trop lourde : redimensionnée et compressée (envoi plus rapide en 4G, toujours lisible). */
async function optimiserImage(file: File, img: HTMLImageElement): Promise<File> {
  const grand = Math.max(img.naturalWidth, img.naturalHeight);
  if (grand <= IMAGE_MAX_PX && file.size <= 2.5 * 1024 * 1024) return file;
  const r = Math.min(1, IMAGE_MAX_PX / grand);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * r);
  canvas.height = Math.round(img.naturalHeight * r);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob || blob.size >= file.size) return file;
  const nom = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  return new File([blob], nom, { type: "image/jpeg", lastModified: Date.now() });
}

export async function empreinteSha256(file: Blob): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Vérifie et prépare un fichier avant envoi. Lève une erreur au message clair
 * pour le convoyeur si le fichier ne convient pas.
 */
export async function preparerDocument(file: File): Promise<FichierPrepare> {
  if (file.size === 0) throw new Error("Le fichier est vide. Reprenez la photo ou choisissez un autre fichier.");
  if (file.size > DOC_MAX_OCTETS) throw new Error(`Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} Mo). 10 Mo maximum : utilisez le scanner intégré ou une photo.`);
  const mime = await typeReel(file);
  if (!mime) throw new Error("Format non reconnu. Envoyez une photo (JPG, PNG, HEIC) ou un PDF.");
  if (file.size < DOC_MIN_OCTETS) throw new Error("Fichier trop petit pour être lisible. Reprenez une photo nette du document entier.");

  let final = file;
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
    let img: HTMLImageElement;
    try { img = await chargerImage(file); } catch { throw new Error("Image illisible ou abîmée. Reprenez la photo."); }
    if (Math.max(img.naturalWidth, img.naturalHeight) < IMAGE_MIN_PX) {
      throw new Error("Photo trop petite pour être lue par l'équipe. Prenez le document en entier, bien éclairé, sans zoom numérique.");
    }
    final = await optimiserImage(file, img);
  }
  const typeFinal = final === file ? mime : final.type;
  return { file: final, mime: typeFinal, sha256: await empreinteSha256(final), taille: final.size };
}

/** Répète une opération réseau en cas de coupure (3 essais, délai croissant). */
export async function avecReprise<T>(op: () => Promise<T>, essais = 3): Promise<T> {
  let derniere: unknown;
  for (let i = 0; i < essais; i++) {
    try { return await op(); } catch (e) {
      derniere = e;
      const msg = String((e as { message?: string })?.message ?? e);
      // erreur définitive (droits, fichier refusé) : inutile de réessayer
      if (/DOC_REFUS|row-level|permission|not allowed|Payload too large|duplicate/i.test(msg)) break;
      if (i < essais - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1) ** 2));
    }
  }
  throw derniere;
}

/** Message lisible pour une erreur d'envoi. */
export function messageErreurDepot(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  const i = msg.indexOf("DOC_REFUS:");
  if (i >= 0) return msg.slice(i + 10).trim();
  if (/Failed to fetch|NetworkError|network|timeout/i.test(msg)) return "Connexion perdue pendant l'envoi. Vérifiez votre réseau et réessayez.";
  return msg || "Envoi impossible. Réessayez dans un instant.";
}
