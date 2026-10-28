import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getIdVerificationStatus, startIdVerification } from "@/lib/id-verification.functions";

const LABEL: Record<string, string> = {
  approved: "Identité vérifiée", review: "Vérification en cours d'examen", declined: "Vérification refusée — recommencez",
  pending: "Vérification commencée", abandoned: "Vérification interrompue — reprenez-la", none: "Vérifiez votre identité en 1 minute",
};

/** Vérification d'identité automatique (CNI ou passeport + selfie), via Didit. */
export default function IdVerifyCard() {
  const statusFn = useServerFn(getIdVerificationStatus);
  const startFn = useServerFn(startIdVerification);
  const [status, setStatus] = useState("none");
  const [busy, setBusy] = useState(false);
  useEffect(() => { statusFn().then((r) => setStatus(r.status)).catch(() => {}); }, [statusFn]);
  const ok = status === "approved";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <span className={"grid h-12 w-12 place-items-center rounded-xl " + (ok ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600")}>
        <ShieldCheck size={24} />
      </span>
      <div className="min-w-[200px] flex-1">
        <p className="text-[15px] font-bold text-slate-900">{LABEL[status] ?? LABEL.none}</p>
        <p className="text-[12.5px] text-slate-600">Carte d'identité ou passeport, puis un selfie. Rapide et sécurisé.</p>
      </div>
      {!ok && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { const r = await startFn({ data: { origin: window.location.origin } }); window.location.href = r.url; }
            catch (e) { toast.error((e as Error).message); setBusy(false); }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {busy ? "Ouverture…" : "Vérifier mon identité"} <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
