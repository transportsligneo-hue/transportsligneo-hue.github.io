/**
 * ArriveeSignatureSheet · capture séparée des signatures d'arrivée
 * (convoyeur puis client). Déclenchée par MissionCockpit APRÈS validation
 * complète de l'EDL d'arrivée, jamais avant.
 *
 * - Écrit dans la table mission_signatures (kinds: driver_end, client_end)
 * - Upload PNG dans bucket mission-documents
 * - Idempotent : si une signature existe déjà, l'utilisateur peut la refaire,
 *   l'ancienne est remplacée proprement (upsert) et jamais perdue silencieusement
 *   tant qu'une nouvelle n'a pas réussi.
 * - Erreurs non bloquantes : on peut réessayer.
 */
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Check, AlertCircle, PenLine, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import {
  saveMissionSignature,
  toastSignatureError,
  toastSignatureSuccess,
} from "@/lib/signature-upload";

type SigKind = "driver_end" | "client_end";

interface Props {
  attributionId: string;
  driverName: string;
  defaultClientName?: string;
  onClose: () => void;
  /** Appelé quand les 2 signatures sont enregistrées (ou déjà présentes). */
  onComplete: () => void;
}

interface SigState {
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}


export function ArriveeSignatureSheet({
  attributionId, driverName, defaultClientName, onClose, onComplete,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const STEPS: { kind: SigKind; label: string; hint: string; signerLabel: string }[] = [
    {
      kind: "driver_end",
      label: "Signature convoyeur",
      hint: "Signez pour attester de la livraison",
      signerLabel: driverName || "Convoyeur",
    },
    {
      kind: "client_end",
      label: "Signature client",
      hint: "Faites signer le réceptionnaire",
      signerLabel: defaultClientName || "Client",
    },
  ];

  const [states, setStates] = useState<Record<SigKind, SigState>>({
    driver_end: { status: "idle" },
    client_end: { status: "idle" },
  });
  const [clientName, setClientName] = useState(defaultClientName ?? "");
  const busyRef = useRef(false);

  // Hydrate signatures déjà enregistrées
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("mission_signatures")
        .select("kind")
        .eq("attribution_id", attributionId);
      if (cancelled || !data) return;
      setStates((prev) => {
        const next = { ...prev };
        for (const row of data) {
          if (row?.kind === "driver_end" || row?.kind === "client_end") {
            next[row.kind] = { status: "done" };
          }
        }
        return next;
      });
      // Démarre sur la 1re non signée
      const firstUndone = STEPS.findIndex(
        (s) => !data.some((r) => r.kind === s.kind),
      );
      if (firstUndone >= 0) setStepIdx(firstUndone);
      else setStepIdx(STEPS.length); // toutes faites
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributionId]);

  const currentStep = STEPS[stepIdx];
  const allDone = states.driver_end.status === "done" && states.client_end.status === "done";

  const handleValidate = async (file: File) => {
    if (busyRef.current || !currentStep) return;
    busyRef.current = true;
    const { kind, signerLabel } = currentStep;
    setStates((prev) => ({ ...prev, [kind]: { status: "uploading" } }));
    try {
      const path = `${attributionId}/signature_${kind}_${Date.now()}.png`;
      await uploadWithRetry(path, file);
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => res(typeof r.result === "string" ? r.result : "");
        r.onerror = () => rej(new Error("Lecture signature impossible"));
        r.readAsDataURL(file);
      });
      const signerName = kind === "client_end" ? (clientName || signerLabel) : signerLabel;
      const { error } = await supabase.from("mission_signatures").upsert(
        {
          attribution_id: attributionId,
          kind,
          signer_name: signerName,
          signature_data: dataUrl,
        },
        { onConflict: "attribution_id,kind" },
      );
      if (error) throw error;

      setStates((prev) => ({ ...prev, [kind]: { status: "done" } }));
      toast.success("Signature enregistrée");
      // Avance vers la suivante
      const next = stepIdx + 1;
      setStepIdx(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setStates((prev) => ({ ...prev, [kind]: { status: "error", error: msg } }));
      toast.error("Signature échouée", { description: msg });
    } finally {
      busyRef.current = false;
    }
  };

  useEffect(() => {
    if (allDone) {
      // léger délai pour laisser l'utilisateur voir la confirmation
      const t = setTimeout(() => onComplete(), 400);
      return () => clearTimeout(t);
    }
  }, [allDone, onComplete]);

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-[#0b1026] text-white">
          <div className="flex items-center gap-2">
            <PenLine size={18} className="text-[#d4af37]" />
            <p className="text-sm font-semibold">Signatures d'arrivée</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 hover:bg-white/10 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Mini progression 2 étapes */}
        <div className="flex gap-1 px-4 py-2 bg-slate-50 border-b border-slate-200">
          {STEPS.map((s, i) => {
            const st = states[s.kind].status;
            const done = st === "done";
            const active = i === stepIdx && !allDone;
            return (
              <div key={s.kind} className="flex-1 flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  done ? "bg-emerald-600 text-white" :
                  active ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500" :
                  "bg-slate-200 text-slate-500"
                }`}>
                  {done ? <Check size={11} /> : i + 1}
                </div>
                <span className={`text-[11px] ${active ? "text-slate-900 font-semibold" : done ? "text-slate-600" : "text-slate-400"}`}>
                  {s.kind === "driver_end" ? "Convoyeur" : "Client"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {allDone ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                <Check size={28} />
              </div>
              <p className="text-base font-semibold text-slate-900">Signatures enregistrées</p>
              <p className="text-sm text-slate-600">Vous pouvez envoyer la mission à l'admin.</p>
              <button
                onClick={onComplete}
                className="mt-2 inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
              >
                Continuer <ChevronRight size={16} />
              </button>
            </div>
          ) : currentStep ? (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Étape {stepIdx + 1} / {STEPS.length}
                </p>
                <p className="text-base font-semibold text-slate-900 mt-0.5">{currentStep.label}</p>
                <p className="text-xs text-slate-600 mt-0.5">{currentStep.hint}</p>
              </div>

              {currentStep.kind === "client_end" && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Nom du client réceptionnaire
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Prénom Nom"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              )}

              {states[currentStep.kind].status === "done" ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                  <Check size={16} /> Signature déjà enregistrée
                </div>
              ) : (
                <SignatureCanvas
                  onValidate={handleValidate}
                  disabled={states[currentStep.kind].status === "uploading"}
                />
              )}

              {states[currentStep.kind].status === "uploading" && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Loader2 className="animate-spin" size={14} /> Enregistrement…
                </div>
              )}
              {states[currentStep.kind].status === "error" && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Échec de l'enregistrement</p>
                    <p className="mt-0.5">{states[currentStep.kind].error}</p>
                    <p className="mt-1 italic">Resignez puis revalidez · aucune signature précédente n'est perdue.</p>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
