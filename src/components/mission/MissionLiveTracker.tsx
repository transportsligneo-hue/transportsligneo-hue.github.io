import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMissionRealtime } from "@/hooks/useMissionRealtime";
import { LiveMissionMap } from "@/components/map/LiveMissionMap";
import { Activity, Clock, Navigation, Phone, MessageSquare, Loader2, CheckCircle2, Truck } from "lucide-react";
import { geocodeAddress, computeEta, type GeoPoint } from "@/lib/geocode";

interface MissionLiveTrackerProps {
  attributionId: string;
  showMap?: boolean;
}

const STATUT_LABEL: Record<string, string> = {
  propose: "Convoyeur attribué",
  accepte: "Mission acceptée",
  en_cours: "En route",
  en_attente_validation: "Livré · validation en cours",
  validee: "Mission validée",
  termine: "Mission terminée",
  terminee: "Mission terminée",
  livree: "Véhicule livré",
  annule: "Annulée",
};

const STATUT_DOT: Record<string, string> = {
  propose: "bg-blue-500",
  accepte: "bg-blue-500",
  en_cours: "bg-emerald-500",
  en_attente_validation: "bg-amber-500",
  validee: "bg-emerald-500",
  termine: "bg-emerald-500",
  annule: "bg-red-500",
};

const ETAPES_ORDER: { key: string; label: string }[] = [
  { key: "prise_en_charge", label: "Véhicule récupéré" },
  { key: "edl_depart", label: "Inspection de départ" },
  { key: "en_route", label: "Trajet en cours" },
  { key: "edl_arrivee", label: "Inspection d'arrivée" },
  { key: "signature_arrivee", label: "Signature client" },
  { key: "livraison", label: "Arrivé sur place" },
  { key: "termine", label: "Mission terminée" },
];

const ETAPE_LABELS: Record<string, string> = Object.fromEntries(ETAPES_ORDER.map((e) => [e.key, e.label]));

interface DriverInfo {
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
}

interface VehicleInfo {
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
}

