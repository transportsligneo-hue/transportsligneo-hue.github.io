import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMissionRealtime } from "@/hooks/useMissionRealtime";
import { GpsMapView } from "@/components/GpsMapView";
import { Activity, MapPin, Clock, Truck, CheckCircle2, Loader2 } from "lucide-react";

interface MissionLiveTrackerProps {
  /** ID de l'attribution liée à la mission/demande */
  attributionId: string;
  showMap?: boolean;
}

const STATUT_LABELS: Record<string, { label: string; tone: string }> = {
  propose: { label: "Convoyeur attribué", tone: "bg-slate-100 text-slate-700" },
  accepte: { label: "Mission acceptée", tone: "bg-blue-100 text-blue-700" },
  en_cours: { label: "En cours", tone: "bg-emerald-100 text-emerald-700" },
  en_attente_validation: { label: "En attente validation", tone: "bg-amber-100 text-amber-800" },
  validee: { label: "Validée", tone: "bg-emerald-100 text-emerald-700" },
  termine: { label: "Terminée", tone: "bg-emerald-100 text-emerald-700" },
  annule: { label: "Annulée", tone: "bg-red-100 text-red-700" },
};

const ETAPE_LABELS: Record<string, string> = {
  prise_en_charge: "Prise en charge du véhicule",
  edl_depart: "État des lieux de départ",
  en_route: "En route vers la destination",
  edl_arrivee: "État des lieux d'arrivée",
  livraison: "Livraison en cours",
};

export function MissionLiveTracker({ attributionId, showMap = true }: MissionLiveTrackerProps) {
  const rt = useMissionRealtime(attributionId);
  const [allPoints, setAllPoints] = useState<{ latitude: number; longitude: number; recorded_at: string; accuracy: number | null }[]>([]);

  useEffect(() => {
    if (!showMap) return;
    let cancelled = false;
    supabase
      .from("mission_locations")
      .select("latitude, longitude, recorded_at, accuracy")
      .eq("attribution_id", attributionId)
      .order("recorded_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setAllPoints(data);
      });
    return () => { cancelled = true; };
  }, [attributionId, showMap]);

  // append last GPS in realtime
  useEffect(() => {
    if (rt.lastGps) {
      setAllPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.recorded_at === rt.lastGps!.recorded_at) return prev;
        return [...prev, rt.lastGps!];
      });
    }
  }, [rt.lastGps]);

  const statutMeta = rt.statut ? STATUT_LABELS[rt.statut] ?? { label: rt.statut, tone: "bg-slate-100 text-slate-700" } : null;
  const etapeLabel = rt.etape_courante ? ETAPE_LABELS[rt.etape_courante] ?? rt.etape_courante : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">Suivi en temps réel</h3>
        {statutMeta && (
          <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full ${statutMeta.tone}`}>
            {statutMeta.label}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {etapeLabel && (
          <div className="flex items-center gap-2 text-sm">
            <Truck size={14} className="text-emerald-600" />
            <span className="text-slate-700">{etapeLabel}</span>
          </div>
        )}

        {rt.lastEtape && (
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2">
            <Activity size={12} className="mt-0.5 text-slate-400" />
            <div className="min-w-0">
              <p className="text-slate-700">{rt.lastEtape.notes ?? rt.lastEtape.etape}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(rt.lastEtape.created_at).toLocaleString("fr-FR")}
              </p>
            </div>
          </div>
        )}

        {rt.lastGps && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <MapPin size={12} className="text-emerald-600" />
            <span>Dernière position : {rt.lastGps.latitude.toFixed(4)}, {rt.lastGps.longitude.toFixed(4)}</span>
            <Clock size={11} className="text-slate-400 ml-auto" />
            <span className="text-slate-400">{new Date(rt.lastGps.recorded_at).toLocaleTimeString("fr-FR")}</span>
          </div>
        )}

        {showMap && allPoints.length > 0 && (
          <GpsMapView points={allPoints} className="h-[240px] rounded-lg" />
        )}

        {showMap && allPoints.length === 0 && !rt.lastGps && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-6">
            <Loader2 size={12} className="animate-spin" />
            En attente du démarrage de la mission
          </div>
        )}

        {rt.statut === "termine" && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            <CheckCircle2 size={14} />
            Mission livrée. Merci !
          </div>
        )}
      </div>
    </div>
  );
}
