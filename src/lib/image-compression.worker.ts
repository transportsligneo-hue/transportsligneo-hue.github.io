/// <reference lib="webworker" />
/**
 * Web Worker — compression d'image hors thread principal.
 * Décodage via createImageBitmap + redimensionnement OffscreenCanvas + encodage JPEG.
 * Réponse : { ok: true, blob } ou { ok: false, reason } (le caller fait fallback main thread).
 */
type Req = {
  id: number;
  file: File;
  maxDimension: number;
  quality: number;
  mimeType: string;
};

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, file, maxDimension, quality, mimeType } = e.data;
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
      (self as unknown as Worker).postMessage({ id, ok: false, reason: "no-offscreen" });
      return;
    }
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      (self as unknown as Worker).postMessage({ id, ok: false, reason: "no-ctx" });
      return;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await canvas.convertToBlob({ type: mimeType, quality });
    (self as unknown as Worker).postMessage({ id, ok: true, blob });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      reason: err instanceof Error ? err.message : "worker-error",
    });
  }
};

export {};
