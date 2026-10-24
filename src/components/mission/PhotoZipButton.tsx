import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadPhotosZip, type DownloadablePhoto } from "@/lib/photo-download";

/** Bouton « tout télécharger (ZIP) » : photos en taille réelle, barre de progression verte (pas de spinner). */
export function PhotoZipButton({
  photos, zipName, label = "Tout télécharger (ZIP)", className = "",
}: { photos: DownloadablePhoto[]; zipName: string; label?: string; className?: string }) {
  const [progress, setProgress] = useState<number | null>(null);
  if (!photos.length) return null;
  const run = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (progress !== null) return;
    setProgress(0);
    try {
      await downloadPhotosZip(photos, zipName, (d, t) => setProgress(Math.round((d / t) * 100)));
      toast.success(`${photos.length} photo${photos.length > 1 ? "s" : ""} téléchargée${photos.length > 1 ? "s" : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setTimeout(() => setProgress(null), 600);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={progress !== null}
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-90 dark:text-emerald-300 ${className}`}
    >
      {progress !== null && <span className="absolute inset-y-0 left-0 bg-emerald-500/25 transition-all" style={{ width: `${progress}%` }} />}
      <Download size={12} className="relative" />
      <span className="relative">{progress !== null ? `Préparation… ${progress} %` : `${label} · ${photos.length}`}</span>
    </button>
  );
}
