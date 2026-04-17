/**
 * Compress an image client-side before upload.
 * Targets ~1600px max dimension and JPEG quality 0.78 (~150-300KB per photo).
 * Falls back to the original file if anything goes wrong.
 */
export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number; mimeType?: string } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.78, mimeType = "image/jpeg" } = opts;

  if (!file.type.startsWith("image/")) return file;

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
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );
    if (!blob) return file;

    // If compression made it bigger, keep original
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: mimeType, lastModified: Date.now() });
  } catch (err) {
    console.warn("Image compression failed, using original", err);
    return file;
  }
}
