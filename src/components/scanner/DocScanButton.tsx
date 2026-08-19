/**
 * DocScanButton · bouton "Scanner" branché sur le scanner natif
 * (VisionKit iOS / ML Kit Android) via @capgo/capacitor-document-scanner.
 *
 * - Invisible hors app native (le flux existant input file reste utilisé).
 * - Détection de bords, recadrage manuel et multi-pages gérés nativement.
 * - Écran de confirmation post-scan : l'utilisateur revoit ses pages,
 *   supprime celles mal cadrées ou relance le scan avant envoi définitif.
 * - Sur Android, le module ML Kit est téléchargé au premier usage : un
 *   message d'attente clair est affiché pendant l'ouverture.
 */
import { useCallback, useEffect, useState } from "react";
import { ScanLine, Loader2, Trash2, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  isNativeScannerAvailable,
  scanNativeDocument,
  pagesToPdf,
} from "@/lib/native/document-scanner";

interface Props {
  label?: string;
  /** Pages max de la session de scan. */
  maxPages?: number;
  /** Fusionne les pages en un PDF unique avant de les remonter. */
  mergeToPdf?: boolean;
  /** Base du nom de fichier généré. */
  filenameBase?: string;
  /** Reçoit les fichiers validés (JPEG, ou PDF unique si mergeToPdf). */
  onFiles: (files: File[]) => void | Promise<void>;
  className?: string;
}

export function DocScanButton({
  label = "Scanner",
  maxPages = 5,
  mergeToPdf = false,
  filenameBase = "scan",
  onFiles,
  className = "",
}: Props) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<{ file: File; url: string }[]>([]);

  useEffect(() => { setAvailable(isNativeScannerAvailable()); }, []);
  useEffect(() => () => { pages.forEach((p) => URL.revokeObjectURL(p.url)); }, [pages]);

  const launch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await scanNativeDocument({ maxPages, filename: filenameBase });
      if (res.status === "success") {
        setPages(res.files.map((file) => ({ file, url: URL.createObjectURL(file) })));
      } else if (res.status === "error") {
        toast.error("Scanner indisponible", { description: res.message });
      } else if (res.status === "unavailable") {
        toast.info("Le scanner natif est disponible dans l'application mobile Ligneo.");
      }
    } finally {
      setBusy(false);
    }
  }, [maxPages, filenameBase]);

  const confirm = useCallback(async () => {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      const files = pages.map((p) => p.file);
      const out = mergeToPdf ? [await pagesToPdf(files, `${filenameBase}.pdf`)] : files;
      await onFiles(out);
      setPages([]);
    } catch (e) {
      toast.error("Impossible de finaliser le scan", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [pages, mergeToPdf, filenameBase, onFiles]);

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void launch()}
        disabled={busy}
        className={
          className ||
          "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] disabled:opacity-60"
        }
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
        {busy ? "Ouverture du scanner…" : label}
      </button>

      {busy && pages.length === 0 && (
        <div className="fixed inset-0 z-[96] flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1638] via-[#0d1f4e] to-[#132a6b] text-white">
          <div className="relative w-24 h-24">
            <span className="absolute inset-0 rounded-3xl border border-[#4f8cff]/40" />
            <span className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-[#4f8cff] animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center">
              <ScanLine size={30} className="text-[#4f8cff]" />
            </span>
            <span className="absolute left-3 right-3 top-1/2 h-px bg-gradient-to-r from-transparent via-[#2f5fff] to-transparent shadow-[0_0_14px_#2f5fff] animate-pulse" />
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-[#8fb2ff]">Transports Ligneo</p>
          <p className="mt-1.5 text-base font-semibold">Préparation du scanner</p>
          <p className="mt-1 text-xs text-white/60 px-10 text-center">
            Cadrez le document dans la zone lumineuse, la détection des bords est automatique.
          </p>
        </div>
      )}


      {pages.length > 0 && (
        <div className="fixed inset-0 z-[95] bg-[#0b1026]/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 text-white">
            <button
              type="button"
              onClick={() => setPages([])}
              className="p-2 rounded-lg hover:bg-white/10"
              aria-label="Annuler le scan"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#e7c76a]">Vérification</p>
              <p className="text-sm font-semibold">{pages.length} page{pages.length > 1 ? "s" : ""} scannée{pages.length > 1 ? "s" : ""}</p>
            </div>
            <div className="w-9" />
          </div>

          <div className="flex-1 overflow-auto p-4 grid grid-cols-2 gap-3">
            {pages.map((p, i) => (
              <div key={p.url} className="relative rounded-xl overflow-hidden border border-white/15 bg-black/40">
                <img src={p.url} alt={`Page ${i + 1}`} className="w-full h-44 object-contain" />
                <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white">
                  Page {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPages((prev) => prev.filter((_, k) => k !== i))}
                  aria-label={`Supprimer la page ${i + 1}`}
                  className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-black/70 text-red-300 flex items-center justify-center"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/10 grid grid-cols-2 gap-2 safe-bottom">
            <button
              type="button"
              onClick={() => void launch()}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/10 text-white text-sm font-medium disabled:opacity-50"
            >
              <RotateCcw size={15} /> Rescanner
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] text-sm font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Utiliser
            </button>
          </div>
        </div>
      )}
    </>
  );
}
