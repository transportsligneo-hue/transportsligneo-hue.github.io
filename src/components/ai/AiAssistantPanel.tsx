/**
 * AiAssistantPanel · panneau latéral repliable d'assistance IA.
 * NON obligatoire : ne s'affiche que si `useAiCapability("smart_suggestions")` = true.
 * Aucune modification directe du state EDL : appelle les callbacks fournis.
 */
import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useAiCapability } from "@/lib/ai/context";
import { AiSuggestionCard } from "./AiSuggestionCard";
import type { DamageDetection } from "@/lib/ai/types";

export type AiSuggestion = {
  id: string;
  imageUrl: string;
  detection: DamageDetection;
};

export function AiAssistantPanel({
  suggestions,
  loading,
  onConfirm,
  onIgnore,
  onEdit,
  title = "Assistant IA",
}: {
  suggestions: AiSuggestion[];
  loading?: boolean;
  onConfirm: (s: AiSuggestion) => void;
  onIgnore: (s: AiSuggestion) => void;
  onEdit?: (s: AiSuggestion) => void;
  title?: string;
}) {
  const enabled = useAiCapability("smart_suggestions");
  const [open, setOpen] = useState(true);

  if (!enabled) return null;

  return (
    <aside className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 shadow-xl backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900 shadow-md">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">{title}</span>
            <span className="block text-[11px] text-white/60">
              {loading ? "Analyse en cours…" : `${suggestions.length} suggestion(s)`}
            </span>
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-xs text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              L'IA analyse vos photos…
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <p className="rounded-lg bg-white/5 p-3 text-xs text-white/60">
              Aucune suggestion pour l'instant. Ajoutez ou améliorez vos photos pour obtenir de l'assistance.
            </p>
          )}
          {suggestions.map(s => (
            <AiSuggestionCard
              key={s.id}
              imageUrl={s.imageUrl}
              detection={s.detection}
              onConfirm={() => onConfirm(s)}
              onIgnore={() => onIgnore(s)}
              onEdit={onEdit ? () => onEdit(s) : undefined}
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-white/40">
        L'IA suggère uniquement. Vous gardez toujours le dernier mot avant validation.
      </p>
    </aside>
  );
}
