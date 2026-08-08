/**
 * Scanner de documents natif (VisionKit iOS / ML Kit Android) — gratuit.
 *
 * Ce module est 100 % optionnel : hors coquille Capacitor il renvoie
 * `{ available: false }` et l'appelant garde son composant web existant
 * (PremiumScanner ou input file). Aucun impact sur le site public.
 *
 * Le plugin est importé dynamiquement pour ne jamais alourdir le bundle web.
 */
import { isNativeApp, nativePlatform } from "./bridge";

export type ScanOutcome =
  | { status: "unavailable" }
  | { status: "cancelled" }
  | { status: "error"; message: string }
  | { status: "success"; files: File[] };

export interface NativeScanOptions {
  /** Nombre maximum de pages (1 = document simple). */
  maxPages?: number;
  /** Préfixe du nom de fichier généré. */
  filename?: string;
}

/** Le scanner natif est-il utilisable sur cet appareil ? */
export function isNativeScannerAvailable(): boolean {
  return isNativeApp() && nativePlatform() !== "web";
}

function base64ToFile(b64: string, name: string): File {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: "image/jpeg" });
}

/**
 * Ouvre le scanner natif et renvoie les pages sous forme de File JPEG.
 * Ne lance jamais : renvoie toujours un ScanOutcome exploitable.
 */
export async function scanNativeDocument(opts: NativeScanOptions = {}): Promise<ScanOutcome> {
  if (!isNativeScannerAvailable()) return { status: "unavailable" };
  const max = Math.min(24, Math.max(1, opts.maxPages ?? 5));
  const base = (opts.filename ?? "scan").replace(/[^a-zA-Z0-9_-]/g, "_");

  try {
    const mod = await import("@capgo/capacitor-document-scanner");
    const { DocumentScanner, ResponseType } = mod;
    const res = await DocumentScanner.scanDocument({
      letUserAdjustCrop: true,
      croppedImageQuality: 100,
      maxNumDocuments: max,
      responseType: ResponseType.Base64,
    });

    const images = res.scannedImages ?? [];
    if (!images.length) return { status: "cancelled" };

    const stamp = Date.now();
    const files = images.map((img, i) => base64ToFile(img, `${base}-${stamp}-${i + 1}.jpg`));
    return { status: "success", files };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scanner indisponible";
    // Annulation utilisateur remontée en exception sur certaines versions natives.
    if (/cancel/i.test(message)) return { status: "cancelled" };
    console.warn("[nativeScanner]", message);
    return { status: "error", message };
  }
}

/**
 * Fusionne plusieurs pages images en un seul PDF (utile quand le back-end
 * attend un document unique). Renvoie le File original si une seule page.
 */
export async function pagesToPdf(files: File[], filename = "document.pdf"): Promise<File> {
  if (files.length === 1) return files[0];
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  for (const [i, file] of files.entries()) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: pw, h: ph });
      img.src = dataUrl;
    });
    const ratio = Math.min((pw - 40) / dims.w, (ph - 40) / dims.h);
    const w = dims.w * ratio;
    const h = dims.h * ratio;
    if (i > 0) doc.addPage();
    doc.addImage(dataUrl, "JPEG", (pw - w) / 2, (ph - h) / 2, w, h, undefined, "FAST");
  }

  const blob = doc.output("blob");
  return new File([blob], filename, { type: "application/pdf" });
}
