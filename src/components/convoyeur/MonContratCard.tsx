/** Contrat de partenariat signé — visible dans l'espace convoyeur une fois la signature Yousign terminée. */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Download, Loader2, Clock, ShieldCheck } from "lucide-react";
import { getMonContrat, getContratSigneUrl } from "@/lib/yousign.functions";

interface Row {
  id: string;
  statut: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_pdf_path: string | null;
}

export default function MonContratCard() {
  const fetchContrat = useServerFn(getMonContrat);
  const signedUrl = useServerFn(getContratSigneUrl);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetchContrat({});
        if (alive) setRow((res.contrat as Row | null) ?? null);
      } catch {
        if (alive) setRow(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchContrat]);

  if (loading || !row) return null;

  const signe = row.statut === "signe" && row.signed_pdf_path;

  const telecharger = async () => {
    setBusy(true);
    try {
      const { url } = await signedUrl({ data: { contratId: row.id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-pro-border p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-lg bg-[#2F5FFF]/10 text-[#2F5FFF] flex items-center justify-center shrink-0">
          <FileSignature size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-pro-text">Contrat de partenariat</p>
          {signe ? (
            <p className="text-xs text-emerald-700 mt-0.5">
              <ShieldCheck size={12} className="inline mr-1 -mt-0.5" />
              Signé le {row.signed_at ? new Date(row.signed_at).toLocaleDateString("fr-FR") : "—"}
            </p>
          ) : row.statut === "envoye" ? (
            <p className="text-xs text-amber-700 mt-0.5">
              <Clock size={12} className="inline mr-1 -mt-0.5" />
              En attente de votre signature — consultez l'email envoyé par Yousign.
            </p>
          ) : (
            <p className="text-xs text-pro-text-soft mt-0.5">Aucun contrat signé pour le moment.</p>
          )}
        </div>
        {signe && (
          <button onClick={() => void telecharger()} disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-60 shrink-0">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Télécharger
          </button>
        )}
      </div>
    </div>
  );
}
