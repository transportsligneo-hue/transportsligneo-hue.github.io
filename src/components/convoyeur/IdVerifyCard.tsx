import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getIdVerificationStatus, startIdVerification } from "@/lib/id-verification.functions";

const LABEL: Record<string, [string, string]> = {
  approved: ["Identité vérifiée", "Vérification réussie"],
  review: ["Vérification en cours", "En cours d'examen"],
  declined: ["Vérification refusée", "Recommencez"],
  pending: ["Vérification commencée", "À terminer"],
  abandoned: ["Vérification interrompue", "Reprenez-la"],
  none: ["Vérifiez votre identité", "CNI ou passeport + selfie, 1 minute"],
};

/** Vérification d'identité automatique (CNI ou passeport + selfie) : carte compacte, thème clair. */
export default function IdVerifyCard() {
  const statusFn = useServerFn(getIdVerificationStatus);
  const startFn = useServerFn(startIdVerification);
  const [status, setStatus] = useState("none");
  const [busy, setBusy] = useState(false);
  useEffect(() => { statusFn().then((r) => setStatus(r.status)).catch(() => {}); }, [statusFn]);
  const ok = status === "approved";
  const wait = status === "review";
  const [title, sub] = LABEL[status] ?? LABEL.none;
  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col gap-2 rounded-[20px] border bg-white p-3 shadow-[0_10px_26px_-18px_rgba(8,90,60,.35)]" style={{ borderColor: "rgba(8,90,60,.13)" }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]" style={{ background: ok ? "linear-gradient(135deg,#14B866,#4FE8A0)" : "#e1f7ec", color: ok ? "#04261a" : "#0b7a45" }}>
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0">
          <b className="block text-[13px] leading-tight text-[#08243f]">{title}</b>
          <small className="block text-[11px] leading-snug text-[#5d7a72]">{sub}</small>
        </div>
      </div>
      {!ok && !wait && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { const r = await startFn({ data: { origin: window.location.origin } }); window.location.href = r.url; }
            catch (e) { toast.error((e as Error).message); setBusy(false); }
          }}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-2 text-[12.5px] font-bold text-[#04261a] active:scale-[.98] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#14B866,#4FE8A0)" }}
        >
          {busy ? "Ouverture…" : "Vérifier"}
        </button>
      )}
    </div>
  );
}