export function MissionLiveTracker({ attributionId, showMap = true }: MissionLiveTrackerProps) {
  const rt = useMissionRealtime(attributionId);
  const [allPoints, setAllPoints] = useState<{ latitude: number; longitude: number; recorded_at: string; accuracy: number | null }[]>([]);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [destination, setDestination] = useState<GeoPoint | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);

  // Load trajet endpoints + driver + vehicle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: attr } = await supabase
        .from("attributions")
        .select("trajet_id, convoyeur_id")
        .eq("id", attributionId)
        .maybeSingle();
      if (!attr) return;
      const [trajetRes, convRes] = await Promise.all([
        attr.trajet_id
          ? supabase.from("trajets_client_safe").select("depart, arrivee, marque, modele, immatriculation").eq("id", attr.trajet_id).maybeSingle()
          : Promise.resolve({ data: null }),
        attr.convoyeur_id
          ? supabase.from("convoyeurs").select("nom, prenom, telephone").eq("id", attr.convoyeur_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const trajet = trajetRes.data as { depart: string; arrivee: string; marque: string | null; modele: string | null; immatriculation: string | null } | null;
      if (trajet) {
        setVehicle({ marque: trajet.marque, modele: trajet.modele, immatriculation: trajet.immatriculation });
        const [o, d] = await Promise.all([geocodeAddress(trajet.depart), geocodeAddress(trajet.arrivee)]);
        if (!cancelled) {
          if (o) setOrigin(o);
          if (d) setDestination(d);
        }
      }
      if (convRes.data) setDriver(convRes.data as DriverInfo);
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

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

  useEffect(() => {
    if (rt.lastGps) {
      setAllPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.recorded_at === rt.lastGps!.recorded_at) return prev;
        return [...prev, rt.lastGps!];
      });
    }
  }, [rt.lastGps]);

  const isFinished = rt.statut === "termine" || rt.statut === "terminee" || rt.statut === "validee" || rt.statut === "livree" || rt.statut === "en_attente_validation";
  const statutLabel = rt.statut ? STATUT_LABEL[rt.statut] ?? rt.statut.replace(/_/g, " ") : "En attente";
  const statutDot = rt.statut ? STATUT_DOT[rt.statut] ?? "bg-slate-400" : "bg-slate-400";
  const etapeLabel = rt.etape_courante && !isFinished ? ETAPE_LABELS[rt.etape_courante] ?? rt.etape_courante.replace(/_/g, " ") : null;
  const currentIdx = rt.etape_courante ? ETAPES_ORDER.findIndex((e) => e.key === rt.etape_courante) : -1;

  const eta = destination && allPoints.length > 0 && !isFinished ? computeEta(allPoints, destination) : null;

  const driverName = driver ? [driver.prenom, driver.nom].filter(Boolean).join(" ") : null;
  const vehicleLabel = vehicle ? [vehicle.marque, vehicle.modele].filter(Boolean).join(" ") : null;

  const etaTime = eta?.etaAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const distLabel = eta
    ? eta.distanceKm < 1
      ? `${Math.round(eta.distanceKm * 1000)} m`
      : `${eta.distanceKm.toFixed(1)} km`
    : null;

  // Confidentialité : après mission terminée, on n'expose pas le tracé détaillé.
  // On décime les points en ~12 jalons pour garder la forme globale du parcours.
  const displayedPoints = (() => {
    if (!isFinished || allPoints.length <= 12) return allPoints;
    const step = Math.ceil(allPoints.length / 12);
    const out = allPoints.filter((_, i) => i % step === 0);
    if (out[out.length - 1] !== allPoints[allPoints.length - 1]) out.push(allPoints[allPoints.length - 1]);
    return out;
  })();

  return (
    <div className="space-y-4">
      {/* Carte immersive + carte flottante Uber-style */}
      <div className="relative">
        {showMap && (
          <LiveMissionMap
            hideOverlay
            points={displayedPoints}
            origin={origin}
            destination={destination}
            className="h-[320px] sm:h-[480px]"
          />
        )}

        {/* Floating Uber card */}
        <div className="absolute left-3 right-3 bottom-3 sm:left-5 sm:right-auto sm:bottom-5 sm:max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-2xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-2xl ring-1 ring-slate-900/5 p-4 space-y-3">
            {/* Statut */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full rounded-full ${statutDot} opacity-70 animate-ping`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statutDot}`} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">{statutLabel}</span>
              {etapeLabel && (
                <span className="ml-auto text-[10px] text-slate-500 truncate max-w-[140px]">{etapeLabel}</span>
              )}
            </div>

            {/* ETA grand format */}
            {eta && !isFinished && (
              <div className="flex items-end gap-3 border-y border-slate-200/70 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Arrivée</p>
                  <p className="font-heading text-3xl font-bold text-slate-900 leading-none mt-1">{etaTime}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1 justify-end"><Clock size={10} /> ETA</p>
                  <p className="font-heading text-lg font-semibold text-slate-800 leading-none mt-1">~{eta.etaMinutes} min</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{distLabel} restants</p>
                </div>
              </div>
            )}

            {isFinished && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-emerald-700">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">Mission livrée · merci !</span>
              </div>
            )}

            {/* Chauffeur + véhicule */}
            {(driverName || vehicleLabel) && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 grid place-items-center text-white font-bold shrink-0 shadow-md">
                  {driverName?.[0]?.toUpperCase() ?? <Truck size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  {driverName && <p className="text-sm font-semibold text-slate-900 truncate">{driverName}</p>}
                  {vehicleLabel && (
                    <p className="text-[11px] text-slate-600 truncate flex items-center gap-1.5">
                      <span>{vehicleLabel}</span>
                      {vehicle?.immatriculation && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] tracking-wider">{vehicle.immatriculation}</span>
                      )}
                    </p>
                  )}
                </div>
                {driver?.telephone && (
                  <div className="flex gap-1.5 shrink-0">
                    <a
                      href={`tel:${driver.telephone}`}
                      aria-label="Appeler le convoyeur"
                      className="h-9 w-9 grid place-items-center rounded-full bg-emerald-500 text-white shadow-md hover:scale-105 transition-transform"
                    >
                      <Phone size={15} />
                    </a>
                    <a
                      href={`sms:${driver.telephone}`}
                      aria-label="Envoyer un SMS"
                      className="h-9 w-9 grid place-items-center rounded-full bg-blue-500 text-white shadow-md hover:scale-105 transition-transform"
                    >
                      <MessageSquare size={15} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Empty state overlay */}
        {showMap && allPoints.length === 0 && currentIdx < 0 && !rt.lastGps && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 backdrop-blur px-4 py-2 shadow-lg border border-white/60 flex items-center gap-2 text-xs text-slate-600">
            <Loader2 size={12} className="animate-spin" />
            En attente du démarrage de la mission
          </div>
        )}
      </div>

      {/* Timeline étapes · sous la carte, mise en page premium */}
      <div className="mission-surface rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Navigation size={14} className="mission-accent" />
          <h3 className="font-heading text-sm mission-text tracking-wider uppercase">Progression de la mission</h3>
        </div>
        <ol className="space-y-2.5">
          {ETAPES_ORDER.map((e, i) => {
            const done = isFinished || (currentIdx >= 0 && i < currentIdx);
            const active = !isFinished && i === currentIdx;
            return (
              <li key={e.key} className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                    done
                      ? "bg-emerald-500 border-emerald-500"
                      : active
                        ? "bg-[#2563eb] border-[#2563eb] animate-pulse shadow-[0_0_0_4px_rgba(37,99,235,0.18)]"
                        : "bg-transparent border-current opacity-30"
                  }`}
                />
                <p className={`text-xs ${active ? "mission-text font-semibold" : done ? "mission-text-soft" : "mission-text-muted"}`}>
                  {e.label}
                </p>
              </li>
            );
          })}
        </ol>

        {rt.lastEtape && (
          <div className="mt-4 pt-3 border-t mission-divider flex items-start gap-2 text-xs">
            <Activity size={12} className="mt-0.5 mission-accent shrink-0" />
            <div className="min-w-0">
              <p className="mission-text-soft">{rt.lastEtape.notes ?? rt.lastEtape.etape}</p>
              <p className="text-[10px] mission-text-muted mt-0.5">{new Date(rt.lastEtape.created_at).toLocaleString("fr-FR")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
