/**
 * MissionCockpit — parcours unifié et guidé pour le convoyeur.
 *
 * Fusionne en un seul composant :
 *   - les portes obligatoires (selfie, signatures départ/arrivée)
 *   - les étapes du workflow (départ, route, arrivée, livraison, etc.)
 *   - le déclenchement des inspections (EDL départ / arrivée)
 *
 * UX : une seule grande carte "ÉTAPE EN COURS" qui guide automatiquement
 * vers la bonne action (selfie / signature / inspection / avance d'étape).
 * Aucune logique métier nouvelle — réutilise les modales et le storage existants.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, ClipboardCheck, Truck, MapPin, KeyRound,
  Navigation, Flag, Check, ChevronRight, Loader2, AlertTriangle, Lock, Send,
} from "lucide-react";
import { useMissionGates } from "@/hooks/useMissionGates";
import { DriverSelfieCapture } from "@/components/mission/DriverSelfieCapture";
import { IncidentReportSheet } from "@/components/mission/IncidentReportSheet";

type ActionKind =
  | "selfie"
  | "demarrer"
  | "arrive_depart"
  | "edl_depart"
  | "demarrer_livraison"
  | "arrive_livraison"
  | "edl_arrivee"
  | "cloturer"
  | "done";

interface StepDef {
  key: ActionKind;
  label: string;
  short: string;
  hint?: string;
  icon: typeof Camera;
  cta: string;
}

const STEPS: StepDef[] = [
  { key: "selfie",             short: "Selfie",          label: "Selfie d'identité",                 icon: Camera,         cta: "Prendre mon selfie",        hint: "Photo obligatoire avant de commencer." },
  { key: "demarrer",           short: "Démarrer",        label: "Démarrer le trajet",                icon: Navigation,     cta: "Démarrer le trajet",        hint: "Active le GPS et part vers le point d'enlèvement." },
  { key: "arrive_depart",      short: "Arrivée enlèv.",  label: "Arrivé sur le lieu d'enlèvement",   icon: MapPin,         cta: "Je suis arrivé sur place",  hint: "Confirme ta présence au point d'enlèvement." },
  { key: "edl_depart",         short: "EDL départ",      label: "Inspection de départ",              icon: ClipboardCheck, cta: "Ouvrir l'inspection départ", hint: "Photos, signatures, PV et carte grise dans un seul flow." },
  { key: "demarrer_livraison", short: "En route",        label: "Démarrer la livraison",             icon: Truck,          cta: "Prendre la route",          hint: "Direction le point de livraison." },
  { key: "arrive_livraison",   short: "Arrivée livr.",   label: "Arrivé sur le lieu de livraison",   icon: MapPin,         cta: "Je suis arrivé à destination" },
  { key: "edl_arrivee",        short: "EDL arrivée",     label: "Inspection d'arrivée",              icon: ClipboardCheck, cta: "Ouvrir l'inspection arrivée", hint: "Photos, signatures, PV et clôture dans le même parcours." },
  { key: "cloturer",           short: "Clôture",         label: "Envoyer la mission à validation",   icon: Send,           cta: "Envoyer pour validation",   hint: "L'équipe vérifie puis valide." },
  { key: "done",               short: "Validation",      label: "En attente de validation admin",    icon: Flag,           cta: "Mission envoyée" },
];

interface Props {
  attributionId: string;
  userId: string;
  driverName: string;
  clientName?: string;
  currentEtape: string | null;
  statut: string;
  inspectionDepartDone: boolean;
  inspectionArriveeDone: boolean;
  onStartInspection: (type: "depart" | "arrivee") => void;
  onMacroStatusChange: (newStatut: string) => Promise<void> | void;
  onUpdated: () => void;
}

export function MissionCockpit({
  attributionId, userId, driverName, clientName, currentEtape, statut,
  inspectionDepartDone, inspectionArriveeDone,
  onStartInspection, onMacroStatusChange, onUpdated,
}: Props) {
  const gates = useMissionGates(attributionId);
  const [busy, setBusy] = useState(false);
  const [openSelfie, setOpenSelfie] = useState(false);
  const [openIncident, setOpenIncident] = useState(false);
  const [optimisticEtape, setOptimisticEtape] = useState<string | null>(currentEtape);

  useEffect(() => {
    setOptimisticEtape(currentEtape);
  }, [currentEtape]);

  const selfieOK     = gates.hasSelfie || gates.isDisabled("selfie");

  // === Détermine l'étape actuelle (la première non-terminée) ===
  const currentKey: ActionKind = useMemo(() => {
    if (statut === "validee" || statut === "termine") return "done";
    if (statut === "en_attente_validation") return "done";
    if (!selfieOK) return "selfie";

    const e = optimisticEtape ?? (statut === "en_cours" ? "en_route" : statut === "accepte" ? "acceptee" : "assignee");

    if (e === "assignee" || e === "acceptee") return "demarrer";
    if (e === "en_route") return "arrive_depart";
    if (e === "sur_place" || e === "vehicule_recupere") {
      if (!inspectionDepartDone) return "edl_depart";
      return "demarrer_livraison";
    }
    if (e === "edl_depart_fait") {
      return "demarrer_livraison";
    }
    if (e === "en_livraison") return "arrive_livraison";
    if (e === "arrive_destination") {
      if (!inspectionArriveeDone) return "edl_arrivee";
      return "cloturer";
    }
    if (e === "edl_arrivee_fait") {
      return "cloturer";
    }
    return "demarrer";
  }, [statut, optimisticEtape, selfieOK, inspectionDepartDone, inspectionArriveeDone]);

  const currentIdx = STEPS.findIndex(s => s.key === currentKey);
  const currentDef = STEPS[currentIdx] ?? STEPS[0];
  const isDone = currentKey === "done";

  // Auto-avance d'étape (silencieux) quand une porte ouvre la voie
  useEffect(() => {
    const e = optimisticEtape ?? currentEtape;
    // EDL départ vient d'être terminée → on cale etape_courante à edl_depart_fait
    if (inspectionDepartDone && (e === "vehicule_recupere" || e === "sur_place")) {
      void persistEtape("edl_depart_fait");
    }
    if (inspectionArriveeDone && e === "arrive_destination") {
      void persistEtape("edl_arrivee_fait");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionDepartDone, inspectionArriveeDone, currentEtape, optimisticEtape]);

  async function persistEtape(etape: string, notes?: string) {
    setOptimisticEtape(etape);
    await Promise.all([
      supabase.from("attributions").update({ etape_courante: etape }).eq("id", attributionId),
      supabase.from("mission_etape_history" as never).insert({
        attribution_id: attributionId, etape, notes: notes ?? null, created_by: userId,
      } as never),
    ]);
  }

  async function handleAdvance() {
    setBusy(true);
    try {
      switch (currentKey) {
        case "selfie":             setOpenSelfie(true); break;
        case "edl_depart":         onStartInspection("depart"); break;
        case "edl_arrivee":        onStartInspection("arrivee"); break;
        case "demarrer":
          await persistEtape("en_route");
          try {
            await onMacroStatusChange("en_cours");
          } catch {
            // L'étape reste prioritaire pour éviter un blocage visuel si le statut serveur tarde.
          }
          onUpdated();
          break;
        case "arrive_depart":
          await persistEtape("sur_place");
          onUpdated();
          break;
        case "demarrer_livraison":
          await persistEtape("en_livraison");
          onUpdated();
          break;
        case "arrive_livraison":
          await persistEtape("arrive_destination");
          onUpdated();
          break;
        case "cloturer":
          await persistEtape("en_attente_validation", "Mission envoyée pour validation");
          await onMacroStatusChange("en_attente_validation");
          onUpdated();
          break;
        case "done": break;
      }
    } finally {
      setBusy(false);
    }
  }

  const refreshAll = () => { gates.reload(); onUpdated(); };

  // Steps visuels (on cache "done" qui n'est qu'un état terminal)
  const visualSteps = STEPS.filter(s => s.key !== "done");
  const visualIdx = Math.max(0, Math.min(currentIdx, visualSteps.length - 1));
  const totalVisual = visualSteps.length;
  const progressPct = isDone ? 100 : Math.round(((visualIdx) / (totalVisual - 1)) * 100);

  return (
    <>
      {/* === Carte ÉTAPE EN COURS === */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDone ? "bg-emerald-50 border-emerald-200" : "bg-white border-pro-border"
      }`}>
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isDone ? "bg-emerald-600 text-white" : "bg-[#0b1026] text-[#d4af37]"
            }`}>
              <currentDef.icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-semibold">
                Étape {Math.min(visualIdx + 1, totalVisual)} / {totalVisual}
              </p>
              <p className="text-pro-text font-semibold text-base sm:text-lg leading-tight mt-0.5">
                {currentDef.label}
              </p>
              {currentDef.hint && !isDone && (
                <p className="text-pro-text-soft text-xs mt-1">{currentDef.hint}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-pro-muted text-[10px] uppercase tracking-wider">Avancement</p>
              <p className="text-emerald-700 font-bold text-sm tabular-nums">{progressPct}%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-pro-bg-soft rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#d4af37] to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 sm:px-5 pb-4">
          {!selfieOK && currentKey !== "selfie" && (
            <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-snug">Selfie d'identité requis avant de continuer.</p>
            </div>
          )}

          {!isDone && (
            <button
              onClick={handleAdvance}
              disabled={busy || gates.loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={20} />}
              {currentDef.cta}
            </button>
          )}

          {isDone && (
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium px-3 py-3 bg-white rounded-xl border border-emerald-200">
              <Check size={16} /> Mission envoyée. L'équipe va valider sous peu.
            </div>
          )}

          {!isDone && (
            <button
              onClick={() => setOpenIncident(true)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition"
            >
              <AlertTriangle size={13} /> Signaler un incident
            </button>
          )}
        </div>
      </div>

      {/* === Mini-timeline visuelle === */}
      <div className="bg-white rounded-2xl border border-pro-border p-3">
        <p className="text-[10px] uppercase tracking-wider text-pro-muted font-semibold px-1 mb-2">
          Parcours mission
        </p>
        <ol className="space-y-0.5">
          {visualSteps.map((s, i) => {
            const done = i < visualIdx || isDone;
            const active = i === visualIdx && !isDone;
            return (
              <li key={s.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  done ? "bg-emerald-600 text-white" :
                  active ? "bg-[#d4af37] text-[#0b1026] ring-2 ring-[#d4af37]/40" :
                  "bg-pro-bg-soft text-pro-muted"
                }`}>
                  {done ? <Check size={11} /> : i + 1}
                </div>
                <span className={`text-xs ${active ? "text-pro-text font-semibold" : done ? "text-pro-text-soft" : "text-pro-muted"}`}>
                  {s.short}
                </span>
                {active && (
                  <span className="ml-auto text-[10px] text-[#0b1026] font-bold uppercase tracking-wider">En cours</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* === Modales === */}
      {openSelfie && (
        <DriverSelfieCapture
          attributionId={attributionId}
          userId={userId}
          onCaptured={() => { setOpenSelfie(false); refreshAll(); }}
          onClose={() => setOpenSelfie(false)}
        />
      )}

      {openIncident && (
        <IncidentReportSheet
          attributionId={attributionId}
          userId={userId}
          onClose={() => setOpenIncident(false)}
          onReported={async () => { await persistEtape("incident", "Incident signalé"); onUpdated(); }}
        />
      )}
    </>
  );
}

/** Étape "Continuer" pour la sticky bottom bar — appelle l'action courante. */
export function MissionCockpitStickyCTA({
  attributionId, currentEtape, statut, inspectionDepartDone, inspectionArriveeDone, onClick,
}: {
  attributionId: string;
  currentEtape: string | null;
  statut: string;
  inspectionDepartDone: boolean;
  inspectionArriveeDone: boolean;
  onClick: () => void;
}) {
  const gates = useMissionGates(attributionId);
  const selfieOK = gates.hasSelfie || gates.isDisabled("selfie");

  let label = "Continuer";
  if (statut === "en_attente_validation" || statut === "validee" || statut === "termine") label = "Mission envoyée";
  else if (!selfieOK) label = "Prendre selfie";
  else if (currentEtape === "assignee" || currentEtape === "acceptee" || statut === "accepte") label = "Démarrer le trajet";
  else if (currentEtape === "en_route") label = "Je suis arrivé";
  else if ((currentEtape === "sur_place" || currentEtape === "vehicule_recupere") && !inspectionDepartDone) label = "Inspection départ";
  else if (currentEtape === "edl_depart_fait" || (currentEtape === "sur_place" && inspectionDepartDone)) label = "Prendre la route";
  else if (currentEtape === "en_livraison") label = "Je suis arrivé";
  else if (currentEtape === "arrive_destination" && !inspectionArriveeDone) label = "Inspection arrivée";
  else if (currentEtape === "edl_arrivee_fait" || (currentEtape === "arrive_destination" && inspectionArriveeDone)) label = "Envoyer";

  const isDone = ["en_attente_validation","validee","termine"].includes(statut);

  return (
    <button
      onClick={onClick}
      disabled={isDone}
      className="flex-[2] flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold active:scale-95 transition disabled:opacity-50"
    >
      <ChevronRight size={18} />
      <span className="text-sm">{label}</span>
    </button>
  );
}

// Re-export visual icons to avoid lint
export const _icons = { KeyRound, Truck, Navigation, Flag };
