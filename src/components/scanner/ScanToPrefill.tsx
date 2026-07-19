/**
 * ScanToPrefill · bouton "Scanner un document" premium à intégrer sur les
 * formulaires de création de mission (admin, client, pro).
 *
 * Flow :
 *  1. L'utilisateur tape le bouton doré → PremiumScanner s'ouvre.
 *  2. Il capture un ou plusieurs documents.
 *  3. On envoie chaque page à `scanDocumentExtract` (OCR + classification IA).
 *  4. On fusionne toutes les extractions via `mergeExtractions`.
 *  5. On renvoie l'objet normalisé `ExtractedFields` au parent via `onExtracted`.
 *
 * Rétrocompatible : ne modifie AUCUN formulaire tant qu'il n'est pas branché.
 * Le parent conserve la responsabilité de mapper les champs sur son state local.
 */
import { useCallback, useState } from "react";
import { ScanLine, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { PremiumScanner } from "./PremiumScanner";
import { scanDocumentExtract } from "@/lib/scanner/scan-document.functions";
import {
  mergeExtractions, DOCUMENT_LABEL,
  isValidVinShape, isValidFrenchPlate,
  type ExtractedFields, type ExtractionResult,
} from "@/lib/scanner/types";

interface Props {
  label?: string;
  multiPage?: boolean;
  onExtracted: (fields: ExtractedFields, docs: ExtractionResult[]) => void;
  variant?: "gold" | "outline";
  className?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function ScanToPrefill({
  label = "Scanner un document",
  multiPage = true,
  onExtracted,
  variant = "gold",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const extract = useServerFn(scanDocumentExtract);

  const handleCapture = useCallback(async (pages: Blob[]) => {
    if (pages.length === 0) {
      setOpen(false);
      return;
    }
    setProcessing(true);
    setOpen(false);
    const toastId = toast.loading(
      pages.length > 1 ? `Analyse de ${pages.length} documents…` : "Analyse du document…"
    );
    try {
      const results: ExtractionResult[] = [];
      for (const [i, blob] of pages.entries()) {
        const dataUrl = await blobToDataUrl(blob);
        toast.loading(`Extraction ${i + 1}/${pages.length}…`, { id: toastId });
        const res = await extract({ data: { image_data_url: dataUrl } });
        if (!res.ok) {
          console.warn("[ScanToPrefill] extraction failed", res.error);
          toast.error(`Page ${i + 1} : ${res.error}`);
          continue;
        }
        results.push(res.extraction);
      }
      if (results.length === 0) {
        toast.error("Aucune donnée extraite", { id: toastId });
        return;
      }
      const merged = mergeExtractions(results);

      // Warnings intelligents
      const warnings: string[] = [];
      if (merged.vin && !isValidVinShape(merged.vin)) warnings.push("VIN suspect");
      if (merged.immatriculation && !isValidFrenchPlate(merged.immatriculation))
        warnings.push("Immatriculation non standard");

      const types = results.map((r) => DOCUMENT_LABEL[r.document_type]).join(", ");
      const filled = Object.values(merged).filter(Boolean).length;
      toast.success(`${filled} champs pré-remplis · ${types}`, {
        id: toastId,
        description: warnings.length ? `⚠ ${warnings.join(", ")}` : undefined,
      });
      onExtracted(merged, results);
    } catch (err) {
      console.error("[ScanToPrefill] error", err);
      toast.error("Extraction impossible", { id: toastId });
    } finally {
      setProcessing(false);
    }
  }, [extract, onExtracted]);

  const baseCls = "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed";
  const goldCls = "bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] shadow-[0_2px_12px_rgba(212,175,55,0.35)] hover:shadow-[0_4px_20px_rgba(212,175,55,0.5)] hover:from-[#e7c76a] hover:to-[#d4af37]";
  const outlineCls = "border border-[#d4af37]/60 text-[#d4af37] hover:bg-[#d4af37]/10";

  return (
    <>
      <button
        type="button"
        disabled={processing}
        onClick={() => setOpen(true)}
        className={`${baseCls} ${variant === "gold" ? goldCls : outlineCls} ${className}`}
      >
        {processing ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Analyse IA…
          </>
        ) : (
          <>
            <ScanLine size={16} />
            {label}
            <Sparkles size={13} className="opacity-70" />
          </>
        )}
      </button>

      {open && (
        <PremiumScanner
          title={label}
          hint="Cadrez le document dans le rectangle"
          multiPage={multiPage}
          onCancel={() => setOpen(false)}
          onCapture={handleCapture}
        />
      )}
    </>
  );
}
