import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getIdVerificationStatus, startIdVerification } from "@/lib/id-verification.functions";

const LABEL: Record<string, string> = {
  approved: "Identité vérifiée", review: "Vérification en cours d'examen", declined: "Vérification refusée — recommencez",
  pending: "Vérification commencée", abandoned: "Vérification interrompue — reprenez-la", none: "Vérifiez votre identité en 1 minute",
};

/** Vérification d'identité automatique (CNI ou passeport + selfie), via Didit. Une fois validée, elle ne peut plus être relancée. */
export default function IdVerifyCard({ large = false, onStatus }: { large?: boolean; onStatus?: (s: string) => void }) {
  const statusFn = useServerFn(getIdVerificationStatus);
  const startFn = useServerFn(startIdVerification);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { const r = await statusFn(); setStatus(r.status); onStatus?.(r.status); return r.status; }
    catch { setStatus((s) => s ?? "none"); return null; }
  }, [statusFn, onStatus]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await refresh();
      // Retour depuis Didit : le résultat peut mettre quelques secondes à arriver.
      const back = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("idv") === "done";
      if (back && alive && s !== "approved") {
        for (let i = 0; i < 6 && alive; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const n = await refresh();
          if (n === "approved" || n === "declined" || n === "review") break;
        }
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  if (status === null) return null;
  const ok = status === "approved";
  const inReview = status === "review";

  if (ok) {
    return (
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500 text-white"><CheckCircle2 size={24} /></span>
        <div className="flex-1">
          <p className="text-[15px] font-bold text-slate-900">Identité vérifiée</p>
          <p className="text-[12.5px] text-slate-600">Votre pièce d'identité a été validée. Rien d'autre à faire.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={"mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-white shadow-sm " + (large ? "p-6" : "p-4")}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
        <ShieldCheck size={24} />
      </span>
      <div className="min-w-[200px] flex-1">
        <p className="text-[15px] font-bold text-slate-900">{LABEL[status] ?? LABEL.none}</p>
        <p className="text-[12.5px] text-slate-600">
          {inReview ? "Notre équipe examine votre dossier, vous serez prévenu dès que c'est validé."
            : "Carte d'identité ou passeport, puis un selfie. Rapide et sécurisé."}
        </p>
      </div>
      {!inReview && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { const r = await startFn({ data: { origin: window.location.origin } }); window.location.href = r.url; }
            catch (e) { toast.error((e as Error).message); setBusy(false); refresh(); }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {busy ? "Ouverture…" : "Vérifier mon identité"} <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
