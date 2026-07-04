/**
 * Compression image côté client — main-thread, robuste sur mobile.
 *
 * NB: on a essayé un Web Worker + OffscreenCanvas mais certains navigateurs
 * mobiles (Samsung Internet, WebViews Android, Safari < 17) plantent
 * silencieusement au milieu d'une séquence de photos (freeze après ~6-8 clichés).
 * On repasse donc en main-thread avec :
 *  - timeout dur (8s) pour ne jamais bloquer le flow EDL
 *  - queue mono-thread (1 compression à la fois) pour éviter les pics mémoire
 *  - libération immédiate du bitmap et du canvas
 */

const MAX_TIMEOUT_MS = 8000;

let _queue: Promise<unknown> = Promise.resolve();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      }
    );
  });
}

async function doCompress(
  file: File,
  maxDimension: number,
  quality: number,
  mimeType: string
): Promise<Blob | null> {
  let bitmap: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    bitmap = null;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas!.toBlob(resolve, mimeType, quality)
    );
    return blob;
  } catch {
    return null;
  } finally {
    try {
      bitmap?.close?.();
    } catch {
      /* noop */
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number; mimeType?: string } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.78, mimeType = "image/jpeg" } = opts;
  if (!file.type.startsWith("image/")) return file;

  // Queue mono-thread : une seule compression à la fois pour éviter les pics
  // mémoire (chaque bitmap plein-format ~= 20-40 Mo sur un téléphone récent).
  const run = _queue.then(() =>
    withTimeout(doCompress(file, maxDimension, quality, mimeType), MAX_TIMEOUT_MS)
  );
  _queue = run.catch(() => undefined);

  try {
    const blob = await run;
    if (!blob) return file;
    if (blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
  } catch (err) {
    console.warn("[image-compression] fallback original:", err);
    return file;
  }
}
