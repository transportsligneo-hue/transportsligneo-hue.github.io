/**
 * MissionWorkflow — parcours étape par étape pour le convoyeur sur le terrain.
 *
 * Étapes métier (stockées en texte dans attributions.etape_courante) :
 *   assignee, acceptee, en_route, sur_place, vehicule_recupere,
 *   edl_depart_fait, en_livraison, arrive_destination, edl_arrivee_fait, terminee, incident
 *
 * Compatible existant : la colonne attributions.statut continue d'évoluer comme avant
 * (propose / accepte / en_cours / termine). Ce composant n'écrit que dans
 * etape_courante et mission_etape_history (nouvelles colonne/table, nullable).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, ChevronRight, MapPin, KeyRound, ClipboardCheck, Truck,
  Flag, AlertTriangle, Loader2, Clock, Navigation,
} from "lucide-react";

export type EtapeKey =
  | "assignee" | "acceptee" | "en_route" | "sur_place"
  | "vehicule_recupere" | "edl_depart_fait" | "en_livraison"
  | "arrive_destination" | "edl_arrivee_fait" | "en_attente_validation"
  | "validee" | "refusee" | "terminee" | "incident";

interface EtapeDef {
  key: EtapeKey;
  label: string;
  short: string;
  icon: typeof MapPin;
  cta: string;
  hint?: string;
}

export const ETAPES: EtapeDef[] = [
  { key: "assignee", label: "Mission assignée", short: "Assignée", icon: ClipboardCheck, cta: "Accepter la mission" },
  { key: "acceptee", label: "Mission acceptée", short: "Acceptée", icon: Check, cta: "Démarrer le trajet vers le départ", hint: "Préparez votre matériel et partez" },
  { key: "en_route", label: "En route vers le départ", short: "En route", icon: Navigation, cta: "Je suis arrivé sur les lieux" },
  { key: "sur_place", label: "Arrivé sur les lieux", short: "Sur place", icon: MapPin, cta: "Prendre en charge le véhicule", hint: "Contactez le client si besoin" },
  { key: "vehicule_recupere", label: "Véhicule récupéré", short: "Récupéré", icon: KeyRound, cta: "Faire l'état des lieux départ" },
  { key: "edl_depart_fait", label: "État des lieux départ fait", short: "EDL départ", icon: ClipboardCheck, cta: "Démarrer la livraison" },
  { key: "en_livraison", label: "En livraison", short: "Livraison", icon: Truck, cta: "Je suis arrivé à destination" },
  { key: "arrive_destination", label: "Arrivé à destination", short: "Arrivé", icon: MapPin, cta: "Faire l'état des lieux arrivée" },
  { key: "edl_arrivee_fait", label: "État des lieux arrivée fait", short: "EDL arrivée", icon: ClipboardCheck, cta: "Clôturer la mission" },
  { key: "en_attente_validation", label: "En attente validation admin", short: "Validation", icon: Clock, cta: "En attente de validation" },
  { key: "validee", label: "Mission validée", short: "Validée", icon: Check, cta: "Mission validée" },
  { key: "refusee", label: "Mission refusée", short: "Refusée", icon: AlertTriangle, cta: "Mission refusée" },
  { key: "terminee", label: "Mission terminée", short: "Terminée", icon: Flag, cta: "Mission clôturée" },
];

interface Props {
  attributionId: string;
  userId: string;
  /** Étape actuelle persistée (depuis attributions.etape_courante). null = pas encore commencé. */
  currentEtape: string | null;
  /** Statut macro de l'attribution (propose/accepte/en_cours/termine) */
  statut: string;
  /** Inspections déjà faites (utiles pour sauter les étapes EDL si déjà OK) */
  inspectionDepartDone: boolean;
  inspectionArriveeDone: boolean;
  /** Callbacks vers le parent */
  onStartInspection: (type: "depart" | "arrivee") => void;
  /** Mise à jour macro (ex: passer "en_cours" au démarrage, "termine" à la fin) */
  onMacroStatusChange: (newStatut: string) => Promise<void> | void;
  onUpdated: () => void;
}

