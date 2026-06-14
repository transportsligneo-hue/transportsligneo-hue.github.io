/**
 * MissionTrackingPanel — module Suivi de Mission lecture seule pour tous les
 * espaces clients (Particulier / B2B / Flotte).
 *
 * Affiche : convoyeur, GPS live + carte + timeline, photos EDL classées,
 * signatures horodatées, historique chronologique complet, incidents,
 * documents partagés. Aucune action d'édition / suppression.
 *
 * Sécurité : RLS Supabase (is_mission_client) garantit que le client ne lit
 * que ses propres données — aucune logique côté UI ne peut bypasser ça.
 */
import { Activity, AlertTriangle, CheckCircle2, Circle, Mail, Phone, Truck } from "lucide-react";
import { MissionLiveTracker } from "@/components/mission/MissionLiveTracker";
import { MissionClientGallery } from "@/components/mission/MissionClientGallery";
import { MissionTraceability } from "@/components/mission/MissionTraceability";
import { useMissionTrackingData } from "@/hooks/useMissionTrackingData";

interface Props {
  attributionId: string;
  trajetId: string | null;
  convoyeurId: string | null;
  onProofsAvailable?: (has: boolean) => void;
}

const ETAPE_LABELS: Record<string, string> = {
  prise_en_charge: "Véhicule récupéré",
  edl_depart: "Inspection de départ",
  en_route: "Trajet en cours",
  pause: "Pause",
  reprise: "Reprise du trajet",
  edl_arrivee: "Inspection d'arrivée",
  signature_arrivee: "En attente de signature",
  livraison: "Arrivé au lieu de livraison",
  termine: "Mission terminée",
};

const etapeLabel = (k: string) => ETAPE_LABELS[k] ?? k.replace(/_/g, " ");

const GRAVITE_TONE: Record<string, string> = {
  mineur: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  moyen: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  grave: "bg-red-500/15 text-red-300 border-red-500/30",
  critique: "bg-red-600/20 text-red-200 border-red-600/40",
};

export function MissionTrackingPanel({ attributionId, trajetId, convoyeurId, onProofsAvailable }: Props) {
  const { convoyeur, history, incidents, startedAt, endedAt } = useMissionTrackingData(attributionId, convoyeurId);

  return (
    <div className="space-y-5">
      {/* Convoyeur */}
      {convoyeur && (convoyeur.prenom || convoyeur.nom) && (
        <div className="card-premium p-5 rounded">
          <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
            <Truck size={16} /> Intervenant
          </h2>
          <p className="text-cream font-medium text-sm">
            {convoyeur.prenom} {convoyeur.nom}
          </p>
          {convoyeur.ville && <p className="text-cream/50 text-xs mt-0.5">{convoyeur.ville}</p>}
          <div className="mt-3 space-y-1.5 text-sm">
            {convoyeur.telephone && (
              <a
                href={`tel:${convoyeur.telephone}`}
                className="flex items-center gap-2 text-cream/75 hover:text-primary transition-colors"
              >
                <Phone size={13} /> {convoyeur.telephone}
              </a>
            )}
            {convoyeur.email && (
              <a
                href={`mailto:${convoyeur.email}`}
                className="flex items-center gap-2 text-cream/75 hover:text-primary transition-colors"
              >
                <Mail size={13} /> {convoyeur.email}
              </a>
            )}
          </div>
          {(startedAt || endedAt) && (
            <div className="mt-4 pt-3 border-t border-primary/10 grid grid-cols-2 gap-3 text-xs">
              {startedAt && (
                <div>
                  <p className="text-cream/40 text-[10px] uppercase tracking-wider">Début</p>
                  <p className="text-cream/85 mt-0.5">{new Date(startedAt).toLocaleString("fr-FR")}</p>
                </div>
              )}
              {endedAt && (
                <div>
                  <p className="text-cream/40 text-[10px] uppercase tracking-wider">Fin</p>
                  <p className="text-cream/85 mt-0.5">{new Date(endedAt).toLocaleString("fr-FR")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Suivi temps réel : GPS + timeline + ETA */}
      <MissionLiveTracker attributionId={attributionId} />

      {/* Photos / signatures / docs / carte grise */}
      <MissionClientGallery
        attributionId={attributionId}
        trajetId={trajetId}
        onProofsAvailable={onProofsAvailable}
      />

      {/* Double signature horodatée (départ + arrivée) */}
      <MissionTraceability attributionId={attributionId} variant="full" />

      {/* Historique chronologique complet */}
      <div className="card-premium p-5 rounded">
        <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
          <Activity size={16} /> Historique de la mission
        </h2>
        {history.length === 0 ? (
          <p className="text-cream/50 text-xs">Aucun événement enregistré pour le moment.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((h, idx) => {
              const isLast = idx === history.length - 1;
              const done = h.etape === "termine" || h.etape === "livraison" || !isLast;
              return (
                <li key={h.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    {done ? (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Circle size={12} className="text-primary shrink-0 animate-pulse" />
                    )}
                    {idx < history.length - 1 && <span className="w-px flex-1 mt-1 min-h-[14px] bg-cream/10" />}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-cream/90 text-sm">{etapeLabel(h.etape)}</p>
                    {h.notes && <p className="text-cream/60 text-xs mt-0.5">{h.notes}</p>}
                    <p className="text-cream/40 text-[10px] mt-0.5">{new Date(h.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Incidents éventuels (lecture seule) */}
      {incidents.length > 0 && (
        <div className="card-premium p-5 rounded">
          <h2 className="font-heading text-sm text-primary tracking-[0.15em] uppercase flex items-center gap-2 mb-4">
            <AlertTriangle size={16} /> Incidents ({incidents.length})
          </h2>
          <ul className="space-y-3">
            {incidents.map((i) => (
              <li key={i.id} className="bg-navy/40 border border-primary/10 rounded px-3 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${GRAVITE_TONE[i.gravite] ?? "bg-cream/10 text-cream/70 border-cream/20"}`}>
                    {i.gravite}
                  </span>
                  <p className="text-cream/90 text-sm font-medium">{i.titre}</p>
                  <span className="text-cream/40 text-[10px] ml-auto">
                    {new Date(i.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                {i.description && <p className="text-cream/70 text-xs mt-2">{i.description}</p>}
                {i.photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {i.photos.map((url, k) => (
                      <a key={k} href={url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded border border-primary/15">
                        <img src={url} alt={`Incident ${i.titre}`} loading="lazy" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
