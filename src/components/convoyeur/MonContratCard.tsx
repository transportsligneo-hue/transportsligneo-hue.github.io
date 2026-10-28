/** Contrat de partenariat — signature électronique Ligneo, visible dans l'espace convoyeur. */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Loader2, Clock, ShieldCheck, PenLine, AlertCircle, Download } from "lucide-react";
import { esignMyContrat, esignMyLink, esignMyContratFiles } from "@/lib/esign.functions";

type State =
  | { exists: false }
  | { exists: true; id: string; status: string; title: string; signedAt: string | null; missing: string[] };

export default function MonContratCard() {
  const fetchState = useServerFn(esignMyContrat);
  const getLink = useServerFn(esignMyLink);
  const getFiles = useServerFn(esignMyContratFiles);
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchState({}).then((r) => { if (alive) setSt(r as State); }).catch(() => { if (alive) setSt({ exists: false }); });
    return () => { alive = false; };
  }, [fetchState]);

  if (!st || !st.exists) return null;
  const signed = st.status === "signed";
  const blocked = !signed && st.missing.length > 0;

  const sign = async () => {
    setBusy(true);
    try { const { link } = await getLink({}); window.location.href = link; }
    catch (e) { toast.error(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Impossible d'ouvrir le contrat."); setBusy(false); }
  };

  const download = async (which: "signed" | "dossier") => {
    setBusy(true);
    try {
      const f = await getFiles({});
      const url = which === "signed" ? f.signed : f.dossier;
      if (!url) throw new Error("Fichier indisponible.");
      window.open(url, "_blank", "noopener");
    } catch (e) { toast.error(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Téléchargement impossible."); }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-pro-border p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-lg bg-[#2F5FFF]/10 text-[#2F5FFF] flex items-center justify-center shrink-0"><FileSignature size={18} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-pro-text">Contrat de partenariat</p>
          {signed ? (
            <p className="text-xs text-emerald-700 mt-0.5"><ShieldCheck size={12} className="inline mr-1 -mt-0.5" />Signé le {st.signedAt ? new Date(st.signedAt).toLocaleDateString("fr-FR") : "—"}. Une copie vous a été envoyée par e-mail.</p>
          ) : blocked ? (
            <p className="text-xs text-amber-700 mt-0.5"><AlertCircle size={12} className="inline mr-1 -mt-0.5" />Pour signer, déposez d'abord : {st.missing.join(", ")}.</p>
          ) : st.status === "expired" ? (
            <p className="text-xs text-amber-700 mt-0.5"><Clock size={12} className="inline mr-1 -mt-0.5" />Le lien a expiré — demandez un nouveau lien ci-contre.</p>
          ) : (
            <p className="text-xs text-amber-700 mt-0.5"><Clock size={12} className="inline mr-1 -mt-0.5" />Votre contrat est prêt, il attend votre signature.</p>
          )}
        </div>
        {signed && (
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => void download("signed")} disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2F5FFF] text-white text-sm font-medium disabled:opacity-60">
              <Download size={14} /> Contrat signé
            </button>
            <button onClick={() => void download("dossier")} disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-pro-border text-pro-text text-sm font-medium disabled:opacity-60">
              <ShieldCheck size={14} /> Preuve de signature
            </button>
          </div>
        )}
        {!signed && !blocked && (
          <button onClick={() => void sign()} disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2F5FFF] text-white text-sm font-medium disabled:opacity-60 shrink-0">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />} Signer
          </button>
        )}
      </div>
    </div>
  );
}
