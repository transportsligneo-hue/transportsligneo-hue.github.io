/**
 * AdminMissionAiPanel · outils IA côté admin, fiche mission.
 * - Comparaison IA départ/arrivée (par vue_type)
 * - Génération d'un rapport IA structuré
 *
 * Aucun effet sur la persistance : les résultats s'affichent inline.
 * Chaque action nécessite que la capacité correspondante soit activée
 * dans `ai_settings` (via /admin/parametres-ia).
 */
import { useMemo, useState } from "react";
import { Sparkles, Loader2, GitCompare, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAiCapability } from "@/lib/ai/context";
import { compareEdl } from "@/lib/ai/compare-edl.functions";
import { generateEdlReport, type AiReport } from "@/lib/ai/generate-report.functions";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";
import type { EdlComparison } from "@/lib/ai/types";
import { toast } from "sonner";

type Photo = { id: string; vue_type: string; url_photo: string };
type Inspection = { id: string; type: string; photos: Photo[] };

function normalizeVue(vueType: string): string {
  const m = vueType.match(/^([a-z_]+?)(?:_\d{10,})?$/);
  return m ? m[1] : vueType;
}

export function AdminMissionAiPanel({
  inspections,
}: {
  inspections: Inspection[];
}) {
  const compareEnabled = useAiCapability("compare_departure_arrival");
  const reportEnabled = useAiCapability("auto_report");
  const runCompare = useServerFn(compareEdl);
  const runReport = useServerFn(generateEdlReport);

  const [open, setOpen] = useState(true);
  const [comparisons, setComparisons] = useState<Record<string, EdlComparison>>({});
  const [loadingVue, setLoadingVue] = useState<string | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Construit les paires départ / arrivée par vue_type normalisé
  const pairs = useMemo(() => {
    const dep = inspections.find((i) => i.type === "depart");
    const arr = inspections.find((i) => i.type === "arrivee");
    if (!dep || !arr) return [] as Array<{ vue: string; depart: Photo; arrivee: Photo }>;
    const depMap = new Map<string, Photo>();
    for (const p of dep.photos) {
      if (p.vue_type.startsWith("signature")) continue;
      depMap.set(normalizeVue(p.vue_type), p);
    }
    const out: Array<{ vue: string; depart: Photo; arrivee: Photo }> = [];
    for (const p of arr.photos) {
      if (p.vue_type.startsWith("signature")) continue;
      const key = normalizeVue(p.vue_type);
      const d = depMap.get(key);
      if (d) out.push({ vue: key, depart: d, arrivee: p });
    }
    return out;
  }, [inspections]);

  const activeInspectionId = useMemo(
    () => inspections.find((i) => i.type === "arrivee")?.id ?? inspections[0]?.id ?? null,
    [inspections],
  );

  if (!compareEnabled && !reportEnabled) return null;

  const handleCompare = async (vue: string, depUrl: string, arrUrl: string) => {
    setLoadingVue(vue);
    try {
      const res = await runCompare({ data: { departure_image_url: depUrl, arrival_image_url: arrUrl, zone: vue } });
      if (res.ok) {
        setComparisons((prev) => ({ ...prev, [vue]: res.comparison }));
      } else {
        toast.error("Comparaison IA impossible", { description: res.error });
      }
    } catch (err) {
      toast.error("Erreur IA", { description: err instanceof Error ? err.message : "" });
    } finally {
      setLoadingVue(null);
    }
  };

  const handleReport = async () => {
    if (!activeInspectionId) return;
    setLoadingReport(true);
    try {
      const res = await runReport({ data: { inspection_id: activeInspectionId } });
      if (res.ok) setReport(res.report);
      else toast.error("Rapport IA indisponible", { description: res.error });
    } catch (err) {
      toast.error("Erreur IA", { description: err instanceof Error ? err.message : "" });
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 shadow-inner">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900 shadow-md">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">Assistant IA</span>
            <span className="block text-[11px] text-white/60">
              {pairs.length > 0 ? `${pairs.length} paire(s) départ/arrivée` : "Rapport IA disponible"}
            </span>
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {reportEnabled && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <FileText className="h-4 w-4 text-amber-300" />
                  <span className="text-sm font-semibold">Rapport IA</span>
                </div>
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={loadingReport || !activeInspectionId}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-50"
                >
                  {loadingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {report ? "Régénérer" : "Générer"}
                </button>
              </div>

              {report && (
                <div className="mt-3 space-y-3 text-xs text-white/80">
                  <p className="rounded-md bg-white/5 p-2 leading-relaxed">{report.resume}</p>
                  {report.defauts_principaux?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        Défauts principaux
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {report.defauts_principaux.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                  {report.equipements_manquants?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        Équipements manquants
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {report.equipements_manquants.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                  {report.recommandations?.length > 0 && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                        Recommandations
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {report.recommandations.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {compareEnabled && pairs.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-white">
                <GitCompare className="h-4 w-4 text-amber-300" />
                <span className="text-sm font-semibold">Comparaison Départ / Arrivée</span>
              </div>
              <p className="mb-3 text-[11px] text-white/50">
                L'IA remonte uniquement les nouveaux défauts visibles à l'arrivée.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {pairs.map(({ vue, depart, arrivee }) => {
                  const c = comparisons[vue];
                  const loading = loadingVue === vue;
                  return (
                    <div key={vue} className="rounded-lg border border-white/10 bg-slate-950/40 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-medium text-white/80">{vue.replace(/_/g, " ")}</span>
                        <button
                          type="button"
                          onClick={() => handleCompare(vue, depart.url_photo, arrivee.url_photo)}
                          disabled={loading}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-300/10 disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Comparer
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="relative overflow-hidden rounded-md border border-white/10">
                          <img src={depart.url_photo} alt="Départ" className="block h-full w-full object-cover" />
                          <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] uppercase text-white/90">
                            Départ
                          </span>
                        </div>
                        <div className="relative overflow-hidden rounded-md border border-white/10">
                          <img src={arrivee.url_photo} alt="Arrivée" className="block h-full w-full object-cover" />
                          <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] uppercase text-white/90">
                            Arrivée
                          </span>
                          {c && c.new_damages.length > 0 && (
                            <BoundingBoxOverlay
                              boxes={c.new_damages.map((d) => ({
                                bbox: d.bbox,
                                label: String(d.label),
                                confidence: d.confidence,
                              }))}
                            />
                          )}
                        </div>
                      </div>
                      {c && (
                        <div className="mt-2 space-y-1 text-[11px] text-white/70">
                          <p className="rounded-md bg-white/5 p-1.5">{c.summary || "Aucun changement clair détecté."}</p>
                          {c.new_damages.length > 0 && (
                            <ul className="list-disc space-y-0.5 pl-4 text-amber-200">
                              {c.new_damages.map((d, i) => (
                                <li key={i}>
                                  {String(d.label).replace(/_/g, " ")} · {Math.round(d.confidence * 100)}%
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {compareEnabled && pairs.length === 0 && (
            <p className="rounded-lg bg-white/5 p-3 text-xs text-white/50">
              La comparaison sera disponible dès qu'un EDL départ ET un EDL arrivée avec des vues correspondantes seront présents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
