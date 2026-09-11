/**
 * ScanToPrefill · bouton "Scanner un document" (bleu électrique) à intégrer sur
 * les formulaires de demande de mission (admin, client, pro).
 *
 * Flow :
 *  1. Clic sur le bouton → scanner automatique (le même que l'état des lieux :
 *     détection de stabilité, capture auto, recadrage 4 coins, redressement).
 *  2. Le document est envoyé à `scanDocumentExtract` (OCR + classification IA).
 *  3. Les champs normalisés remontent au parent via `onExtracted`.
 *
 * Le parent conserve la responsabilité de mapper les champs sur son state.
 */
import { useCallback, useState } from "react";
import { ScanLine, Loader2, Sparkles, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { DocumentScanner } from "@/components/inspection/DocumentScanner";
import { scanDocumentExtract } from "@/lib/scanner/scan-document.functions";
import {
  DOCUMENT_LABEL,
  isValidVinShape, isValidFrenchPlate,
  type ExtractedFields, type ExtractionResult,
} from "@/lib/scanner/types";

interface Props {
  label?: string;
  /** Conservé pour compatibilité : le scanner traite un document à la fois. */
  multiPage?: boolean;
  onExtracted: (fields: ExtractedFields, docs: ExtractionResult[]) => void;
  variant?: "blue" | "gold" | "outline";
  className?: string;
  /** Affiche le petit "?" d'aide à côté du bouton. */
  help?: boolean;
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
  onExtracted,
  variant = "blue",
  className = "",
  help = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const extract = useServerFn(scanDocumentExtract);

  const handleScanned = useCallback(async (file: File) => {
    setOpen(false);
    setProcessing(true);
    const toastId = toast.loading("Lecture du document…");
    try {
      const dataUrl = await blobToDataUrl(file);
      const res = await extract({ data: { image_data_url: dataUrl } });
      if (!res.ok) {
        toast.error(res.error, { id: toastId });
        return;
      }
      const merged = res.extraction.fields as ExtractedFields;
      const filled = Object.values(merged).filter(Boolean).length;
      if (filled === 0) {
        toast.error("Aucune information lisible sur ce document", {
          id: toastId,
          description: "Reprenez la photo bien à plat, sans reflet, document entier dans le cadre.",
        });
        return;
      }

      const warnings: string[] = [];
      if (merged.vin && !isValidVinShape(merged.vin)) warnings.push("VIN à vérifier");
      if (merged.immatriculation && !isValidFrenchPlate(merged.immatriculation))
        warnings.push("Immatriculation à vérifier");

      toast.success(
        `${filled} champ${filled > 1 ? "s" : ""} pré-rempli${filled > 1 ? "s" : ""} · ${DOCUMENT_LABEL[res.extraction.document_type] ?? "Document"}`,
        { id: toastId, description: warnings.length ? `⚠ ${warnings.join(", ")}` : undefined },
      );
      onExtracted(merged, [res.extraction]);
    } catch (err) {
      console.error("[ScanToPrefill] error", err);
      toast.error("Lecture impossible, réessayez", { id: toastId });
    } finally {
      setProcessing(false);
    }
  }, [extract, onExtracted]);

  const baseCls = "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed";
  const blueCls = "bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white shadow-[0_2px_14px_rgba(79,140,255,0.35)] hover:shadow-[0_4px_22px_rgba(79,140,255,0.5)] hover:from-[#4f8cff] hover:to-[#2f5fff]";
  const goldCls = "bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026]";
  const outlineCls = "border border-[#4f8cff]/60 text-[#2f5fff] hover:bg-[#4f8cff]/10";
  const skin = variant === "gold" ? goldCls : variant === "outline" ? outlineCls : blueCls;

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={processing}
        onClick={() => setOpen(true)}
        className={`${baseCls} ${skin} ${className}`}
      >
        {processing ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Lecture…
          </>
        ) : (
          <>
            <ScanLine size={16} />
            {label}
            <Sparkles size={13} className="opacity-70" />
          </>
        )}
      </button>

      {help && (
        <>
          <button
            type="button"
            aria-label="À quoi sert le scan ?"
            onClick={() => setShowHelp((v) => !v)}
            onBlur={() => setTimeout(() => setShowHelp(false), 150)}
            className="p-1 rounded-full text-[#2f5fff]/70 hover:text-[#2f5fff] hover:bg-[#4f8cff]/10 transition"
          >
            <HelpCircle size={16} />
          </button>
          {showHelp && (
            <div className="absolute z-50 top-full right-0 mt-2 w-72 rounded-xl bg-white border border-[#4f8cff]/30 shadow-xl p-3 text-left">
              <p className="text-xs font-semibold text-[#0b1026] mb-1">Scan intelligent du véhicule</p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Photographiez la carte grise, un PV de livraison ou un bon de commande :
                la plaque, le VIN, la marque, le modèle, l'énergie et la couleur sont
                reconnus automatiquement et remplissent le formulaire ci-dessous.
                Vous pouvez tout corriger ensuite.
              </p>
            </div>
          )}
        </>
      )}

      {open && (
        <DocumentScanner
          accent="blue"
          title={label}
          onCancel={() => setOpen(false)}
          onScanned={handleScanned}
        />
      )}
    </div>
  );
}
