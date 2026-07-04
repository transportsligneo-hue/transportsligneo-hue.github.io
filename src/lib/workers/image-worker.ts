/**
 * Web Worker de compression d'images.
 * Utilise OffscreenCanvas quand dispo pour libérer le main thread.
 * Aucune régression : le hook `compressImage` retombe sur le main-thread si
 * ce worker plante ou n'est pas supporté.
 */
/// <reference lib="webworker" />

export type CompressRequest = {
  id: number;
  blob: Blob;
  maxDimension: number;
  quality: number;
  mimeType: string;
};

export type CompressResponse =
  | { id: number; ok: true; blob: Blob }
  | { id: number; ok: false; error: string };

self.onmessage = async (e: MessageEvent<CompressRequest>) => {
  const { id, blob, maxDimension, quality, mimeType } = e.data;
  try {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    // @ts-expect-error OffscreenCanvas typed globally on workers
    const canvas: OffscreenCanvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error("no-2d-context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const out: Blob = await canvas.convertToBlob({ type: mimeType, quality });
    const resp: CompressResponse = { id, ok: true, blob: out };
    (self as unknown as Worker).postMessage(resp);
  } catch (err) {
    const resp: CompressResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(resp);
  }
};

export {};