interface HistoryEntry {
  id: string;
  etape: string;
  notes: string | null;
  created_at: string;
}

export function MissionWorkflow({
  attributionId, userId, currentEtape, statut,
  inspectionDepartDone, inspectionArriveeDone,
  onStartInspection, onMacroStatusChange, onUpdated,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentNote, setIncidentNote] = useState("");

  // Étape effective : si rien en base, on déduit depuis le statut macro
  const effectiveEtape: EtapeKey = (currentEtape as EtapeKey) ||
    (statut === "en_attente_validation" ? "en_attente_validation" :
     statut === "validee" ? "validee" :
     statut === "refusee" ? "refusee" :
     statut === "termine" ? "terminee" :
     statut === "en_cours" ? "en_route" :
     statut === "accepte" ? "acceptee" : "assignee");

  const currentIndex = ETAPES.findIndex(e => e.key === effectiveEtape);
  const currentDef = ETAPES[currentIndex] ?? ETAPES[0];

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("mission_etape_history" as never)
      .select("id, etape, notes, created_at")
      .eq("attribution_id" as never, attributionId as never)
      .order("created_at", { ascending: false });
    if (data) setHistory(data as unknown as HistoryEntry[]);
  };

  useEffect(() => { fetchHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [attributionId]);

  const persistEtape = async (etape: EtapeKey, notes?: string) => {
    setLoading(true);
    await Promise.all([
      supabase.from("attributions").update({ etape_courante: etape }).eq("id", attributionId),
      supabase.from("mission_etape_history" as never).insert({
        attribution_id: attributionId,
        etape,
        notes: notes ?? null,
        created_by: userId,
      } as never),
    ]);
    await fetchHistory();
    setLoading(false);
  };

  const advance = async () => {
    // Étapes spéciales : EDL démarre l'inspection (le composant InspectionGuidee
    // est ouvert par le parent). On ne marque l'EDL "fait" qu'à la complétion,
    // déclenchée par le parent qui appellera markEtape.
    if (effectiveEtape === "vehicule_recupere") {
      onStartInspection("depart");
      return;
    }
    if (effectiveEtape === "arrive_destination") {
      onStartInspection("arrivee");
      return;
    }

    const nextIndex = Math.min(currentIndex + 1, ETAPES.length - 1);
    const nextEtape = ETAPES[nextIndex].key;

    // Synchro statut macro si pertinent
    if (effectiveEtape === "assignee") await onMacroStatusChange("accepte");
    if (effectiveEtape === "acceptee") await onMacroStatusChange("en_cours");
    if (nextEtape === "terminee") await onMacroStatusChange("termine");

    await persistEtape(nextEtape);
    onUpdated();
  };

  const reportIncident = async () => {
    await persistEtape("incident", incidentNote || "Incident signalé sur le terrain");
    setIncidentOpen(false);
    setIncidentNote("");
    onUpdated();
  };

  // Auto-sync : si EDL départ vient d'être complétée alors qu'on était à edl_depart_fait pas encore validé
  useEffect(() => {
    if (effectiveEtape === "vehicule_recupere" && inspectionDepartDone) {
      persistEtape("edl_depart_fait").then(onUpdated);
    }
    if (effectiveEtape === "arrive_destination" && inspectionArriveeDone) {
      persistEtape("edl_arrivee_fait").then(onUpdated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionDepartDone, inspectionArriveeDone]);

  const isIncident = effectiveEtape === "incident";
  const isFinished = ["terminee", "en_attente_validation", "validee", "refusee"].includes(effectiveEtape);

  return (
    <div className="space-y-3">
      {/* === Étape actuelle (gros bloc) === */}
      <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${
        isIncident ? "bg-red-50 border-red-200" :
        isFinished ? "bg-emerald-50 border-emerald-200" :
        "bg-white border-pro-border"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isIncident ? "bg-red-600 text-white" :
            isFinished ? "bg-emerald-600 text-white" :
            "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            <currentDef.icon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium">Étape en cours</p>
            <p className="text-pro-text font-semibold text-base leading-tight mt-0.5">{currentDef.label}</p>
            {currentDef.hint && !isFinished && !isIncident && (
              <p className="text-pro-text-soft text-xs mt-1">{currentDef.hint}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-pro-muted text-[10px] uppercase tracking-wider">Progression</p>
            <p className="text-emerald-700 font-bold text-sm">{Math.min(currentIndex + 1, ETAPES.length - 1)}/{ETAPES.length - 1}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-pro-bg-soft rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(Math.min(currentIndex, ETAPES.length - 1) / (ETAPES.length - 1)) * 100}%` }}
          />
        </div>

        {/* CTA principal */}
        {!isFinished && !isIncident && (
          <button
            onClick={advance}
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 px-5 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={20} />}
            {currentDef.cta}
          </button>
        )}

        {isFinished && (
          <div className="mt-3 flex items-center gap-2 text-emerald-700 text-sm font-medium">
            <Check size={16} /> {effectiveEtape === "en_attente_validation" ? "Dossier envoyé à l'admin pour validation" : "Mission clôturée avec succès"}
          </div>
        )}

        {isIncident && (
          <div className="mt-3 space-y-2">
            <p className="text-red-700 text-xs">Mission marquée comme incident. Contactez l'admin pour la suite.</p>
            <button
              onClick={() => persistEtape("en_route").then(onUpdated)}
              className="text-xs text-red-700 underline hover:text-red-800"
            >
              Reprendre la mission
            </button>
          </div>
        )}

        {/* Bouton incident discret */}
        {!isFinished && !isIncident && (
          <button
            onClick={() => setIncidentOpen(true)}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition"
          >
            <AlertTriangle size={13} /> Signaler un incident
          </button>
        )}
      </div>

      {/* === Stepper visuel compact (toutes les étapes) === */}
      <div className="bg-white rounded-2xl border border-pro-border p-3">
        <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium px-1 mb-2">Toutes les étapes</p>
        <ol className="space-y-1">
          {ETAPES.slice(0, -1).map((e, i) => {
            const done = i < currentIndex || isFinished;
            const active = i === currentIndex && !isFinished;
            return (
              <li key={e.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  done ? "bg-emerald-600 text-white" :
                  active ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500" :
                  "bg-pro-bg-soft text-pro-muted"
                }`}>
                  {done ? <Check size={11} /> : i + 1}
                </div>
                <span className={`text-xs ${active ? "text-pro-text font-semibold" : done ? "text-pro-text-soft" : "text-pro-muted"}`}>
                  {e.short}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* === Historique horodaté === */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-pro-border p-3">
          <button
            onClick={() => setShowAllHistory(v => !v)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-pro-muted font-medium w-full hover:text-pro-text transition px-1"
          >
            <Clock size={11} />
            Historique ({history.length})
            <span className="ml-auto">{showAllHistory ? "▲" : "▼"}</span>
          </button>
          {showAllHistory && (
            <ul className="mt-2 space-y-1.5">
              {history.slice(0, 12).map(h => {
                const def = ETAPES.find(e => e.key === h.etape);
                return (
                  <li key={h.id} className="flex items-start gap-2 text-xs px-1">
                    <span className="text-pro-muted shrink-0 tabular-nums">
                      {new Date(h.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-pro-text">{def?.short ?? h.etape}</span>
                    {h.notes && <span className="text-pro-text-soft italic truncate">— {h.notes}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* === Modal incident === */}
      {incidentOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setIncidentOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} />
              <h3 className="font-semibold text-pro-text">Signaler un incident</h3>
            </div>
            <textarea
              value={incidentNote}
              onChange={e => setIncidentNote(e.target.value)}
              rows={3}
              placeholder="Décrivez brièvement ce qui se passe (panne, retard, accident, accès impossible...)"
              className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIncidentOpen(false)}
                className="flex-1 px-3 py-2.5 bg-pro-bg-soft text-pro-text-soft rounded-lg text-sm font-medium"
              >Annuler</button>
              <button
                onClick={reportIncident}
                disabled={loading}
                className="flex-1 px-3 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >Signaler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
