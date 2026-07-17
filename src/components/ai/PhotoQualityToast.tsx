/**
 * PhotoQualityToast — retour non-bloquant sur la qualité d'une photo.
 * Utilisé après capture ; l'utilisateur peut toujours valider quand même.
 */
import { AlertTriangle, X } from "lucide-react";
import type { PhotoQuality } from "@/lib/ai/types";

export function PhotoQualityToast({
  quality,
  onDismiss,
  onRetake,
}: {
  quality: PhotoQuality;
  onDismiss: () => void;
  onRetake?: () => void;
}) {
  const hasIssue = quality.is_blurry || quality.is_too_dark || quality.is_badly_framed || quality.advice.length > 0;
  if (!hasIssue) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[92%] max-w-md rounded-xl border border-amber-400/40 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Amélioration possible</p>
          <ul className="mt-1 space-y-0.5 text-xs text-white/80">
            {quality.is_blurry && <li>• Photo floue.</li>}
            {quality.is_too_dark && <li>• Luminosité insuffisante.</li>}
            {quality.is_badly_framed && <li>• Cadrage à revoir.</li>}
            {quality.advice.slice(0, 3).map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
          <div className="mt-2 flex gap-2">
            {onRetake && (
              <button
                type="button"
                onClick={onRetake}
                className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-300"
              >
                Refaire
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Valider quand même
            </button>
          </div>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Fermer">
          <X className="h-4 w-4 text-white/60" />
        </button>
      </div>
    </div>
  );
}
