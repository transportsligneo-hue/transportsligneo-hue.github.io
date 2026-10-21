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
import "@/styles/driver-v2.css";
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
  onComplete: () => void | Promise<void>;
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
      if (firstUndone >= 0) setStepIdx((cur) => Math.max(cur, firstUndone));
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
      const signerName = kind === "client_end" ? (clientName || signerLabel) : signerLabel;
      await saveMissionSignature({
        attributionId,
        kind,
        signerName,
        file,
        uploadToStorage: true,
      });

      setStates((prev) => ({ ...prev, [kind]: { status: "done" } }));
      toastSignatureSuccess();
      // Avance vers la suivante (canvas remonté via key → aucun "Effacer" requis)
      setStepIdx(stepIdx + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setStates((prev) => ({ ...prev, [kind]: { status: "error", error: msg } }));
      toastSignatureError(err);
    } finally {
      busyRef.current = false;
    }
  };

  // Plus de fermeture automatique : le convoyeur confirme lui-même l'envoi (écran de fin ci-dessous).
  const [sending, setSending] = useState(false);
  const finish = async () => {
    if (sending) return;
    setSending(true);
    try { await onComplete(); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="drv2 bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 text-[#04321c]" style={{ background: "linear-gradient(120deg,#14B866,#4FE8A0)" }}>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/45"><PenLine size={17} /></span>
            <div>
              <p className="text-sm font-bold leading-tight">Signatures de livraison</p>
              <p className="text-[11px] opacity-75">Étape {Math.min(stepIdx + 1, STEPS.length)} sur {STEPS.length}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 hover:bg-white/30 rounded-lg">
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
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-[#04321c]" style={{ background: "linear-gradient(135deg,#14B866,#4FE8A0)", boxShadow: "0 14px 28px -10px rgba(20,184,102,.7)" }}>
                <Check size={30} strokeWidth={3} />
              </div>
              <p className="text-lg font-bold text-slate-900">Livraison signée</p>
              <p className="text-sm text-slate-600">Les deux signatures sont enregistrées.<br />Il ne reste qu'à envoyer le dossier pour validation.</p>
              <button
                onClick={finish}
                disabled={sending}
                className="sigx-ok mt-3 w-full disabled:opacity-60"
              >
                {sending ? <><Loader2 size={18} className="animate-spin" /> Un instant…</> : <>Continuer vers l'envoi <ChevronRight size={18} /></>}
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
                <div className="sigx-field">
                  <label htmlFor="arr-client-name">Nom du client réceptionnaire</label>
                  <input
                    id="arr-client-name"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                    enterKeyHint="done"
                    autoComplete="off"
                    placeholder="Prénom et nom"
                  />
                </div>
              )}

              {states[currentStep.kind].status === "done" ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                  <Check size={16} /> Signature déjà enregistrée
                </div>
              ) : (
                <SignatureCanvas
                  key={currentStep.kind}
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
