import { buildZip, type ZipEntry } from "@/lib/zip-store";

export interface DownloadablePhoto { url: string; name: string }

const safe = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "photo";

function extOf(url: string, mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  const e = url.split("?")[0].split(".").pop() ?? "";
  return /^[a-z0-9]{2,4}$/i.test(e) ? e.toLowerCase() : "jpg";
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

/** Télécharge une photo en taille réelle (fichier d'origine, non redimensionné). */
export async function downloadOnePhoto(p: DownloadablePhoto) {
  const res = await fetch(p.url);
  if (!res.ok) throw new Error("Téléchargement impossible.");
  const blob = await res.blob();
  saveBlob(blob, `${safe(p.name)}.${extOf(p.url, blob.type)}`);
}

/** Télécharge plusieurs photos dans un seul fichier ZIP, en taille réelle. */
export async function downloadPhotosZip(
  photos: DownloadablePhoto[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
) {
  const entries: ZipEntry[] = [];
  const used = new Map<string, number>();
  let done = 0;
  for (const p of photos) {
    try {
      const res = await fetch(p.url);
      if (res.ok) {
        const blob = await res.blob();
        let base = safe(p.name);
        const n = (used.get(base) ?? 0) + 1;
        used.set(base, n);
        if (n > 1) base = `${base}_${n}`;
        entries.push({ name: `${base}.${extOf(p.url, blob.type)}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
    } catch { /* photo ignorée */ }
    onProgress?.(++done, photos.length);
  }
  if (!entries.length) throw new Error("Aucune photo n'a pu être téléchargée.");
  saveBlob(buildZip(entries), `${safe(zipName)}.zip`);
}
