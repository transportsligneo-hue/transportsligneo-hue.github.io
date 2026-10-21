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

  const [open, setOpen] = useState(false);
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

  const list = (title: string, items?: string[]) =>
    items && items.length > 0 ? (
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2F5FFF]">{title}</p>
        <ul className="space-y-1">
          {items.map((d, i) => (
            <li key={i} className="flex gap-2 text-xs leading-snug text-slate-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F5FFF]/60" />
              {d}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#dfe5f3] bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-gradient-to-r from-[#2f5fff] to-[#7b97ff] px-4 py-3 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/20">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight text-white">Assistant IA</span>
            <span className="block text-[11px] text-white/60">
              {pairs.length > 0 ? `${pairs.length} paire(s) départ / arrivée à comparer` : "Rapport IA disponible"}
            </span>
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
      </button>

      {open && (
        <div className="space-y-3 p-4">
          {reportEnabled && (
            <div className="rounded-xl border border-[#e7ebf3] bg-[#f6f8fc] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[#0b1026]">
                  <FileText className="h-4 w-4 text-[#2F5FFF]" />
                  <span className="text-sm font-semibold">Rapport de l'état des lieux</span>
                </div>
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={loadingReport || !activeInspectionId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F5FFF] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#2450e0] disabled:opacity-50"
                >
                  {loadingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {report ? "Régénérer" : "Générer"}
                </button>
              </div>

              {report && (
                <div className="mt-3 space-y-3">
                  <p className="rounded-lg border border-[#e7ebf3] bg-white p-2.5 text-xs leading-relaxed text-slate-700">{report.resume}</p>
                  {list("Défauts principaux", report.defauts_principaux)}
                  {list("Équipements manquants", report.equipements_manquants)}
                  {list("Recommandations", report.recommandations)}
                </div>
              )}
            </div>
          )}

          {compareEnabled && pairs.length > 0 && (
            <div className="rounded-xl border border-[#e7ebf3] bg-[#f6f8fc] p-3">
              <div className="mb-1 flex items-center gap-2 text-[#0b1026]">
                <GitCompare className="h-4 w-4 text-[#2F5FFF]" />
                <span className="text-sm font-semibold">Comparaison départ / arrivée</span>
              </div>
              <p className="mb-3 text-[11px] text-slate-500">
                L'IA ne signale que les nouveaux défauts visibles à l'arrivée.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {pairs.map(({ vue, depart, arrivee }) => {
                  const c = comparisons[vue];
                  const loading = loadingVue === vue;
                  return (
                    <div key={vue} className="rounded-xl border border-[#e7ebf3] bg-white p-2.5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold capitalize text-[#0b1026]">{vue.replace(/_/g, " ")}</span>
                        <button
                          type="button"
                          onClick={() => handleCompare(vue, depart.url_photo, arrivee.url_photo)}
                          disabled={loading}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2F5FFF]/30 bg-[#2F5FFF]/5 px-2.5 py-1 text-[11px] font-semibold text-[#2F5FFF] transition hover:bg-[#2F5FFF]/10 disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Analyser
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="relative overflow-hidden rounded-lg border border-[#e7ebf3]">
                          <img src={depart.url_photo} alt="Départ" className="block aspect-[4/3] w-full object-cover" />
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-[#0b1026]/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                            Départ
                          </span>
                        </div>
                        <div className="relative overflow-hidden rounded-lg border border-[#e7ebf3]">
                          <img src={arrivee.url_photo} alt="Arrivée" className="block aspect-[4/3] w-full object-cover" />
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-[#2F5FFF]/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
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
                        <div className="mt-2 space-y-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              c.new_damages.length > 0 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            }`}
                          >
                            {c.new_damages.length > 0 ? `${c.new_damages.length} nouveau(x) défaut(s)` : "Aucun nouveau défaut"}
                          </span>
                          <p className="text-[11px] leading-snug text-slate-600">{c.summary || "Aucun changement clair détecté."}</p>
                          {c.new_damages.length > 0 && (
                            <ul className="space-y-0.5 text-[11px] text-amber-800">
                              {c.new_damages.map((d, i) => (
                                <li key={i}>
                                  • {String(d.label).replace(/_/g, " ")} · {Math.round(d.confidence * 100)}%
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
            <p className="rounded-lg border border-dashed border-[#dfe5f3] bg-[#f6f8fc] p-3 text-xs text-slate-500">
              La comparaison sera disponible dès qu'un état des lieux de départ et un d'arrivée auront des vues correspondantes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
