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

const STATUT_LABELS: Record<string, { label: string; cls: string }> = {
  propose: { label: "Convoyeur attribué", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  accepte: { label: "Mission acceptée", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  en_cours: { label: "En cours", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  en_attente_validation: { label: "En attente de validation", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  validee: { label: "Validée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  termine: { label: "Mission terminée", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  annule: { label: "Annulée", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

// Étapes ordonnées pour la timeline. La clé doit correspondre à
// `attributions.etape_courante` côté conducteur.
const ETAPES_ORDER: { key: string; label: string }[] = [
  { key: "prise_en_charge", label: "Véhicule récupéré" },
  { key: "edl_depart", label: "Inspection de départ" },
  { key: "en_route", label: "Trajet en cours" },
  { key: "edl_arrivee", label: "Inspection d'arrivée" },
  { key: "signature_arrivee", label: "En attente de signature" },
  { key: "livraison", label: "Arrivé au lieu de livraison" },
  { key: "termine", label: "Mission terminée" },
];

const ETAPE_LABELS: Record<string, string> = Object.fromEntries(
  ETAPES_ORDER.map(e => [e.key, e.label])
);

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

  const statutMeta = rt.statut ? STATUT_LABELS[rt.statut] ?? { label: rt.statut, cls: "bg-cream/10 text-cream/70 border-cream/20" } : null;
  const etapeLabel = rt.etape_courante ? ETAPE_LABELS[rt.etape_courante] ?? rt.etape_courante : null;

  // Index de l'étape courante dans la timeline ordonnée. -1 si non démarrée.
  const currentIdx = rt.etape_courante
    ? ETAPES_ORDER.findIndex(e => e.key === rt.etape_courante)
    : -1;
  const isFinished = rt.statut === "termine" || rt.statut === "validee";

  return (
    <div className="card-premium rounded overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/15 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <h3 className="font-heading text-sm text-cream tracking-wider">Suivi en temps réel</h3>
        {statutMeta && (
          <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full border ${statutMeta.cls}`}>
            {statutMeta.label}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {etapeLabel && (
          <div className="flex items-center gap-2 text-sm">
            <Truck size={14} className="text-primary" />
            <span className="text-cream">{etapeLabel}</span>
          </div>
        )}

        {/* Timeline verticale des étapes */}
        <div className="space-y-2">
          {ETAPES_ORDER.map((e, i) => {
            const done = isFinished || (currentIdx >= 0 && i < currentIdx);
            const active = !isFinished && i === currentIdx;
            return (
              <div key={e.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      done
                        ? "bg-emerald-400 border-emerald-400"
                        : active
                          ? "bg-primary border-primary animate-pulse"
                          : "bg-cream/5 border-cream/20"
                    }`}
                  />
                  {i < ETAPES_ORDER.length - 1 && (
                    <span
                      className={`w-px flex-1 mt-1 min-h-[14px] ${
                        done ? "bg-emerald-400/40" : "bg-cream/10"
                      }`}
                    />
                  )}
                </div>
                <p
                  className={`text-xs pb-2 ${
                    active ? "text-cream font-medium" : done ? "text-cream/70" : "text-cream/40"
                  }`}
                >
                  {e.label}
                </p>
              </div>
            );
          })}
        </div>

        {rt.lastEtape && (
          <div className="flex items-start gap-2 text-xs bg-navy/40 border border-primary/10 rounded-md px-3 py-2">
            <Activity size={12} className="mt-0.5 text-primary/70" />
            <div className="min-w-0">
              <p className="text-cream/80">{rt.lastEtape.notes ?? rt.lastEtape.etape}</p>
              <p className="text-[10px] text-cream/40 mt-0.5">
                {new Date(rt.lastEtape.created_at).toLocaleString("fr-FR")}
              </p>
            </div>
          </div>
        )}

        {rt.lastGps && (
          <div className="flex items-center gap-2 text-xs text-cream/70">
            <MapPin size={12} className="text-emerald-400" />
            <span>Position : {rt.lastGps.latitude.toFixed(4)}, {rt.lastGps.longitude.toFixed(4)}</span>
            <Clock size={11} className="text-cream/40 ml-auto" />
            <span className="text-cream/50">{new Date(rt.lastGps.recorded_at).toLocaleTimeString("fr-FR")}</span>
          </div>
        )}

        {showMap && allPoints.length > 0 && (
          <GpsMapView points={allPoints} className="h-[240px] rounded-lg" />
        )}

        {showMap && allPoints.length === 0 && !rt.lastGps && currentIdx < 0 && (
          <div className="flex items-center justify-center gap-2 text-xs text-cream/50 py-6">
            <Loader2 size={12} className="animate-spin" />
            En attente du démarrage de la mission
          </div>
        )}

        {isFinished && (
          <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
            <CheckCircle2 size={14} />
            Mission livrée. Merci de votre confiance !
          </div>
        )}
      </div>
    </div>
  );
}
