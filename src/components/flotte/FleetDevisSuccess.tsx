import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { generateDevisPdf, devisRowToPdfData, downloadDevisPdf } from "@/lib/devis-pdf";
import { Check, Download, Loader2, FileText, RotateCcw } from "lucide-react";

interface Props {
  devisId: string;
  title?: string;
  subtitle?: React.ReactNode;
  onNewRequest: () => void;
}

/**
 * Écran de confirmation « espace flotte » : aperçu immédiat du devis généré,
 * téléchargement en un clic et retour direct au formulaire.
 */
export function FleetDevisSuccess({ devisId, title = "Demande envoyée", subtitle, onNewRequest }: Props) {
  const [numero, setNumero] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("devis")
          .select("*")
          .eq("id", devisId)
          .maybeSingle();
        if (err) throw err;
        if (!data) throw new Error("Devis introuvable");
        const pdf = await generateDevisPdf(
          devisRowToPdfData(data as unknown as Record<string, unknown>),
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(pdf);
        setNumero((data as { numero?: string }).numero ?? null);
        setBlob(pdf);
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Aperçu du devis indisponible");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [devisId]);

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f7ee] text-[#16a34a]">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-500 text-sm">
          {subtitle}
          {numero ? (
            <>
              {" "}Votre devis <b className="text-slate-900">{numero}</b> est disponible ci-dessous
              et classé dans « Factures &amp; devis ».
            </>
          ) : null}
        </p>
      </div>

      <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-slate-500">{error}</div>
        ) : url ? (
          <iframe title="Aperçu du devis" src={`${url}#toolbar=0`} className="w-full h-[560px]" />
        ) : (
          <div className="flex h-[280px] items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          disabled={!blob}
          onClick={() => blob && downloadDevisPdf(blob, numero ?? "devis")}
          className="inline-flex items-center gap-2 rounded-[11px] bg-[#2f5fff] px-5 py-3 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Télécharger le devis
        </button>
        <button
          type="button"
          onClick={onNewRequest}
          className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 px-5 py-3 text-[13.5px] font-semibold text-slate-600 hover:border-slate-300"
        >
          <RotateCcw className="h-4 w-4" /> Faire une nouvelle demande
        </button>
        <Link
          to="/dashboard-pro/documents"
          className="inline-flex items-center gap-2 rounded-[11px] border border-slate-200 px-5 py-3 text-[13.5px] font-semibold text-slate-600 hover:border-slate-300"
        >
          <FileText className="h-4 w-4" /> Factures &amp; devis
        </Link>
      </div>
    </div>
  );
}

export default FleetDevisSuccess;
