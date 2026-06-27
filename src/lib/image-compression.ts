/**
 * Compress an image client-side before upload.
 * Targets ~1600px max dimension and JPEG quality 0.78 (~150-300KB per photo).
 *
 * Stratégie perf :
 *  - Compression dans un Web Worker (OffscreenCanvas) → ne bloque pas le thread UI.
 *  - Fallback main-thread (createImageBitmap + canvas) si Worker / OffscreenCanvas indisponible.
 *  - Fallback final : fichier original retourné tel quel.
 *
 * Worker partagé et lazy (créé au premier appel, réutilisé ensuite).
 */

let _worker: Worker | null = null;
let _workerBroken = false;
let _reqId = 0;
const _pending = new Map<number, (msg: { ok: boolean; blob?: Blob; reason?: string }) => void>();

function getWorker(): Worker | null {
  if (_workerBroken) return null;
  if (_worker) return _worker;
  if (typeof Worker === "undefined") return null;
  try {
    _worker = new Worker(new URL("./image-compression.worker.ts", import.meta.url), {
      type: "module",
    });
    _worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; blob?: Blob; reason?: string }>) => {
      const cb = _pending.get(e.data.id);
      if (cb) {
        _pending.delete(e.data.id);
        cb(e.data);
      }
    };
    _worker.onerror = () => {
      _workerBroken = true;
      _worker?.terminate();
      _worker = null;
    };
    return _worker;
  } catch {
    _workerBroken = true;
    return null;
  }
}

function compressInWorker(
  file: File,
  maxDimension: number,
  quality: number,
  mimeType: string
): Promise<Blob | null> {
  const worker = getWorker();
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = ++_reqId;
    const timeout = setTimeout(() => {
      _pending.delete(id);
      resolve(null);
    }, 15000);
    _pending.set(id, (msg) => {
      clearTimeout(timeout);
      resolve(msg.ok && msg.blob ? msg.blob : null);
    });
    try {
      worker.postMessage({ id, file, maxDimension, quality, mimeType });
    } catch {
      _pending.delete(id);
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

async function compressOnMainThread(
  file: File,
  maxDimension: number,
  quality: number,
  mimeType: string
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );
  } catch {
    return null;
  }
}

export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number; mimeType?: string } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.78, mimeType = "image/jpeg" } = opts;
  if (!file.type.startsWith("image/")) return file;

  try {
    // 1) Tentative Worker (non bloquant pour l'UI)
    let blob = await compressInWorker(file, maxDimension, quality, mimeType);
    // 2) Fallback main-thread si Worker indispo
    if (!blob) blob = await compressOnMainThread(file, maxDimension, quality, mimeType);
    if (!blob) return file;
    // 3) Si compression a grossi le fichier, garder l'original
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
  } catch (err) {
    console.warn("Image compression failed, using original", err);
    return file;
  }
}
