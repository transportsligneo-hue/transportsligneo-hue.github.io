/**
 * Compression image côté client.
 *
 * Chemin rapide (préféré) : Web Worker + OffscreenCanvas → aucun blocage du
 * main thread, la caméra peut immédiatement passer à la photo suivante.
 * Chemin de secours : main-thread `<canvas>` (compatibilité maximale, y
 * compris WebViews Android anciennes et Safari < 17).
 *
 * Timeout dur : quel que soit le chemin, si la compression dépasse
 * MAX_TIMEOUT_MS on renvoie le fichier original pour ne jamais bloquer l'EDL.
 */

const MAX_TIMEOUT_MS = 8000;

// ─── Worker path ───────────────────────────────────────────────────────────
type WorkerReq = { id: number; blob: Blob; maxDimension: number; quality: number; mimeType: string };
type WorkerResp = { id: number; ok: true; blob: Blob } | { id: number; ok: false; error: string };

let _worker: Worker | null = null;
let _workerBroken = false;
let _reqId = 0;
const _pending = new Map<number, (r: WorkerResp) => void>();

function getWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (_workerBroken) return null;
  if (_worker) return _worker;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
    _worker = new Worker(new URL("./workers/image-worker.ts", import.meta.url), { type: "module" });
    _worker.onmessage = (e: MessageEvent<WorkerResp>) => {
      const cb = _pending.get(e.data.id);
      if (cb) { _pending.delete(e.data.id); cb(e.data); }
    };
    _worker.onerror = () => {
      _workerBroken = true;
      try { _worker?.terminate(); } catch { /* noop */ }
      _worker = null;
      // Notifie les callbacks encore en attente.
      _pending.forEach((cb, id) => cb({ id, ok: false, error: "worker-error" }));
      _pending.clear();
    };
    return _worker;
  } catch {
    _workerBroken = true;
    return null;
  }
}

function compressInWorker(req: Omit<WorkerReq, "id">): Promise<Blob | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const id = ++_reqId;
  return new Promise((resolve) => {
    _pending.set(id, (r) => resolve(r.ok ? r.blob : null));
    try {
      w.postMessage({ id, ...req } satisfies WorkerReq);
    } catch {
      _pending.delete(id);
      resolve(null);
    }
  });
}

// ─── Main-thread fallback ──────────────────────────────────────────────────
let _queue: Promise<unknown> = Promise.resolve();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}

async function doCompressMain(
  file: File, maxDimension: number, quality: number, mimeType: string,
): Promise<Blob | null> {
  let bitmap: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.(); bitmap = null;
    return await new Promise<Blob | null>((resolve) =>
      canvas!.toBlob(resolve, mimeType, quality),
    );
  } catch {
    return null;
  } finally {
    try { bitmap?.close?.(); } catch { /* noop */ }
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number; mimeType?: string } = {},
): Promise<File> {
  const { maxDimension = 1600, quality = 0.78, mimeType = "image/jpeg" } = opts;
  if (!file.type.startsWith("image/")) return file;

  // 1) Tentative worker (non-bloquant, parallélisable).
  const workerBlob = await withTimeout(
    compressInWorker({ blob: file, maxDimension, quality, mimeType }),
    MAX_TIMEOUT_MS,
  );
  if (workerBlob && workerBlob.size < file.size) {
    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([workerBlob], newName, { type: mimeType, lastModified: Date.now() });
  }

  // 2) Fallback main-thread, queue mono-thread pour éviter les pics mémoire.
  const run = _queue.then(() =>
    withTimeout(doCompressMain(file, maxDimension, quality, mimeType), MAX_TIMEOUT_MS),
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
