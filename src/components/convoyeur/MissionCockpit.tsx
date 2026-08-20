/**
 * MissionCockpit · parcours unifié et guidé pour le convoyeur.
 *
 * Version mobile-first centrée sur l'étape en cours :
 *   - selfie obligatoire
 *   - démarrage / arrivée / inspection
 *   - signatures et PV désormais portés par l'inspection
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { notifyDeliveryDone } from "@/lib/google-review.functions";
import { supabase } from "@/integrations/supabase/client";
import { writeWithOutbox } from "@/lib/offline-outbox";
import type { ReactNode } from "react";
import {
  Camera,
  ClipboardCheck,
  Truck,
  MapPin,
  KeyRound,
  Navigation,
  Flag,
  Check,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Lock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useMissionGates } from "@/hooks/useMissionGates";
import { DriverSelfieCapture, hasLocalSelfieDone, setPendingDriverSelfie } from "@/components/mission/DriverSelfieCapture";
import { IncidentReportSheet } from "@/components/mission/IncidentReportSheet";
import { ArriveeSignatureSheet } from "@/components/inspection/ArriveeSignatureSheet";
import { DepartureChecklistSheet } from "@/components/mission/DepartureChecklistSheet";
import { MissionContactsBlock } from "@/components/mission/MissionContactsBlock";

type ActionKind =
  | "selfie"
  | "demarrer"
  | "arrive_depart"
  | "edl_depart"
  | "demarrer_livraison"
  | "arrive_livraison"
  | "edl_arrivee"
  | "signature_arrivee"
  | "selfie_final"
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
  { key: "demarrer", short: "En route", label: "En route vers l'enlèvement", icon: Navigation, cta: "En route pour récupérer le véhicule", hint: "Vous prenez la route pour rejoindre le véhicule à enlever." },
  { key: "arrive_depart", short: "Arrivée enlèv.", label: "Arrivée au lieu d'enlèvement", icon: MapPin, cta: "Arrivé au lieu d'enlèvement", hint: "Confirme votre arrivée. Le selfie convoyeur s'ouvre ensuite automatiquement." },
  { key: "selfie", short: "Selfie", label: "Selfie convoyeur (enlèvement)", icon: Camera, cta: "Prendre mon selfie convoyeur", hint: "Photo d'identité obligatoire avant l'état des lieux." },
  { key: "edl_depart", short: "EDL départ", label: "État des lieux d'enlèvement", icon: ClipboardCheck, cta: "Commencer l'état des lieux d'enlèvement", hint: "Photos, scans documents et signatures côté enlèvement." },
  { key: "demarrer_livraison", short: "Trajet", label: "Démarrer le trajet", icon: Truck, cta: "Démarrer le trajet", hint: "Activation du suivi GPS et départ vers la livraison." },
  { key: "arrive_livraison", short: "Arrivée livr.", label: "Arrivée au lieu de livraison", icon: MapPin, cta: "Arrivé au lieu de livraison", hint: "Confirmez votre arrivée à destination. Vous lancerez ensuite l'état des lieux." },
  { key: "edl_arrivee", short: "EDL arrivée", label: "État des lieux d'arrivée", icon: ClipboardCheck, cta: "Commencer l'état des lieux d'arrivée", hint: "Photos d'arrivée. Les signatures se feront juste après." },
  { key: "signature_arrivee", short: "Signatures", label: "Signatures d'arrivée", icon: ClipboardCheck, cta: "Signer la livraison", hint: "Signature convoyeur puis signature du client réceptionnaire." },
  { key: "selfie_final", short: "Selfie final", label: "Selfie convoyeur final", icon: Camera, cta: "Prendre le selfie final", hint: "Dernière photo d'identité avant l'envoi à l'admin." },
  { key: "cloturer", short: "Envoi admin", label: "Envoyer la mission à l'admin", icon: Send, cta: "Envoyer à l'admin", hint: "Dossier complet transmis pour validation." },
  { key: "done", short: "Validation", label: "En attente de validation admin", icon: Flag, cta: "Mission envoyée" },
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
  onMacroStatusChange: (newStatut: string) => Promise<boolean> | boolean;
  onUpdated: () => Promise<void> | void;
  forceOpenSelfie?: boolean;
  onSelfieModalStateChange?: (open: boolean) => void;
  missionNumber?: string | null;
  departVille?: string | null;
  arriveeVille?: string | null;
  activeTab?: "action" | "info" | "docs";
  onTabChange?: (tab: "action" | "info" | "docs") => void;
  infoSlot?: ReactNode;
  docsSlot?: ReactNode;
}

export function MissionCockpit({
  attributionId,
  userId,
  driverName,
  clientName,
  currentEtape,
  statut,
  inspectionDepartDone,
  inspectionArriveeDone,
  onStartInspection,
  onMacroStatusChange,
  onUpdated,
  forceOpenSelfie = false,
  onSelfieModalStateChange,
  missionNumber,
  departVille,
  arriveeVille,
  activeTab = "action",
  onTabChange,
  infoSlot,
  docsSlot,
}: Props) {
  const gates = useMissionGates(attributionId);
  const notifyDeliveryDoneFn = useServerFn(notifyDeliveryDone);
  const [busy, setBusy] = useState(false);
  const [openSelfie, setOpenSelfie] = useState(false);
  const [openIncident, setOpenIncident] = useState(false);
  const [openSignatureArrivee, setOpenSignatureArrivee] = useState(false);
  const [signaturesArriveeDone, setSignaturesArriveeDone] = useState(false);
  // Checklist sécurité bloquante avant "En route pour récupérer le véhicule".
  const [checklistDone, setChecklistDone] = useState(false);
  const [openChecklist, setOpenChecklist] = useState(false);
  const [optimisticEtape, setOptimisticEtape] = useState<string | null>(currentEtape);
  // Optimiste : dès qu'on confirme la sauvegarde du selfie, on déverrouille
  // l'UI sans attendre la propagation Supabase / fetch parent.
  const [selfieJustDone, setSelfieJustDone] = useState(() => hasLocalSelfieDone(attributionId));
  const lastAutoOpenedKeyRef = useRef<ActionKind | null>(null);
  const forceOpenConsumedRef = useRef(false);

  // Vérifie en BDD si les 2 signatures d'arrivée sont déjà présentes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("mission_signatures" as never)
        .select("kind")
        .eq("attribution_id" as never, attributionId as never);
      if (cancelled || !data) return;
      const kinds = new Set((data as { kind: string }[]).map((r) => r.kind));
      if (kinds.has("driver_end") && kinds.has("client_end")) {
        setSignaturesArriveeDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

  // Checklist de sécurité déjà validée pour cette mission ?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("mission_departure_checklists" as never)
        .select("attribution_id")
        .eq("attribution_id" as never, attributionId as never)
        .maybeSingle();
      if (!cancelled && data) setChecklistDone(true);
    })();
    return () => { cancelled = true; };
  }, [attributionId]);



  useEffect(() => {
    setOptimisticEtape(currentEtape);
  }, [currentEtape]);

  // Re-check local marker if attribution changes
  useEffect(() => {
    if (hasLocalSelfieDone(attributionId)) setSelfieJustDone(true);
  }, [attributionId]);

  const selfieOK = gates.hasSelfie || gates.isDisabled("selfie") || selfieJustDone;
  // Selfie final = 2e selfie pris (après EDL arrivée) · count BDD.
  const finalSelfieOK = gates.selfies.length >= 2 || gates.isDisabled("selfie_final");

  // Si la base confirme désormais le selfie, on garde aussi le flag local cohérent.
  useEffect(() => {
    if (!gates.hasSelfie) return;
    if (!selfieJustDone) setSelfieJustDone(true);
    setPendingDriverSelfie(attributionId, false);
  }, [attributionId, gates.hasSelfie, selfieJustDone]);

  useEffect(() => {
    onSelfieModalStateChange?.(openSelfie);
  }, [onSelfieModalStateChange, openSelfie]);

  const normalizedEtape = useMemo(() => {
    const etape = optimisticEtape ?? currentEtape;
    if (!etape) return null;

    if (etape === "en_validation_admin" || etape === "envoi_validation_admin") {
      return "en_attente_validation";
    }

    if (etape === "terminee") {
      return "termine";
    }

    return etape;
  }, [currentEtape, optimisticEtape]);

  const currentKey: ActionKind = useMemo(() => {
    if (["validee", "termine", "en_attente_validation"].includes(statut)) return "done";

    const e = normalizedEtape ?? (statut === "en_cours" ? "en_route" : statut === "accepte" ? "acceptee" : "assignee");

    if (e === "en_attente_validation" || e === "termine") return "done";

    // 1. Démarrage : "En route pour récupérer le véhicule"
    if (e === "assignee" || e === "acceptee") return "demarrer";
    // 2. Trajet vers enlèvement
    if (e === "en_route") return "arrive_depart";
    // 3. Sur place enlèvement → selfie obligatoire avant EDL
    if (e === "sur_place" || e === "vehicule_recupere") {
      if (!selfieOK) return "selfie";
      if (!inspectionDepartDone) return "edl_depart";
      return "demarrer_livraison";
    }
    if (e === "edl_depart_fait") {
      if (!selfieOK) return "selfie";
      if (!inspectionDepartDone) return "edl_depart";
      return "demarrer_livraison";
    }
    // 4. Trajet vers livraison
    if (e === "en_livraison") return "arrive_livraison";
    // 5. Sur place livraison → EDL arrivée → signatures → selfie final → envoi admin
    if (e === "arrive_destination") {
      if (!inspectionArriveeDone) return "edl_arrivee";
      if (!signaturesArriveeDone) return "signature_arrivee";
      if (!finalSelfieOK) return "selfie_final";
      return "cloturer";
    }
    if (e === "edl_arrivee_fait") {
      if (!inspectionArriveeDone) return "edl_arrivee";
      if (!signaturesArriveeDone) return "signature_arrivee";
      if (!finalSelfieOK) return "selfie_final";
      return "cloturer";
    }
    return "demarrer";
  }, [finalSelfieOK, inspectionArriveeDone, inspectionDepartDone, normalizedEtape, selfieOK, signaturesArriveeDone, statut]);

  useEffect(() => {
    if (!forceOpenSelfie) {
      forceOpenConsumedRef.current = false;
    }
  }, [forceOpenSelfie]);

  useEffect(() => {
    if (currentKey !== "selfie" && currentKey !== "selfie_final") {
      lastAutoOpenedKeyRef.current = null;
      return;
    }

    const shouldForceOpen = forceOpenSelfie && !forceOpenConsumedRef.current;
    const shouldAutoOpenForStep = lastAutoOpenedKeyRef.current !== currentKey;

    if ((shouldForceOpen || shouldAutoOpenForStep) && !openSelfie) {
      lastAutoOpenedKeyRef.current = currentKey;
      if (shouldForceOpen) {
        forceOpenConsumedRef.current = true;
      }
      setOpenSelfie(true);
    }
  }, [currentKey, forceOpenSelfie, openSelfie]);

  const currentIdx = STEPS.findIndex((s) => s.key === currentKey);
  const baseDef = STEPS[currentIdx] ?? STEPS[0];
  const isDone = currentKey === "done";
  const isValidated = ["validee", "termine"].includes(statut);
  const currentDef = isValidated
    ? { ...baseDef, short: "Validée", label: "Mission validée par l'admin", cta: "Mission validée", hint: "L'admin a validé votre dossier. Merci !" }
    : baseDef;

  useEffect(() => {
    const e = normalizedEtape;
    if (inspectionDepartDone && (e === "vehicule_recupere" || e === "sur_place")) {
      void persistEtape("edl_depart_fait").catch(() => undefined);
    }
    if (inspectionArriveeDone && e === "arrive_destination") {
      void persistEtape("edl_arrivee_fait").catch(() => undefined);
    }
  }, [inspectionDepartDone, inspectionArriveeDone, normalizedEtape]);

  async function persistEtape(etape: string, notes?: string) {
    const previousEtape = optimisticEtape ?? currentEtape;
    setOptimisticEtape(etape);
    try {
      const [a, h] = await Promise.all([
        writeWithOutbox(
          { kind: "update", table: "attributions", values: { etape_courante: etape }, match: { id: attributionId } },
          `Étape ${etape}`,
        ),
        writeWithOutbox(
          {
            kind: "insert",
            table: "mission_etape_history",
            values: { attribution_id: attributionId, etape, notes: notes ?? null, created_by: userId },
          },
          `Historique ${etape}`,
        ),
      ]);
      if (a.queued || h.queued) {
        toast.info("Hors ligne — l'étape sera envoyée au retour du réseau.");
      }
    } catch (err) {
      setOptimisticEtape(previousEtape);
      throw err;
    }
  }

  async function handleAdvance() {
    setBusy(true);
    try {
      switch (currentKey) {
        case "selfie":
        case "selfie_final":
          setOpenSelfie(true);
          break;
        case "edl_depart":
          onStartInspection("depart");
          break;
        case "edl_arrivee":
          onStartInspection("arrivee");
          break;
        case "demarrer":
          // Checklist sécurité bloquante : gilet jaune, tenue, permis.
          if (!checklistDone) {
            setOpenChecklist(true);
            break;
          }
          await persistEtape("en_route");
          if ((await onMacroStatusChange("en_cours")) === false) {
            toast.warning("Étape enregistrée, mais le statut général n'a pas pu être synchronisé.");
          }
          await Promise.resolve(onUpdated());
          break;
        case "arrive_depart":
          await persistEtape("sur_place");
          await Promise.resolve(onUpdated());
          // Ouverture auto du selfie convoyeur (étape obligatoire suivante)
          if (!selfieOK) {
            setOpenSelfie(true);
          } else if (!inspectionDepartDone) {
            onStartInspection("depart");
          }
          break;
        case "demarrer_livraison":
          await persistEtape("en_livraison");
          await Promise.resolve(onUpdated());
          break;
        case "arrive_livraison":
          await persistEtape("arrive_destination");
          await Promise.resolve(onUpdated());
          // Pas d'ouverture automatique : le conducteur déclenche l'EDL d'arrivée
          // manuellement via le bouton dédié pour éviter les doublons / ouvertures
          // intempestives.
          break;
        case "signature_arrivee":
          setOpenSignatureArrivee(true);
          break;
        case "cloturer":
          // Garde-fou final : tous les jalons doivent être présents
          if (!selfieOK) {
            toast.error("Selfie d'identité requis avant d'envoyer à l'admin");
            setOpenSelfie(true);
            break;
          }
          if (!inspectionDepartDone) {
            toast.error("Inspection d'enlèvement incomplète");
            onStartInspection("depart");
            break;
          }
          if (!inspectionArriveeDone) {
            toast.error("Inspection d'arrivée incomplète");
            onStartInspection("arrivee");
            break;
          }
          if (!signaturesArriveeDone) {
            toast.error("Signatures d'arrivée manquantes");
            setOpenSignatureArrivee(true);
            break;
          }
          if (!finalSelfieOK) {
            toast.error("Selfie final requis avant d'envoyer à l'admin");
            setOpenSelfie(true);
            break;
          }
          await persistEtape("en_attente_validation", "Mission envoyée pour validation");
          if ((await onMacroStatusChange("en_attente_validation")) === false) {
            toast.warning("Mission envoyée, mais le statut général n'a pas pu être synchronisé.");
          }
          // Demande d'avis Google automatique (silencieux, anti-doublon serveur).
          void notifyDeliveryDoneFn({ data: { attributionId } }).catch(() => {});
          // Notification + email admin "mission terminée" (best-effort).
          void import("@/lib/mission-completion-notify")
            .then(({ notifyAdminMissionTerminee }) => notifyAdminMissionTerminee(attributionId))
            .catch(() => {});
          await Promise.resolve(onUpdated());
          break;
        case "done":
          break;
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Réessayez dans quelques secondes.";
      toast.error("Impossible d'avancer dans la mission", { description });
    } finally {
      setBusy(false);
    }
  }

  const refreshAll = async () => {
    // Déverrouillage optimiste immédiat · l'utilisateur voit l'étape suivante
    // sans attendre la propagation realtime / fetch parent.
    setSelfieJustDone(true);
    setPendingDriverSelfie(attributionId, false);
    setOpenSelfie(false);
    try {
      await gates.reload();
    } catch { /* ignore : l'optimiste tient le coup */ }
    try {
      await Promise.resolve(onUpdated());
    } catch { /* ignore */ }
  };

  const visualSteps = STEPS.filter((s) => s.key !== "done");
  const visualIdx = Math.max(0, Math.min(currentIdx, visualSteps.length - 1));
  const totalVisual = visualSteps.length;
  // Progression réelle = nb d'étapes effectivement validées (jamais 100% avant la clôture admin).
  const progressPct = isDone
    ? 100
    : Math.min(95, Math.round((visualIdx / totalVisual) * 100));

  const ringSize = 92;
  const ringStroke = 6;
  const ringR = (ringSize - ringStroke) / 2;
  const ringC = 2 * Math.PI * ringR;
  const ringPct = isDone ? 1 : Math.min(0.95, (visualIdx + 1) / totalVisual);

  const badgeSize = 50;
  const badgeStroke = 4;
  const badgeR = (badgeSize - badgeStroke) / 2;
  const badgeC = 2 * Math.PI * badgeR;

  return (
    <>
      <div className="mv3-root">
        <style>{`
          .mv3-root { font-family: 'Inter', sans-serif; color: #EAF3FF;
            border-radius: 26px; overflow: hidden; position: relative; isolation: isolate;
            background: #060B24;
            box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(120,180,255,0.08); }
          .mv3-root::before {
            content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
            background:
              radial-gradient(38% 30% at 15% 8%, rgba(47,107,255,0.30), transparent 65%),
              radial-gradient(45% 35% at 92% 18%, rgba(47,216,255,0.26), transparent 65%),
              radial-gradient(50% 40% at 25% 96%, rgba(110,70,255,0.16), transparent 65%);
            filter: blur(20px); opacity: .55;
          }
          .mv3-hero { position: relative; margin: 14px; padding: 18px 18px 6px; border-radius: 22px;
            background: linear-gradient(155deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
            backdrop-filter: blur(18px); border: 1px solid rgba(120,180,255,0.14); overflow: hidden; }
          .mv3-hero-mesh { position: absolute; top: -40%; left: -10%; width: 140%; height: 160%;
            background: radial-gradient(closest-side, rgba(47,216,255,0.16), transparent 70%); pointer-events: none; }
          .mv3-hero-head { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
          .mv3-eyebrow { font-size: 10px; letter-spacing: .6px; color: #9098AE; font-weight: 600; text-transform: uppercase; }
          .mv3-live-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(47,216,255,0.12);
            border: 1px solid rgba(47,216,255,0.35); color: #2FD8FF; font-size: 10.5px; font-weight: 700;
            padding: 5px 10px; border-radius: 20px; }
          .mv3-live-dot { width: 5px; height: 5px; border-radius: 50%; background: #2FD8FF; animation: mv3PulseDot 1.6s ease-in-out infinite; }
          @keyframes mv3PulseDot { 0%,100% { box-shadow: 0 0 0 0 rgba(47,216,255,.6);} 50% { box-shadow: 0 0 0 5px rgba(47,216,255,0);} }
          .mv3-hero-mid { display: flex; align-items: center; gap: 16px; margin-top: 14px; position: relative; z-index: 1; }
          .mv3-ring-wrap { position: relative; flex-shrink: 0; }
          .mv3-ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .mv3-ring-num { font-size: 22px; font-weight: 800; line-height: 1; }
          .mv3-ring-den { font-size: 7.5px; color: #8A93AC; margin-top: 2px; text-align: center; }
          .mv3-ring-progress { transition: stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1); }
          .mv3-hero-title { font-size: 17px; font-weight: 700; line-height: 1.25; }
          .mv3-hero-sub { font-size: 12px; color: #9098AE; margin-top: 4px; }
          .mv3-hero-badges { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
          .mv3-hero-badges span { font-size: 10px; font-weight: 600; color: #C7CCDA; background: rgba(255,255,255,0.06);
            border: 1px solid rgba(120,180,255,0.12); padding: 4px 8px; border-radius: 8px; }
          .mv3-road-svg { width: 100%; height: 46px; margin-top: 6px; position: relative; z-index: 1; }
          .mv3-road-fill { animation: mv3RoadFlow 3s linear infinite; }
          @keyframes mv3RoadFlow { to { stroke-dashoffset: -110; } }

          .mv3-pane { padding: 0 14px 16px; display: flex; flex-direction: column; gap: 12px; position: relative; z-index: 1; }

          .mv3-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(16px);
            border: 1px solid rgba(120,180,255,0.12); border-radius: 20px; padding: 16px; position: relative; overflow: hidden; }
          .mv3-card-row { display: flex; align-items: center; justify-content: space-between; }
          .mv3-card-title { font-size: 13px; font-weight: 700; }
          .mv3-pill-count { font-size: 10px; font-weight: 800; color: #2FD8FF; background: rgba(47,216,255,0.1);
            padding: 3px 9px; border-radius: 20px; border: 1px solid rgba(47,216,255,0.25); }
          .mv3-checklist { margin-top: 12px; width: 100%; display: flex; align-items: center; gap: 10px;
            background: rgba(47,216,255,0.07); border: 1px solid rgba(47,216,255,0.26); border-radius: 14px;
            padding: 13px; color: #F3F5F9; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; text-align: left; }
          .mv3-checklist.done { background: rgba(52,232,176,0.1); border-color: rgba(52,232,176,0.4); }
          .mv3-checklist .mv3-check-icon { color: #2FD8FF; flex-shrink: 0; }
          .mv3-check-box { width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.3);
            display: flex; align-items: center; justify-content: center; color: #34E8B0; flex-shrink: 0; }
          .mv3-checklist.done .mv3-check-box { background: #34E8B0; border-color: #34E8B0; color: #06070C; }
          .mv3-meta-row { display: flex; gap: 18px; margin-top: 12px; font-size: 11px; color: #7C859C; }
          .mv3-meta-row b { color: #C7CCDA; }
          .mv3-next-glow { position: absolute; top: -50px; right: -50px; width: 160px; height: 160px; border-radius: 50%;
            background: radial-gradient(circle, rgba(47,216,255,0.18), transparent 70%); }
          .mv3-badge-ring { position: relative; flex-shrink: 0; }
          .mv3-badge-pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 800; color: #EAF3FF; }
          .mv3-badge-ring-progress { transition: stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1);
            filter: drop-shadow(0 0 5px rgba(47,216,255,.45)); }
          .mv3-step-header { display: flex; align-items: center; gap: 14px; position: relative; z-index: 1; }
          .mv3-step-header-text { display: flex; flex-direction: column; gap: 3px; }
          .mv3-step-eyebrow { font-size: 9.5px; letter-spacing: .8px; text-transform: uppercase; color: #7C93C2; font-weight: 800; }
          .mv3-step-count { font-size: 16px; font-weight: 800; color: #F5F6FA; }
          .mv3-step-count .mv3-step-total { color: #5F7BB8; font-weight: 600; }

          .mv3-next-main { display: flex; gap: 12px; margin-top: 14px; position: relative; z-index: 1;
            animation: mv3StepSwap .45s cubic-bezier(.2,.8,.2,1) both; }
          @keyframes mv3StepSwap { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
          .mv3-next-icon { width: 48px; height: 48px; border-radius: 15px; flex-shrink: 0; display: flex; align-items: center;
            justify-content: center; background: linear-gradient(140deg,#2F6BFF,#2FD8FF); color: #06070C;
            box-shadow: 0 8px 24px rgba(47,107,255,0.35); }
          .mv3-next-title { font-size: 15px; font-weight: 700; }
          .mv3-next-sub { font-size: 12px; color: #9098AE; margin-top: 3px; line-height: 1.4; }

          .mv3-cta { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 16px;
            background: linear-gradient(120deg,#2F6BFF,#2FD8FF); color: #06070C; border: none;
            padding: 14px; border-radius: 14px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-family: inherit;
            box-shadow: 0 10px 26px rgba(47,107,255,0.32); transition: transform .15s, box-shadow .15s; position: relative; z-index: 1;
            min-height: 52px; }
          .mv3-cta:active { transform: scale(0.97); }
          .mv3-cta:disabled { opacity: .55; cursor: not-allowed; }
          .mv3-cta.done { background: rgba(52,232,176,0.14); color: #34E8B0; box-shadow: none;
            border: 1px solid rgba(52,232,176,0.4); cursor: default; }

          .mv3-dots { display: flex; gap: 5px; margin-top: 16px; position: relative; z-index: 1; }
          .mv3-dot { flex: 1; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.08); position: relative; overflow: hidden; }
          .mv3-dot.done { background: linear-gradient(90deg,#2F6BFF,#2FD8FF); box-shadow: 0 0 6px rgba(47,216,255,.5); }
          .mv3-dot.current { background: rgba(47,216,255,0.14); }
          .mv3-dot.current::after { content: ""; position: absolute; inset: 0; border-radius: 3px; transform-origin: left;
            background: linear-gradient(90deg,#2F6BFF,#2FD8FF); animation: mv3DotFill 1.7s ease-in-out infinite; }
          @keyframes mv3DotFill { 0% { transform: scaleX(.08); opacity: .85; } 55% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(.08); opacity: .85; } }

          .mv3-chips { display: flex; gap: 8px; overflow-x: auto; margin-top: 14px; padding-bottom: 2px; }
          .mv3-chips::-webkit-scrollbar { display: none; }
          .mv3-chip { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 7px 12px; border-radius: 20px;
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); color: #7C859C; white-space: nowrap; }
          .mv3-chip.done { color: #34E8B0; border-color: rgba(52,232,176,0.35); background: rgba(52,232,176,0.08); }
          .mv3-chip.active { background: linear-gradient(120deg,#2F6BFF,#2FD8FF); color: #06070C; border-color: transparent; }

          .mv3-warn { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 12px;
            background: rgba(255,182,72,0.10); border: 1px solid rgba(255,182,72,0.35); color: #FFD895;
            font-size: 12px; line-height: 1.35; margin-top: 12px; position: relative; z-index: 1; }
          .mv3-incident { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 10px; border-radius: 12px; background: rgba(255,80,90,0.08); border: 1px solid rgba(255,80,90,0.28);
            color: #FF9AA2; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
          .mv3-incident:hover { background: rgba(255,80,90,0.14); }

          .mv3-contacts-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(120,180,255,0.10);
            border-radius: 18px; padding: 4px; position: relative; z-index: 1; }

          .mv3-hero-route { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12.5px;
            color: #C7CCDA; font-weight: 600; min-width: 0; }
          .mv3-hero-route-city { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 42%; }
          .mv3-hero-route-arrow { color: #2FD8FF; font-weight: 800; flex-shrink: 0; }

          .mv3-tabs { display: flex; gap: 8px; padding: 0 14px; margin-top: 6px; position: relative; z-index: 1; }
          .mv3-tab { flex: 1; padding: 11px 12px; border-radius: 14px;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.12);
            color: #9098AE; font-size: 12.5px; font-weight: 700; font-family: inherit;
            cursor: pointer; transition: all .18s ease; min-height: 44px; }
          .mv3-tab:hover { color: #EAF3FF; border-color: rgba(120,180,255,0.22); }
          .mv3-tab.active { background: linear-gradient(120deg,#0E1740,#182559); color: #EAF3FF;
            border-color: rgba(47,216,255,0.4); box-shadow: 0 6px 18px rgba(47,107,255,0.28) inset, 0 0 0 1px rgba(47,216,255,0.15); }

          .mv3-slot { display: flex; flex-direction: column; gap: 12px;
            animation: mv3PaneIn .22s cubic-bezier(.2,.8,.2,1) both; }
          @keyframes mv3PaneIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        `}</style>

        {/* HERO · ring + road */}
        <div className="mv3-hero">
          <div className="mv3-hero-mesh" />
          <div className="mv3-hero-head">
            <div className="mv3-eyebrow">Mission convoyeur · {missionNumber ?? " · "}</div>
            <div className="mv3-live-pill">
              <span className="mv3-live-dot" />
              {isDone ? "Envoyée" : currentDef.short}
            </div>
          </div>
          <div className="mv3-hero-mid">
            <div className="mv3-ring-wrap" style={{ width: ringSize, height: ringSize }}>
              <svg width={ringSize} height={ringSize}>
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="rgba(255,255,255,0.07)" strokeWidth={ringStroke} fill="none" />
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="url(#mv3RingGrad)" strokeWidth={ringStroke} fill="none"
                  strokeDasharray={ringC} strokeDashoffset={ringC - ringPct * ringC} strokeLinecap="round"
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} className="mv3-ring-progress" />
                <defs>
                  <linearGradient id="mv3RingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2F6BFF" />
                    <stop offset="100%" stopColor="#2FD8FF" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="mv3-ring-label">
                <span className="mv3-ring-num">{Math.min(visualIdx + 1, totalVisual)}</span>
                <span className="mv3-ring-den">/ {totalVisual} étapes</span>
              </div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mv3-hero-title">{currentDef.label}</div>
              {(departVille || arriveeVille) && (
                <div className="mv3-hero-route">
                  <span className="mv3-hero-route-city">{departVille ?? " · "}</span>
                  <span className="mv3-hero-route-arrow">→</span>
                  <span className="mv3-hero-route-city">{arriveeVille ?? " · "}</span>
                </div>
              )}
              {currentDef.hint && !isDone && <div className="mv3-hero-sub">{currentDef.hint}</div>}
              <div className="mv3-hero-badges">
                <span>Étape {Math.min(visualIdx + 1, totalVisual)} / {totalVisual}</span>
                <span>{progressPct}% terminé</span>
              </div>
            </div>
          </div>

          <svg viewBox="0 0 320 64" className="mv3-road-svg" preserveAspectRatio="none">
            <path d="M6,52 C60,52 60,12 120,12 C180,12 180,44 240,44 C280,44 290,20 314,20"
              fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="3" strokeLinecap="round" />
            <path d="M6,52 C60,52 60,12 120,12 C180,12 180,44 240,44 C280,44 290,20 314,20"
              fill="none" stroke="url(#mv3RoadGrad)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="440" strokeDashoffset={440 - ringPct * 440} className="mv3-road-fill" />
            <defs>
              <linearGradient id="mv3RoadGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2F6BFF" />
                <stop offset="100%" stopColor="#2FD8FF" />
              </linearGradient>
            </defs>
            <circle r="5.5" fill="#2FD8FF">
              <animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto"
                path="M6,52 C60,52 60,12 120,12 C180,12 180,44 240,44 C290,20 314,20 314,20" keyPoints="0;0.28" keyTimes="0;1" />
            </circle>
          </svg>
        </div>

        {/* TABS */}
        <div className="mv3-tabs" role="tablist" aria-label="Détail mission">
          {([
            { key: "action", label: "Action" },
            { key: "info", label: "Informations" },
            { key: "docs", label: "Documents" },
          ] as const).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange?.(tab.key)}
                className={`mv3-tab ${active ? "active" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* PANE : contenu selon onglet */}
        <div className="mv3-pane">
          {activeTab === "action" && (
          <>
          <div className="mv3-glass" style={{ paddingTop: 16 }}>
            <div className="mv3-next-glow" />

            <div className="mv3-step-header">
              <div className="mv3-badge-ring" style={{ width: badgeSize, height: badgeSize }}>
                <svg width={badgeSize} height={badgeSize}>
                  <circle cx={badgeSize / 2} cy={badgeSize / 2} r={badgeR} stroke="rgba(255,255,255,0.08)" strokeWidth={badgeStroke} fill="none" />
                  <circle cx={badgeSize / 2} cy={badgeSize / 2} r={badgeR} stroke="url(#mv3BadgeGrad)" strokeWidth={badgeStroke} fill="none"
                    strokeDasharray={badgeC} strokeDashoffset={badgeC - (progressPct / 100) * badgeC} strokeLinecap="round"
                    transform={`rotate(-90 ${badgeSize / 2} ${badgeSize / 2})`} className="mv3-badge-ring-progress" />
                  <defs>
                    <linearGradient id="mv3BadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#2F6BFF" />
                      <stop offset="100%" stopColor="#2FD8FF" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="mv3-badge-pct">{progressPct}%</span>
              </div>
              <div className="mv3-step-header-text">
                <span className="mv3-step-eyebrow">Progression de la mission</span>
                <div className="mv3-step-count">
                  Étape {Math.min(visualIdx + 1, totalVisual)}<span className="mv3-step-total"> / {totalVisual}</span>
                </div>
              </div>
            </div>

            <div className="mv3-next-main" key={currentKey}>
              <div className="mv3-next-icon">
                <currentDef.icon size={24} strokeWidth={2.2} />
              </div>
              <div>
                <div className="mv3-next-title">{currentDef.label}</div>
                {currentDef.hint && <div className="mv3-next-sub">{currentDef.hint}</div>}
              </div>
            </div>

            {!selfieOK && (currentKey === "edl_depart" || currentKey === "demarrer_livraison") && (
              <div className="mv3-warn">
                <Lock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>Selfie d'identité requis avant de continuer.</span>
              </div>
            )}

            {/* CTA · libellé = action, PAS "valider cette étape" */}
            <button
              onClick={handleAdvance}
              disabled={busy || isDone}
              className={`mv3-cta ${isDone ? "done" : ""}`}
            >
              {isDone ? (
                <><Check size={16} strokeWidth={3} /> {isValidated ? "Mission validée" : "Mission envoyée"}</>
              ) : busy ? (
                <><Loader2 className="animate-spin" size={16} /> {currentDef.cta}</>
              ) : (
                <>{currentDef.cta} <ChevronRight size={16} /></>
              )}
            </button>

            <div className="mv3-dots">
              {visualSteps.map((_, i) => (
                <span
                  key={i}
                  className={`mv3-dot ${i < visualIdx ? "done" : ""} ${i === visualIdx && !isDone ? "current" : ""}`}
                />
              ))}
            </div>

            <div className="mv3-chips">
              {visualSteps.map((s, i) => {
                const done = i < visualIdx || isDone;
                const active = i === visualIdx && !isDone;
                return (
                  <span key={s.key} className={`mv3-chip ${done ? "done" : ""} ${active ? "active" : ""}`}>
                    {done && "✓ "}{s.short}
                  </span>
                );
              })}
            </div>
          </div>

          {!isDone && (
            <div className="mv3-contacts-wrap">
              {(() => {
                const arriveeSteps: ActionKind[] = ["arrive_livraison", "edl_arrivee", "signature_arrivee", "selfie_final", "cloturer"];
                const focus: "depart" | "arrivee" | "both" = arriveeSteps.includes(currentKey)
                  ? "arrivee"
                  : (currentKey === "demarrer_livraison" ? "both" : "depart");
                return <MissionContactsBlock attributionId={attributionId} focus={focus} />;
              })()}
            </div>
          )}

          {!isDone && (
            <button onClick={() => setOpenIncident(true)} className="mv3-incident">
              <AlertTriangle size={13} /> Signaler un incident
            </button>
          )}
          </>
          )}

          {activeTab === "info" && (
            <div className="mv3-slot">{infoSlot}</div>
          )}

          {activeTab === "docs" && (
            <div className="mv3-slot">{docsSlot}</div>
          )}
        </div>
      </div>

      {openSelfie && (
        <DriverSelfieCapture
          attributionId={attributionId}
          userId={userId}
          onCaptured={refreshAll}
          onClose={() => setOpenSelfie(false)}
        />
      )}

      {openIncident && (
        <IncidentReportSheet
          attributionId={attributionId}
          userId={userId}
          onClose={() => setOpenIncident(false)}
          onReported={async () => {
            await persistEtape("incident", "Incident signalé");
            onUpdated();
          }}
        />
      )}

      {openSignatureArrivee && (
        <ArriveeSignatureSheet
          attributionId={attributionId}
          driverName={driverName}
          defaultClientName={clientName}
          onClose={() => setOpenSignatureArrivee(false)}
          onComplete={async () => {
            setSignaturesArriveeDone(true);
            setOpenSignatureArrivee(false);
            try { await Promise.resolve(onUpdated()); } catch { /* ignore */ }
          }}
        />
      )}

      {openChecklist && (
        <DepartureChecklistSheet
          attributionId={attributionId}
          userId={userId}
          onClose={() => setOpenChecklist(false)}
          onValidated={async () => {
            setChecklistDone(true);
            setOpenChecklist(false);
            try {
              await persistEtape("en_route");
              if ((await onMacroStatusChange("en_cours")) === false) {
                toast.warning("Étape enregistrée, mais le statut général n'a pas pu être synchronisé.");
              }
              await Promise.resolve(onUpdated());
            } catch {
              toast.error("Impossible de démarrer le trajet, réessayez.");
            }
          }}
        />
      )}
    </>

  );
}

export function MissionCockpitStickyCTA({
  attributionId,
  currentEtape,
  statut,
  inspectionDepartDone,
  inspectionArriveeDone,
  onClick,
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
  if (["validee", "termine"].includes(statut)) label = "Mission validée";
  else if (statut === "en_attente_validation") label = "Mission envoyée";
  else if (currentEtape === "assignee" || currentEtape === "acceptee" || statut === "accepte") label = "En route pour récupérer le véhicule";
  else if (currentEtape === "en_route") label = "Je suis arrivé";
  else if (!selfieOK && (currentEtape === "sur_place" || currentEtape === "vehicule_recupere")) label = "Prendre selfie";
  else if ((currentEtape === "sur_place" || currentEtape === "vehicule_recupere") && !inspectionDepartDone) label = "Inspection départ";
  else if (currentEtape === "edl_depart_fait" || (currentEtape === "sur_place" && inspectionDepartDone)) label = "Prendre la route";
  else if (currentEtape === "en_livraison") label = "Je suis arrivé";
  else if (currentEtape === "arrive_destination" && !inspectionArriveeDone) label = "Inspection arrivée";
  else if (currentEtape === "edl_arrivee_fait" || (currentEtape === "arrive_destination" && inspectionArriveeDone)) label = "Envoyer";

  const isDone = ["en_attente_validation", "validee", "termine"].includes(statut);

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

export const _icons = { KeyRound, Truck, Navigation, Flag };