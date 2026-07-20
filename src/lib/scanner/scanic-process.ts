/**
 * scanic-process.ts · post-traitement d'une capture façon Adobe Scan.
 *
 * Wrapper browser-only autour de https://github.com/marquaye/scanic :
 * détecte les 4 coins du document dans un Blob JPEG, applique la
 * correction de perspective, et renvoie un nouveau Blob JPEG « à plat ».
 *
 * Si scanic échoue (pas de document détecté, image floue, WASM KO, etc.)
 * on retombe silencieusement sur le Blob d'origine — le pipeline n'est
 * jamais bloqué par cette amélioration.
 *
 * Import dynamique : scanic charge du WASM et NE DOIT PAS être évalué côté
 * serveur (SSR TanStack Start). Toujours appelé depuis un handler client.
 */

const MAX_OUTPUT_WIDTH = 2200;
const JPEG_QUALITY = 0.92;

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
    return img;
  } finally {
    // On garde l'URL vivante jusqu'à la fin du décode ; libère juste après.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function fitCanvas(source: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  const w = (source as HTMLCanvasElement).width ?? (source as HTMLImageElement).naturalWidth;
  const h = (source as HTMLCanvasElement).height ?? (source as HTMLImageElement).naturalHeight;
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / Math.max(w, h));
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

export interface ScanicResult {
  blob: Blob;
  /** true si scanic a bien redressé le document, false si on renvoie le Blob d'origine. */
  enhanced: boolean;
  /** Message diag pour le devtool si non-amélioré. */
  reason?: string;
}

/**
 * Redresse un Blob de photo de document via scanic.
 * En cas d'échec (rien détecté, wasm KO, timeout…), renvoie le blob source.
 */
export async function enhanceDocumentCapture(input: Blob): Promise<ScanicResult> {
  if (typeof window === "undefined") return { blob: input, enhanced: false, reason: "ssr" };
  try {
    // Import dynamique — évite tout eval WASM côté serveur.
    const scanic = await import("scanic");
    const img = await blobToImage(input);

    const result = await scanic.scanDocument(img, { mode: "extract", output: "canvas" });
    if (!result?.success || !result.output) {
      return { blob: input, enhanced: false, reason: "no-document" };
    }

    const output = result.output as HTMLCanvasElement;
    const fitted = fitCanvas(output);
    const blob = await canvasToJpegBlob(fitted);
    return { blob, enhanced: true };
  } catch (err) {
    console.warn("[scanic] enhancement failed, using raw image:", err);
    return { blob: input, enhanced: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
