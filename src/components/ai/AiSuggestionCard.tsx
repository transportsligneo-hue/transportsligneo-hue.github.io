/**
 * Carte d'une suggestion IA : miniature + overlay + actions.
 * L'IA ne persiste JAMAIS elle-même : l'utilisateur confirme ou rejette.
 */
import { Check, X, Pencil } from "lucide-react";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";
import type { DamageDetection } from "@/lib/ai/types";

const LABEL_FR: Record<string, string> = {
  rayure: "Rayure", bosse: "Bosse", impact: "Impact",
  eclat_peinture: "Éclat peinture", jante_abimee: "Jante abîmée",
  pare_brise_fissure: "Pare-brise fissuré", optique_cassee: "Optique cassée",
  retroviseur_endommage: "Rétroviseur endommagé", pare_chocs: "Pare-chocs",
  capot: "Capot", aile: "Aile", portiere: "Portière", coffre: "Coffre",
  toit: "Toit", bas_de_caisse: "Bas de caisse",
};

export function AiSuggestionCard({
  imageUrl,
  detection,
  onConfirm,
  onEdit,
  onIgnore,
}: {
  imageUrl: string;
  detection: DamageDetection;
  onConfirm: () => void;
  onEdit?: () => void;
  onIgnore: () => void;
}) {
  const label = LABEL_FR[detection.label] ?? detection.label;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="relative overflow-hidden rounded-lg bg-black/40">
        <img src={imageUrl} alt={label} className="block w-full h-auto" />
        <BoundingBoxOverlay
          boxes={[{ bbox: detection.bbox, label, confidence: detection.confidence }]}
        />
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{label}</p>
          <p className="text-xs text-white/60 truncate">
            {Math.round(detection.confidence * 100)}% · {detection.zone ?? detection.description ?? "Défaut détecté"}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={onIgnore}
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Ignorer"
          >
            <X className="h-4 w-4" />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-emerald-500/90 p-1.5 text-white hover:bg-emerald-500"
            aria-label="Confirmer"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
