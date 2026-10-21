import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  prepareHandoverCode,
  validateHandoverCode,
  skipHandoverCode,
} from "@/lib/handover-code.functions";

interface Props {
  attributionId: string;
  kind: "depart" | "arrivee";
  onPassed: () => void;
  onClose: () => void;
}

/**
 * Code de remise (type Uber).
 * Dans les deux cas le client donne son code (reçu par SMS/e-mail), le convoyeur le tape.
 */
export function HandoverCodeGate({ attributionId, kind, onPassed, onClose }: Props) {
  const prepare = useServerFn(prepareHandoverCode);
  const validate = useServerFn(validateHandoverCode);
  const skip = useServerFn(skipHandoverCode);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sentVia, setSentVia] = useState<"sms" | "email" | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r: any = await prepare({ data: { attributionId, kind } });
        if (!alive) return;
        if (r.done) { onPassed(); return; }
        setSentVia(r.sentVia ?? null);
      } catch (e) {
        console.warn("[handover] prepare failed", e);
        if (alive) setError("Impossible de préparer le code. Vérifie ta connexion.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributionId, kind]);

  const doSkip = async () => {
    const reason = window.prompt("Pourquoi continuer sans code ? (ex : client injoignable)") ?? "";
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await skip({ data: { attributionId, kind, reason } });
      toast.message("Continué sans code · l'admin est prévenu");
      onPassed();
    } catch { toast.error("Erreur, réessaie"); }
    setBusy(false);
  };

  const doValidate = async () => {
    setBusy(true); setError(null);
    try {
      const r: any = await validate({ data: { attributionId, kind, code: typed } });
      if (r.ok) { toast.success("Code correct ✓"); onPassed(); }
      else if (r.locked) { setLocked(true); setError("Trop d'essais. Utilise « Pas de code possible »."); }
      else setError("Code incorrect, redemande-le au client.");
    } catch { setError("Erreur, réessaie."); }
    setBusy(false);
  };

  const via = sentVia === "email" ? "par e-mail" : "par SMS";
  const body = (
    <div className="fixed inset-0 z-[10000] bg-white text-slate-900 flex flex-col p-5 gap-4 overflow-auto">
      <button onClick={onClose} className="self-start text-sm text-slate-500 underline">← Retour</button>
      <div className="flex items-center gap-2 text-blue-700 font-bold uppercase text-xs tracking-wide">
        <KeyRound size={16} /> {kind === "depart" ? "Enlèvement" : "Livraison"}
      </div>
      {loading ? (
        <div className="flex-1 grid place-items-center"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          <h2 className="text-xl font-bold">{kind === "depart" ? "Demande le code d'enlèvement au client" : "Demande le code de livraison au client"}</h2>
          <p className="text-sm text-slate-600">
            {sentVia ? `Le client a reçu un code à 4 chiffres ${via}. Un e-mail de confirmation lui sera envoyé dès que tu le valides.` : "Aucun mobile ni e-mail disponible pour envoyer le code."}
          </p>
          <input
            inputMode="numeric" maxLength={4} value={typed} disabled={locked}
            onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="text-center text-4xl tracking-[0.4em] border-2 border-slate-300 rounded-2xl py-4 focus:border-blue-600 outline-none"
            placeholder="----"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy || typed.length !== 4 || locked} onClick={doValidate}
            className="bg-blue-600 text-white rounded-xl py-3 font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Valider le code
          </button>
        </>
      )}
      {!loading && (
        <button disabled={busy} onClick={doSkip}
          className="mt-auto border border-slate-300 text-slate-500 rounded-xl py-2 text-sm">
          Pas de code possible (prévenir l'admin)
        </button>
      )}
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
