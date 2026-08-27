import { useEffect, useState } from "react";
import { FileCheck2, ExternalLink } from "lucide-react";

import { getPoForRecord, getPoPdfUrl, type PoRow } from "@/lib/po/po-admin.functions";

interface PoLinkCardProps {
  devisId?: string;
  missionId?: string;
}

/** Affiche le bon de commande (PO) rattaché à un devis ou une mission. */
export function PoLinkCard({ devisId, missionId }: PoLinkCardProps) {
  const [po, setPo] = useState<PoRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await getPoForRecord({ data: { devisId, missionId } });
        if (!cancelled) setPo(row);
      } catch {
        if (!cancelled) setPo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [devisId, missionId]);

  if (loading || !po) return null;

  const openPdf = async () => {
    if (!po.pdf_path) return;
    const url = await getPoPdfUrl({ data: { path: po.pdf_path } });
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
            <FileCheck2 size={13} /> Bon de commande client
          </p>
          <p className="mt-1 font-semibold text-lg tabular-nums">{po.numero_po}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {po.montant_ht != null && <>Montant HT&nbsp;: {po.montant_ht.toFixed(2)} €&nbsp;· </>}
            {po.date_commande && <>Commandé le {new Date(po.date_commande).toLocaleDateString("fr-FR")}</>}
            {po.date_livraison && <> · Livraison {new Date(po.date_livraison).toLocaleDateString("fr-FR")}</>}
          </p>
          {po.vin && <p className="text-[11px] text-muted-foreground mt-0.5">VIN {po.vin}</p>}
        </div>
        {po.pdf_path && (
          <button
            type="button"
            onClick={openPdf}
            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 flex items-center gap-1"
          >
            <ExternalLink size={12} /> PDF
          </button>
        )}
      </div>
    </div>
  );
}

export default PoLinkCard;
